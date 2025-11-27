const logger = require('../utils/logger');
const Campaign = require('../models/Campaign');
const SentEmail = require('../models/SentEmail');
const CampaignEvent = require('../models/CampaignEvent');
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

        // 2. Update SentEmail status
        const updateData = {
            status: eventType.toLowerCase(),
            [`deliveryStatus.${eventType.toLowerCase()}At`]: new Date()
        };

        // Add tracking info for opens/clicks
        if (eventType === 'Open') {
            updateData['tracking.openCount'] = { $inc: 1 }; // This syntax is wrong for update object, need $inc operator
            updateData['tracking.lastOpenedAt'] = new Date();
            updateData['tracking.userAgent'] = event.open.userAgent;
            updateData['tracking.ipAddress'] = event.open.ipAddress;
        } else if (eventType === 'Click') {
            updateData['tracking.clickCount'] = { $inc: 1 };
            updateData['tracking.lastClickedAt'] = new Date();
            updateData['tracking.userAgent'] = event.click.userAgent;
            updateData['tracking.ipAddress'] = event.click.ipAddress;
        }

        // Construct the update query
        const updateQuery = {
            $set: {
                status: eventType.toLowerCase(),
                [`deliveryStatus.${eventType.toLowerCase()}At`]: new Date()
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

        // 3. Update Campaign stats
        const campaignUpdate = {};

        switch (eventType) {
            case 'Delivery':
                campaignUpdate.$inc = { 'progress.totalDelivered': 1 };
                break;
            case 'Bounce':
                campaignUpdate.$inc = { 'progress.totalBounced': 1 };
                break;
            case 'Open':
                campaignUpdate.$inc = { 'progress.totalOpened': 1 };
                break;
            case 'Click':
                campaignUpdate.$inc = { 'progress.totalClicked': 1 };
                break;
            case 'Complaint':
                // Maybe track complaints? Campaign model doesn't have totalComplaints explicitly but has totalUnsubscribed?
                // Usually complaints lead to suppression.
                break;
        }

        if (Object.keys(campaignUpdate).length > 0) {
            await Campaign.findByIdAndUpdate(campaignId, campaignUpdate);
        }

    } catch (error) {
        logger.error('❌ Error processing SES event:', error);
        throw error;
    }
}
