const logger = require('../utils/logger');
const Campaign = require('../models/Campaign');
const SentEmail = require('../models/SentEmail');
const CampaignEvent = require('../models/CampaignEvent');
const DailyAnalytics = require('../models/DailyAnalytics');
const AnalyticsService = require('../services/AnalyticsService');
const axios = require('axios');

exports.handleSESWebhook = async (req, res) => {
    try {
        const body = req.body;

        // Handle SNS Subscription Confirmation
        if (req.headers['x-amz-sns-message-type'] === 'SubscriptionConfirmation') {
            logger.info('🔔 Received SNS Subscription Confirmation');
            const subscribeUrl = body.SubscribeURL;
            if (subscribeUrl) {
                logger.info('Subscribing to SNS topic', { subscribeUrl });
                await axios.get(subscribeUrl);
                logger.info('✅ Confirmed SNS subscription');
                return res.status(200).send('Confirmed');
            }
            return res.status(400).send('Missing SubscribeURL');
        }

        // Handle SNS Notification
        if (req.headers['x-amz-sns-message-type'] === 'Notification') {
            const message = JSON.parse(body.Message);

            // SES events might be batched or single? Usually single for SNS.
            // But just in case, handle if it's an array (unlikely for standard SES->SNS)
            // Standard SES event structure is a single object in Message.

            await processSESEvent(message);

            return res.status(200).send('Processed');
        }

        // If it's a raw SES event (not wrapped in SNS), handle it too (optional)
        if (body.eventType) {
            await processSESEvent(body);
            return res.status(200).send('Processed');
        }

        return res.status(200).send('Ignored');

    } catch (error) {
        logger.error('❌ Error handling SES webhook:', error);
        return res.status(500).send('Error processing webhook');
    }
};

