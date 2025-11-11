const cron = require('node-cron');
const Campaign = require('../models/Campaign');
const logger = require('../utils/logger');
const QueueService = require('./QueueService');

class DayTransitionScheduler {
  constructor() {
    this.cronJob = null;
    this.isRunning = false;
  }

  /**
   * Get current UTC day in YYYY-MM-DD format
   */
  getCurrentUTCDay() {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  /**
   * Initialize the scheduler to run at midnight UTC every day
   */
  initialize() {
    if (this.isRunning) {
      logger.warn('⚠️ Day transition scheduler is already running');
      return;
    }

    // Run at 00:00 UTC every day
    this.cronJob = cron.schedule('0 0 * * *', async () => {
      await this.processDayTransition();
    }, {
      timezone: 'UTC'
    });

    this.isRunning = true;
    logger.info('✅ Day transition scheduler initialized (runs at 00:00 UTC daily)');

    // Also check on startup in case we missed a transition
    this.checkAndProcessMissedTransitions();
  }

  /**
   * Check if any running campaigns need day transition
   */
  async checkAndProcessMissedTransitions() {
    try {
      logger.info('🔍 Checking for missed day transitions...');
      await this.processDayTransition();
    } catch (error) {
      logger.error('❌ Error checking missed transitions:', error);
    }
  }

  /**
   * Process day transition for all running campaigns
   */
  async processDayTransition() {
    try {
      const currentUTCDay = this.getCurrentUTCDay();
      logger.info('🌅 Processing day transition', { currentUTCDay });

      // Find all running campaigns
      const runningCampaigns = await Campaign.find({ status: 'running' });

      if (runningCampaigns.length === 0) {
        logger.info('ℹ️ No running campaigns to process');
        return;
      }

      logger.info(`📊 Found ${runningCampaigns.length} running campaign(s)`);

      for (const campaign of runningCampaigns) {
        await this.transitionCampaignDay(campaign, currentUTCDay);
      }

      logger.info('✅ Day transition processing completed');
    } catch (error) {
      logger.error('❌ Error processing day transition:', error);
    }
  }

  /**
   * Transition a specific campaign to the next day if needed
   */
  async transitionCampaignDay(campaign, currentUTCDay) {
    try {
      const campaignId = campaign._id;
      const startedOnUTCDay = campaign.progress.startedOnUTCDay;
      const lastTransitionDay = campaign.progress.lastDayTransitionAt 
        ? new Date(campaign.progress.lastDayTransitionAt).toISOString().split('T')[0]
        : null;

      logger.info('🔄 Checking campaign for day transition', {
        campaignId,
        name: campaign.name,
        currentDay: campaign.progress.currentDay,
        startedOnUTCDay,
        lastTransitionDay,
        currentUTCDay
      });

      // If campaign was started today, no transition needed
      if (startedOnUTCDay === currentUTCDay) {
        logger.info('ℹ️ Campaign started today, no transition needed', { campaignId });
        return;
      }

      // If we already transitioned today, skip
      if (lastTransitionDay === currentUTCDay) {
        logger.info('ℹ️ Campaign already transitioned today', { campaignId });
        return;
      }

      // Calculate how many days have passed since campaign started
      const startDate = new Date(startedOnUTCDay + 'T00:00:00Z');
      const currentDate = new Date(currentUTCDay + 'T00:00:00Z');
      const daysPassed = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24));
      const newDay = daysPassed + 1;

      logger.info('📅 Transitioning campaign to new day', {
        campaignId,
        name: campaign.name,
        oldDay: campaign.progress.currentDay,
        newDay,
        daysPassed
      });

      // Remove any remaining jobs from the previous day
      await QueueService.removeCampaignJobs(campaignId);

      // Update campaign to new day
      await Campaign.findByIdAndUpdate(campaignId, {
        $set: {
          'progress.currentDay': newDay,
          'progress.lastDayTransitionAt': new Date()
        }
      });

      logger.info('✅ Campaign day transitioned successfully', {
        campaignId,
        name: campaign.name,
        newDay
      });

      // Trigger campaign processing for the new day
      const CampaignOrchestrator = require('./CampaignOrchestrator');
      await CampaignOrchestrator.processCampaign(campaignId);

      logger.info('✅ Campaign reprocessed for new day', {
        campaignId,
        newDay
      });

    } catch (error) {
      logger.error('❌ Error transitioning campaign day:', {
        campaignId: campaign._id,
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.isRunning = false;
      logger.info('⏹️ Day transition scheduler stopped');
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      currentUTCDay: this.getCurrentUTCDay()
    };
  }
}

module.exports = new DayTransitionScheduler();
