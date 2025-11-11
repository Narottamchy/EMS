const cron = require('node-cron');
const Campaign = require('../models/Campaign');
const SentEmail = require('../models/SentEmail');
const QueueService = require('./QueueService');
const logger = require('../utils/logger');

class DailyScheduler {
  constructor() {
    this.scheduledTask = null;
    this.isRunning = false;
  }

  /**
   * Initialize the daily scheduler
   * Runs at midnight UTC every day to transition campaigns to the next day
   */
  initialize() {
    if (this.scheduledTask) {
      logger.warn('⚠️ Daily scheduler already initialized');
      return;
    }

    // Schedule to run at midnight UTC (00:00)
    // Cron format: second minute hour day month weekday
    this.scheduledTask = cron.schedule('0 0 * * *', async () => {
      await this.runDailyTransition();
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    logger.info('✅ Daily scheduler initialized - will run at midnight UTC');
  }

  /**
   * Main daily transition logic
   * Called automatically at midnight UTC or can be triggered manually
   */
  async runDailyTransition() {
    if (this.isRunning) {
      logger.warn('⚠️ Daily transition already in progress, skipping');
      return;
    }

    this.isRunning = true;
    logger.info('🌅 Starting daily campaign transition');

    try {
      // Find all running campaigns
      const runningCampaigns = await Campaign.find({ status: 'running' });

      if (runningCampaigns.length === 0) {
        logger.info('ℹ️ No running campaigns to transition');
        return;
      }

      logger.info(`📊 Found ${runningCampaigns.length} running campaigns to transition`);

      for (const campaign of runningCampaigns) {
        try {
          await this.transitionCampaignToNextDay(campaign);
        } catch (error) {
          logger.error(`❌ Failed to transition campaign ${campaign._id}:`, error);
          // Continue with other campaigns even if one fails
        }
      }

      logger.info('✅ Daily campaign transition completed');

    } catch (error) {
      logger.error('❌ Daily transition failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Transition a single campaign to the next day
   */
  async transitionCampaignToNextDay(campaign) {
    const campaignId = campaign._id;
    const currentDay = campaign.progress.currentDay;
    const nextDay = currentDay + 1;

    logger.info(`🔄 Transitioning campaign ${campaignId} from Day ${currentDay} to Day ${nextDay}`);

    // Check if campaign should be completed
    const shouldComplete = await this.checkCampaignCompletion(campaign);
    if (shouldComplete) {
      await this.completeCampaign(campaign);
      return;
    }

    // Remove any stale jobs from the previous day
    await QueueService.removeCampaignJobs(campaignId);

    // Update campaign to next day
    campaign.progress.currentDay = nextDay;
    await campaign.save();

    logger.info(`✅ Campaign ${campaignId} transitioned to Day ${nextDay}`);

    // Import CampaignOrchestrator dynamically to avoid circular dependency
    const CampaignOrchestrator = require('./CampaignOrchestrator');
    
    // Generate and schedule emails for the new day
    await CampaignOrchestrator.processCampaignForNewDay(campaignId);

    logger.info(`📧 Day ${nextDay} emails scheduled for campaign ${campaignId}`);
  }

  /**
   * Check if a campaign should be completed
   * Returns true if all available recipients have been sent emails
   */
  async checkCampaignCompletion(campaign) {
    try {
      const CampaignOrchestrator = require('./CampaignOrchestrator');
      
      // Get email list for this campaign
      const emailList = await CampaignOrchestrator.getEmailListForCampaign(campaign);
      
      // Get sent emails for this campaign
      const sentEmails = await SentEmail.find({ 
        campaign: campaign._id 
      }).select('recipient.email');
      
      const sentEmailSet = new Set(sentEmails.map(e => e.recipient.email.toLowerCase().trim()));
      
      // Get unsubscribed list
      const unsubscribedList = await CampaignOrchestrator.getUnsubscribedList();
      const unsubscribedSet = new Set(unsubscribedList.map(e => e.toLowerCase().trim()));
      
      // Calculate available recipients
      const availableRecipients = emailList.filter(email => 
        !sentEmailSet.has(email.toLowerCase().trim()) && 
        !unsubscribedSet.has(email.toLowerCase().trim())
      );

      logger.info(`📊 Campaign ${campaign._id} completion check:`, {
        totalEmails: emailList.length,
        sent: sentEmailSet.size,
        unsubscribed: unsubscribedSet.size,
        available: availableRecipients.length
      });

      // If warmup mode is enabled, check if we should continue
      if (campaign.configuration.warmupMode?.enabled) {
        // In warmup mode, campaign continues cycling through the list
        return false;
      }

      // Complete if no more recipients available
      return availableRecipients.length === 0;

    } catch (error) {
      logger.error(`❌ Error checking campaign completion:`, error);
      return false;
    }
  }

  /**
   * Mark a campaign as completed
   */
  async completeCampaign(campaign) {
    logger.info(`🎉 Completing campaign ${campaign._id}`);

    campaign.status = 'completed';
    campaign.completedAt = new Date();
    await campaign.save();

    // Remove any remaining jobs
    await QueueService.removeCampaignJobs(campaign._id);

    logger.info(`✅ Campaign ${campaign._id} marked as completed`);
  }

  /**
   * Manually trigger day transition for a specific campaign
   * Useful for testing or manual intervention
   */
  async manualTransition(campaignId) {
    logger.info(`🔧 Manual transition triggered for campaign ${campaignId}`);

    const campaign = await Campaign.findById(campaignId);
    
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status !== 'running') {
      throw new Error('Campaign is not running');
    }

    await this.transitionCampaignToNextDay(campaign);
    
    return campaign;
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      this.scheduledTask = null;
      logger.info('🛑 Daily scheduler stopped');
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isInitialized: !!this.scheduledTask,
      isRunning: this.isRunning,
      nextRun: this.scheduledTask ? 'Midnight UTC' : 'Not scheduled'
    };
  }
}

module.exports = new DailyScheduler();
