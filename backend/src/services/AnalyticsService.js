const DailyAnalytics = require('../models/DailyAnalytics');
const SentEmail = require('../models/SentEmail');
const logger = require('../utils/logger');

class AnalyticsService {
  async recordEmailSent(campaignId, day, hour, senderEmail, recipientDomain) {
    try {
      const date = new Date();
      date.setHours(0, 0, 0, 0);

      // Use findOneAndUpdate with upsert to handle concurrency
      // First, ensure document exists
      await DailyAnalytics.findOneAndUpdate(
        { campaign: campaignId, day: day },
        {
          $setOnInsert: {
            campaign: campaignId,
            date: date,
            day: day,
            summary: { totalSent: 0, totalDelivered: 0, totalFailed: 0, totalBounced: 0, totalOpened: 0, totalClicked: 0 },
            hourlyBreakdown: Array.from({ length: 24 }, (_, i) => ({
              hour: i,
              sent: 0,
              delivered: 0,
              failed: 0
            })),
            domainBreakdown: [],
            senderBreakdown: []
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Now increment the counter
      await DailyAnalytics.findOneAndUpdate(
        { campaign: campaignId, day: day },
        {
          $inc: {
            'summary.totalSent': 1
          }
        }
      );

      // Update hourly breakdown atomically
      await DailyAnalytics.findOneAndUpdate(
        {
          campaign: campaignId,
          day: day,
          'hourlyBreakdown.hour': hour
        },
        {
          $inc: { 'hourlyBreakdown.$.sent': 1 }
        }
      );

      // Update domain breakdown atomically
      await DailyAnalytics.findOneAndUpdate(
        {
          campaign: campaignId,
          day: day,
          'domainBreakdown.domain': recipientDomain
        },
        {
          $inc: { 'domainBreakdown.$.sent': 1 }
        }
      );

      // If domain doesn't exist, add it
      const hasDomain = await DailyAnalytics.findOne({
        campaign: campaignId,
        day: day,
        'domainBreakdown.domain': recipientDomain
      });

      if (!hasDomain) {
        await DailyAnalytics.findOneAndUpdate(
          { campaign: campaignId, day: day },
          {
            $push: {
              domainBreakdown: {
                domain: recipientDomain,
                sent: 1,
                delivered: 0,
                failed: 0,
                bounced: 0
              }
            }
          }
        );
      }

      // Update sender breakdown atomically
      await DailyAnalytics.findOneAndUpdate(
        {
          campaign: campaignId,
          day: day,
          'senderBreakdown.email': senderEmail
        },
        {
          $inc: { 'senderBreakdown.$.sent': 1 }
        }
      );

      // If sender doesn't exist, add it
      const hasSender = await DailyAnalytics.findOne({
        campaign: campaignId,
        day: day,
        'senderBreakdown.email': senderEmail
      });

      if (!hasSender) {
        await DailyAnalytics.findOneAndUpdate(
          { campaign: campaignId, day: day },
          {
            $push: {
              senderBreakdown: {
                email: senderEmail,
                sent: 1,
                delivered: 0,
                failed: 0
              }
            }
          }
        );
      }

    } catch (error) {
      logger.error('❌ Failed to record email sent analytics:', error);
    }
  }

  async recordEmailDelivered(campaignId, day, hour, senderEmail, recipientDomain) {
    try {
      // Update summary atomically
      await DailyAnalytics.findOneAndUpdate(
        { campaign: campaignId, day: day },
        { $inc: { 'summary.totalDelivered': 1 } }
      );

      // Update hourly breakdown atomically
      await DailyAnalytics.findOneAndUpdate(
        {
          campaign: campaignId,
          day: day,
          'hourlyBreakdown.hour': hour
        },
        { $inc: { 'hourlyBreakdown.$.delivered': 1 } }
      );

      // Update domain breakdown atomically
      await DailyAnalytics.findOneAndUpdate(
        {
          campaign: campaignId,
          day: day,
          'domainBreakdown.domain': recipientDomain
        },
        { $inc: { 'domainBreakdown.$.delivered': 1 } }
      );

      // Update sender breakdown atomically
      await DailyAnalytics.findOneAndUpdate(
        {
          campaign: campaignId,
          day: day,
          'senderBreakdown.email': senderEmail
        },
        { $inc: { 'senderBreakdown.$.delivered': 1 } }
      );

    } catch (error) {
      logger.error('❌ Failed to record email delivered analytics:', error);
    }
  }

  async recordEmailFailed(campaignId, day, hour, senderEmail, recipientDomain) {
    try {
      // Update summary atomically
      await DailyAnalytics.findOneAndUpdate(
        { campaign: campaignId, day: day },
        { $inc: { 'summary.totalFailed': 1 } }
      );

      // Update hourly breakdown atomically
      await DailyAnalytics.findOneAndUpdate(
        {
          campaign: campaignId,
          day: day,
          'hourlyBreakdown.hour': hour
        },
        { $inc: { 'hourlyBreakdown.$.failed': 1 } }
      );

      // Update domain breakdown atomically
      await DailyAnalytics.findOneAndUpdate(
        {
          campaign: campaignId,
          day: day,
          'domainBreakdown.domain': recipientDomain
        },
        { $inc: { 'domainBreakdown.$.failed': 1 } }
      );

      // Update sender breakdown atomically
      await DailyAnalytics.findOneAndUpdate(
        {
          campaign: campaignId,
          day: day,
          'senderBreakdown.email': senderEmail
        },
        { $inc: { 'senderBreakdown.$.failed': 1 } }
      );

    } catch (error) {
      logger.error('❌ Failed to record email failed analytics:', error);
    }
  }

  async getCampaignAnalytics(campaignId, startDay, endDay) {
    try {
      const query = { campaign: campaignId };

      if (startDay && endDay) {
        query.day = { $gte: startDay, $lte: endDay };
      }

      const analytics = await DailyAnalytics.find(query).sort({ day: 1 });

      return analytics;

    } catch (error) {
      logger.error('❌ Failed to get campaign analytics:', error);
      throw error;
    }
  }

  async getCampaignSummary(campaignId) {
    try {
      const analytics = await DailyAnalytics.find({ campaign: campaignId });

      const summary = {
        totalSent: 0,
        totalDelivered: 0,
        totalFailed: 0,
        totalBounced: 0,
        totalUnsubscribed: 0,
        averageDeliveryRate: 0,
        totalDays: analytics.length
      };

      analytics.forEach(day => {
        summary.totalSent += day.summary.totalSent;
        summary.totalDelivered += day.summary.totalDelivered;
        summary.totalFailed += day.summary.totalFailed;
        summary.totalBounced += day.summary.totalBounced;
        summary.totalUnsubscribed += day.summary.totalUnsubscribed;
      });

      if (summary.totalSent > 0) {
        summary.averageDeliveryRate = ((summary.totalDelivered / summary.totalSent) * 100).toFixed(2);
      }

      return summary;

    } catch (error) {
      logger.error('❌ Failed to get campaign summary:', error);
      throw error;
    }
  }

  async getRealtimeStats(campaignId) {
    try {
      const mongoose = require('mongoose');
      const Campaign = require('../models/Campaign'); // Ensure Campaign model is required
      const campaignObjectId = new mongoose.Types.ObjectId(campaignId);

      // Get current day from campaign to filter stats
      const campaign = await Campaign.findById(campaignId).select('progress.currentDay');
      const currentDay = campaign?.progress?.currentDay || 1;

      // Get status counts (for sent, delivered, failed, bounced)
      const statusCounts = await SentEmail.aggregate([
        {
          $match: {
            campaign: campaignObjectId,
            'metadata.day': currentDay
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      // Get engagement counts (opens and clicks from tracking fields)
      const engagementCounts = await SentEmail.aggregate([
        {
          $match: {
            campaign: campaignObjectId,
            'metadata.day': currentDay
          }
        },
        {
          $group: {
            _id: null,
            totalOpens: { $sum: '$tracking.openCount' },
            totalClicks: { $sum: '$tracking.clickCount' }
          }
        }
      ]);

      const stats = {
        queued: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
        bounced: 0,
        opened: 0,
        clicked: 0
      };

      // Process status counts
      statusCounts.forEach(item => {
        let status = item._id;
        // Normalize status names
        if (status === 'send') status = 'sent';
        if (status === 'delivery') status = 'delivered';
        if (status === 'open') status = 'opened';
        if (status === 'click') status = 'clicked';
        if (status === 'bounce') status = 'bounced';

        if (stats.hasOwnProperty(status)) {
          stats[status] += item.count;
        } else {
          stats[status] = item.count;
        }
      });

      // Add engagement counts
      if (engagementCounts.length > 0) {
        stats.opened = engagementCounts[0].totalOpens || 0;
        stats.clicked = engagementCounts[0].totalClicks || 0;
      }

      return stats;

    } catch (error) {
      logger.error('❌ Failed to get realtime stats:', error);
      throw error;
    }
  }
}

module.exports = new AnalyticsService();