async function processSESEvent(event) {
    try {
        const { eventType, mail } = event;

        if (!mail || !mail.tags) {
            logger.debug('⚠️ SES event missing mail or tags', { eventType });
            return;
        }

        // Extract Campaign ID from tags
        // Tags are usually an object: { "X-Campaign-ID": ["123"] }
        const campaignIdTag = mail.tags['X-Campaign-ID'];
        const campaignId = campaignIdTag ? campaignIdTag[0] : null;

        if (!campaignId) {
            logger.debug('⚠️ SES event missing X-Campaign-ID tag', { messageId: mail.messageId });
            return;
        }

        logger.info(`📨 Processing SES event: ${eventType} for campaign ${campaignId}`);

        // Map SES event types to SentEmail status enums
        const statusMap = {
            'Send': 'sent',
            'Delivery': 'delivered',
            'Open': 'opened',
            'Click': 'clicked',
            'Bounce': 'bounced',
            'Complaint': 'failed', // or 'unsubscribed' depending on logic, usually complaints are treated as failures/suppressions
            'Reject': 'failed',
            'Rendering Failure': 'failed'
        };

        const mappedStatus = statusMap[eventType] || eventType.toLowerCase();

        // 1. Save raw event to CampaignEvent
        const campaignEvent = new CampaignEvent({
            campaign: campaignId,
            messageId: mail.messageId,
            eventType: eventType,
            timestamp: new Date(event[eventType.toLowerCase()]?.timestamp || new Date()),
            recipient: mail.destination[0], // Assuming single recipient per event
            details: event[eventType.toLowerCase()] || {},
            userAgent: event[eventType.toLowerCase()]?.userAgent,
            ipAddress: event[eventType.toLowerCase()]?.ipAddress,
            link: event[eventType.toLowerCase()]?.link
        });

        await campaignEvent.save();

        // Find the SentEmail BEFORE updating it to check if this is a first-time event
        const sentEmailBeforeUpdate = await SentEmail.findOne({ messageId: mail.messageId });

        if (!sentEmailBeforeUpdate) {
            logger.warn(`⚠️ SentEmail not found for messageId: ${mail.messageId}`);
            return;
        }

        // Log detailed event information
        const isFirstOpen = eventType === 'Open' && sentEmailBeforeUpdate.tracking.openCount === 0;
        const isFirstClick = eventType === 'Click' && sentEmailBeforeUpdate.tracking.clickCount === 0;

        logger.info(`📧 ${eventType} event for ${sentEmailBeforeUpdate.recipient.email}`, {
            campaignId,
            messageId: mail.messageId,
            recipient: sentEmailBeforeUpdate.recipient.email,
            eventType,
            isFirstTime: isFirstOpen || isFirstClick || eventType === 'Delivery' || eventType === 'Bounce',
            currentOpenCount: sentEmailBeforeUpdate.tracking.openCount,
            currentClickCount: sentEmailBeforeUpdate.tracking.clickCount
        });
        // 2. Update SentEmail status
        // Construct the update query
        const updateQuery = {
            $set: {
                status: mappedStatus,
                [`deliveryStatus.${mappedStatus}At`]: new Date()
            }
        };

        if (eventType === 'Open') {
            updateQuery.$inc = { 'tracking.openCount': 1 };
            updateQuery.$set['tracking.lastOpenedAt'] = new Date();
            updateQuery.$set['tracking.userAgent'] = event.open.userAgent;
            updateQuery.$set['tracking.ipAddress'] = event.open.ipAddress;
        } else if (eventType === 'Click') {
            updateQuery.$inc = { 'tracking.clickCount': 1 };
            updateQuery.$set['tracking.lastClickedAt'] = new Date();
            updateQuery.$set['tracking.userAgent'] = event.click.userAgent;
            updateQuery.$set['tracking.ipAddress'] = event.click.ipAddress;
        }

        // Find by messageId (SES Message ID)
        // Note: SentEmail.messageId stores the SES Message ID
        await SentEmail.findOneAndUpdate(
            { messageId: mail.messageId },
            updateQuery
        );

        // 3. Update Campaign stats (only increment for UNIQUE events)
        const campaignUpdate = {};

        switch (eventType) {
            case 'Delivery':
                campaignUpdate.$inc = { 'progress.totalDelivered': 1 };
                break;
            case 'Bounce':
                campaignUpdate.$inc = { 'progress.totalBounced': 1 };
                break;
            case 'Open':
                // Only increment if this is the first open
                if (sentEmailBeforeUpdate && sentEmailBeforeUpdate.tracking.openCount === 0) {
                    campaignUpdate.$inc = { 'progress.totalOpened': 1 };
                }
                break;
            case 'Click':
                // Only increment if this is the first click
                if (sentEmailBeforeUpdate && sentEmailBeforeUpdate.tracking.clickCount === 0) {
                    campaignUpdate.$inc = { 'progress.totalClicked': 1 };
                }
                break;
            case 'Complaint':
                // Maybe track complaints? Campaign model doesn't have totalComplaints explicitly but has totalUnsubscribed?
                // Usually complaints lead to suppression.
                break;
        }

        if (Object.keys(campaignUpdate).length > 0) {
            await Campaign.findByIdAndUpdate(campaignId, campaignUpdate);
        }

        // 4. Update DailyAnalytics for historical reporting
        const sentEmail = await SentEmail.findOne({ messageId: mail.messageId });
        if (sentEmail) {
            const day = sentEmail.metadata.day;
            const hour = sentEmail.metadata.hour || 0;
            const senderEmail = sentEmail.sender.email;
            const recipientDomain = sentEmail.recipient.domain;

            // Record analytics based on event type
            switch (eventType) {
                case 'Delivery':
                    await AnalyticsService.recordEmailDelivered(campaignId, day, hour, senderEmail, recipientDomain);
                    break;
                case 'Bounce':
                    // DailyAnalytics doesn't have a specific recordEmailBounced method, but we can increment bounced counter
                    // For now, we'll update it manually
                    await DailyAnalytics.findOneAndUpdate(
                        { campaign: campaignId, day: day },
                        { $inc: { 'summary.totalBounced': 1 } }
                    );
                    break;
                case 'Open':
                    // Check if this is the first open for this email
                    const isFirstOpen = sentEmail.tracking.openCount === 1;

                    const openUpdate = {
                        $inc: { 'summary.totalOpened': 1 }
                    };

                    // If first open, also increment unique opens
                    if (isFirstOpen) {
                        openUpdate.$inc['summary.uniqueOpens'] = 1;
                    }

                    await DailyAnalytics.findOneAndUpdate(
                        { campaign: campaignId, day: day },
                        openUpdate
                    );
                    break;
                case 'Click':
                    // Check if this is the first click for this email
                    const isFirstClick = sentEmail.tracking.clickCount === 1;

                    const clickUpdate = {
                        $inc: { 'summary.totalClicked': 1 }
                    };

                    // If first click, also increment unique clicks
                    if (isFirstClick) {
                        clickUpdate.$inc['summary.uniqueClicks'] = 1;
                    }

                    await DailyAnalytics.findOneAndUpdate(
                        { campaign: campaignId, day: day },
                        clickUpdate
                    );
                    break;
            }
        }

    } catch (error) {
        logger.error('❌ Error processing SES event:', error);
        throw error;
    }
}
