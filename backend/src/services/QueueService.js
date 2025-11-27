const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const logger = require('../utils/logger');
const EmailService = require('./EmailService');
const SentEmail = require('../models/SentEmail');
const Campaign = require('../models/Campaign');
const DailyCampaignStats = require('../models/DailyCampaignStats');
const AnalyticsService = require('./AnalyticsService');

class QueueService {
  constructor() {
    this.emailQueue = null;
    this.worker = null;
    this.isInitialized = false;
    this.io = null;
  }

  setSocketIO(io) {
    this.io = io;
    logger.info('✅ Socket.IO instance set for QueueService');
  }

  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Create Redis connection for BullMQ
      const bullRedis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null, // Required for BullMQ
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        }
      });

      // Create email queue
      this.emailQueue = new Queue('email-sending', {
        connection: bullRedis,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          },
          removeOnComplete: {
            age: 86400, // Keep completed jobs for 24 hours
            count: 1000
          },
          removeOnFail: {
            age: 604800 // Keep failed jobs for 7 days
          }
        }
      });

      this.worker = new Worker('email-sending', async (job) => {
        return await this.processEmailJob(job);
      }, {
        connection: bullRedis,
        concurrency: 50
      });

      // Worker event handlers
      this.worker.on('completed', async (job, result) => {
        logger.info('✅ Email job completed', {
          jobId: job.id,
          recipient: job.data.recipient.email,
          messageId: result.messageId
        });
      });

      this.worker.on('failed', async (job, err) => {
        logger.error('❌ Email job failed', {
          jobId: job.id,
          recipient: job.data?.recipient?.email,
          error: err.message,
          stack: err.stack
        });
      });

      this.worker.on('error', (err) => {
        logger.error('❌ Worker error:', err);
      });

      // Queue event handlers
      this.emailQueue.on('error', (err) => {
        logger.error('❌ Queue error:', err);
      });

      // Listen to job progress
      this.emailQueue.on('progress', (job, progress) => {
        logger.debug('📊 Job progress', {
          jobId: job.id,
          progress,
          recipient: job.data?.recipient?.email
        });
      });

      // Listen to delayed jobs being activated
      this.emailQueue.on('stalled', (jobId) => {
        logger.warn('⚠️ Job stalled', { jobId });
      });

      this.emailQueue.on('delayed', (job) => {
        logger.debug('⏰ Delayed job scheduled', {
          jobId: job.id,
          delay: job.opts.delay,
          delayMinutes: Math.round(job.opts.delay / 60000),
          recipient: job.data?.recipient?.email
        });
      });

      this.isInitialized = true;
      logger.info('✅ Queue service initialized successfully');

    } catch (error) {
      logger.error('❌ Failed to initialize queue service:', error);
      throw error;
    }
  }

  async processEmailJob(job) {
    const { campaignId, recipient, sender, templateName, metadata, templateData = {}, scheduledFor } = job.data;

    try {
      const existingSent = await SentEmail.findOne({
        campaign: campaignId,
        'recipient.email': recipient.email
      });

      if (existingSent) {
        logger.warn('⚠️  Email already sent, skipping', {
          recipient: recipient.email,
          campaign: campaignId
        });
        return { skipped: true, reason: 'duplicate' };
      }

      // Safety: skip if campaign is not running
      const campaignDoc = await Campaign.findById(campaignId).select('status pausedAt configuration.enableListUnsubscribe configuration.unsubscribeUrl');
      if (!campaignDoc || campaignDoc.status !== 'running') {
        logger.warn('⚠️  Skipping job because campaign is not running', {
          campaign: campaignId,
          state: campaignDoc ? campaignDoc.status : 'not_found'
        });
        return { skipped: true, reason: 'campaign_not_running' };
      }

      // Safety: skip if job is stale (scheduled for a past day or too old)
      if (scheduledFor) {
        const scheduledTime = new Date(scheduledFor);
        const now = new Date();
        const sameDay = scheduledTime.toDateString() === now.toDateString();
        const ageMs = now - scheduledTime;
        // Consider jobs stale if not same calendar day or older than 2 hours
        if (!sameDay || ageMs > 2 * 60 * 60 * 1000) {
          logger.warn('⚠️  Skipping stale email job', {
            jobId: job.id,
            scheduledFor,
            now: now.toISOString(),
            ageMinutes: Math.round(ageMs / 60000)
          });
          return { skipped: true, reason: 'stale_job' };
        }
      }

      const sentEmail = new SentEmail({
        campaign: campaignId,
        recipient,
        sender,
        templateName: templateName,
        status: 'queued',
        metadata: {
          ...metadata,
          queuedAt: new Date(),
          attemptNumber: job.attemptsMade + 1
        }
      });

      await sentEmail.save();

      const startTime = Date.now();
      const result = await EmailService.sendEmailWithTemplate({
        to: recipient.email,
        from: sender.email,
        templateName: templateName,
        templateData: templateData,
        enableListUnsubscribe: campaignDoc.configuration?.enableListUnsubscribe || false,
        unsubscribeUrl: campaignDoc.configuration?.unsubscribeUrl || null,
        campaignId: campaignId
      });

      const processingTime = Date.now() - startTime;

      sentEmail.status = 'sent';
      sentEmail.messageId = result.MessageId;
      sentEmail.deliveryStatus.sentAt = new Date();
      sentEmail.metadata.processingTime = processingTime;
      await sentEmail.save();

      const campaign = await Campaign.findByIdAndUpdate(campaignId, {
        $inc: { 'progress.totalSent': 1 },
        $set: { 'progress.lastSentAt': new Date() }
      }, { new: true });

      await AnalyticsService.recordEmailSent(campaignId, metadata.day, metadata.hour, sender.email, recipient.domain);

      // Track daily stats
      await this.updateDailyStats(campaignId, 'sent', sender.email, sender.domain, recipient.domain, metadata.hour, metadata.day);
      if (this.io && campaign && campaign.progress) {
        this.io.to(`campaign-${campaignId}`).emit(`campaign-${campaignId}-update`, {
          type: 'email_sent',
          emailStats: {
            sent: campaign.progress.totalSent,
            delivered: campaign.progress.totalDelivered,
            failed: campaign.progress.totalFailed,
            queued: await this.getQueueStats().then(s => s.waiting)
          },
          timestamp: new Date()
        });
      }

      return {
        success: true,
        messageId: result.MessageId,
        processingTime
      };

    } catch (error) {
      logger.error('❌ Error processing email job:', {
        error: error.message,
        recipient: recipient.email,
        campaign: campaignId
      });

      // Update sent email with error
      await SentEmail.findOneAndUpdate(
        { campaign: campaignId, 'recipient.email': recipient.email },
        {
          status: 'failed',
          'deliveryStatus.failedAt': new Date(),
          errorDetails: {
            code: error.code,
            message: error.message,
            timestamp: new Date()
          }
        }
      );

      const campaign = await Campaign.findByIdAndUpdate(campaignId, {
        $inc: { 'progress.totalFailed': 1 }
      }, { new: true });

      // Track daily stats for failed emails
      await this.updateDailyStats(campaignId, 'failed', sender.email, sender.domain, recipient.domain, metadata.hour, metadata.day);

      if (this.io && campaign && campaign.progress) {
        this.io.to(`campaign-${campaignId}`).emit(`campaign-${campaignId}-update`, {
          type: 'email_failed',
          emailStats: {
            sent: campaign.progress.totalSent,
            delivered: campaign.progress.totalDelivered,
            failed: campaign.progress.totalFailed,
            queued: await this.getQueueStats().then(s => s.waiting)
          },
          timestamp: new Date()
        });
      }

      throw error;
    }
  }

  async addEmailToQueue(emailData) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const job = await this.emailQueue.add('send-email', emailData, {
        priority: emailData.priority || 5,
        delay: emailData.delay || 0
      });

      logger.debug('📬 Email added to queue', {
        jobId: job.id,
        recipient: emailData.recipient.email
      });

      return job;

    } catch (error) {
      logger.error('❌ Failed to add email to queue:', error);
      throw error;
    }
  }

  async addBulkEmailsToQueue(emailsData) {
    logger.info('📬 Adding bulk emails to queue', {
      count: emailsData.length,
      isInitialized: this.isInitialized
    });

    if (!this.isInitialized) {
      logger.info('🔄 Initializing queue service...');
      await this.initialize();
    }

    try {
      const jobs = emailsData.map(email => ({
        name: 'send-email',
        data: email,
        opts: {
          priority: email.priority || 5,
          delay: email.delay || 0
        }
      }));

      logger.info('📬 Adding jobs to queue', {
        jobCount: jobs.length,
        sampleJob: jobs[0]
      });

      const addedJobs = await this.emailQueue.addBulk(jobs);

      logger.info('✅ Bulk emails added to queue successfully', {
        count: addedJobs.length,
        queueName: 'email-sending'
      });

      return addedJobs;

    } catch (error) {
      logger.error('❌ Failed to add bulk emails to queue:', {
        error: error.message,
        stack: error.stack,
        jobCount: emailsData.length
      });
      throw error;
    }
  }

  async getQueueStats() {
    if (!this.isInitialized) {
      return null;
    }

    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.emailQueue.getWaitingCount(),
        this.emailQueue.getActiveCount(),
        this.emailQueue.getCompletedCount(),
        this.emailQueue.getFailedCount(),
        this.emailQueue.getDelayedCount()
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed
      };

    } catch (error) {
      logger.error('❌ Failed to get queue stats:', error);
      return null;
    }
  }

  async getCampaignQueueStats(campaignId) {
    if (!this.isInitialized) {
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        total: 0
      };
    }

    try {
      // Get all jobs from different states
      const [waiting, active, delayed, completed, failed] = await Promise.all([
        this.emailQueue.getWaiting(),
        this.emailQueue.getActive(),
        this.emailQueue.getDelayed(),
        this.emailQueue.getCompleted(),
        this.emailQueue.getFailed()
      ]);

      // Filter jobs by campaignId (convert both to strings for comparison)
      const campaignIdStr = campaignId.toString();
      const filterByCampaign = (jobs) => {
        return jobs.filter(job => {
          const jobCampaignId = job.data.campaignId ? job.data.campaignId.toString() : null;
          return jobCampaignId === campaignIdStr;
        });
      };

      const campaignWaiting = filterByCampaign(waiting).length;
      const campaignActive = filterByCampaign(active).length;
      const campaignDelayed = filterByCampaign(delayed).length;
      const campaignCompleted = filterByCampaign(completed).length;
      const campaignFailed = filterByCampaign(failed).length;

      const total = campaignWaiting + campaignActive + campaignDelayed + campaignCompleted + campaignFailed;

      logger.debug('📊 Campaign-specific queue stats', {
        campaignId,
        waiting: campaignWaiting,
        active: campaignActive,
        delayed: campaignDelayed,
        completed: campaignCompleted,
        failed: campaignFailed,
        total
      });

      return {
        waiting: campaignWaiting,
        active: campaignActive,
        completed: campaignCompleted,
        failed: campaignFailed,
        delayed: campaignDelayed,
        total
      };

    } catch (error) {
      logger.error('❌ Failed to get campaign queue stats:', error);
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        total: 0
      };
    }
  }

  async pauseQueue() {
    if (this.emailQueue) {
      await this.emailQueue.pause();
      logger.info('⏸️  Email queue paused');
    }
  }

  async resumeQueue() {
    if (this.emailQueue) {
      await this.emailQueue.resume();
      logger.info('▶️  Email queue resumed');
    }
  }

  async removeCampaignJobs(campaignId) {
    if (!this.isInitialized) {
      return;
    }

    try {
      const campaignIdStr = campaignId.toString();
      let removedCount = 0;

      // Get all job states
      const [waiting, active, delayed] = await Promise.all([
        this.emailQueue.getWaiting(),
        this.emailQueue.getActive(),
        this.emailQueue.getDelayed()
      ]);

      // Remove from waiting
      for (const job of waiting) {
        const jobCampaignId = job.data.campaignId ? job.data.campaignId.toString() : null;
        if (jobCampaignId === campaignIdStr) {
          await job.remove();
          removedCount++;
        }
      }

      // Remove from active
      for (const job of active) {
        const jobCampaignId = job.data.campaignId ? job.data.campaignId.toString() : null;
        if (jobCampaignId === campaignIdStr) {
          await job.remove();
          removedCount++;
        }
      }

      // Remove from delayed
      for (const job of delayed) {
        const jobCampaignId = job.data.campaignId ? job.data.campaignId.toString() : null;
        if (jobCampaignId === campaignIdStr) {
          await job.remove();
          removedCount++;
        }
      }

      logger.info('🗑️  Removed campaign jobs from queue', {
        campaignId,
        removedCount
      });

    } catch (error) {
      logger.error('❌ Failed to remove campaign jobs:', error);
    }
  }

  async clearQueue() {
    if (this.emailQueue) {
      await this.emailQueue.drain();
      logger.info('🗑️  Email queue cleared');
    }
  }

  async checkStatus() {
    const status = {
      isInitialized: this.isInitialized,
      hasQueue: !!this.emailQueue,
      hasWorker: !!this.worker,
      redisConfig: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        hasPassword: !!process.env.REDIS_PASSWORD
      }
    };

    if (this.emailQueue) {
      try {
        const waiting = await this.emailQueue.getWaiting();
        const active = await this.emailQueue.getActive();
        const delayed = await this.emailQueue.getDelayed();
        const completed = await this.emailQueue.getCompleted();
        const failed = await this.emailQueue.getFailed();

        status.queueStats = {
          waiting: waiting.length,
          active: active.length,
          delayed: delayed.length,
          completed: completed.length,
          failed: failed.length,
          total: waiting.length + active.length + delayed.length + completed.length + failed.length
        };

        // Show sample delayed jobs
        if (delayed.length > 0) {
          const sampleDelayed = delayed.slice(0, 3);
          status.sampleDelayedJobs = sampleDelayed.map(job => ({
            id: job.id,
            delay: job.opts.delay,
            delayMinutes: Math.round(job.opts.delay / 60000),
            scheduledFor: new Date(Date.now() + job.opts.delay).toISOString(),
            recipient: job.data.recipient?.email,
            hour: job.data.metadata?.hour,
            minute: job.data.metadata?.minute
          }));
        }
      } catch (error) {
        logger.error('❌ Error getting queue stats:', error);
        status.error = error.message;
      }
    }

    return status;
  }

  async getJobStatus(jobId) {
    if (!this.emailQueue) {
      throw new Error('Queue not initialized');
    }

    try {
      const job = await this.emailQueue.getJob(jobId);
      if (!job) {
        return { state: 'not_found', message: 'Job not found' };
      }

      return {
        id: job.id,
        state: await job.getState(),
        progress: job.progress,
        data: job.data,
        returnvalue: job.returnvalue,
        failedReason: job.failedReason,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn
      };
    } catch (error) {
      logger.error('❌ Error getting job status:', error);
      throw error;
    }
  }

  async updateDailyStats(campaignId, statType, senderEmail, senderDomain, recipientDomain, hour, campaignDay) {
    try {
      const now = new Date();
      const dateString = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const date = new Date(dateString);

      // Find or create daily stats document
      let dailyStats = await DailyCampaignStats.findOne({
        campaign: campaignId,
        dateString: dateString
      });

      if (!dailyStats) {
        dailyStats = new DailyCampaignStats({
          campaign: campaignId,
          date: date,
          dateString: dateString,
          campaignDay: campaignDay || 1,
          stats: {
            totalScheduled: 0,
            totalSent: 0,
            totalFailed: 0,
            totalQueued: 0
          },
          senderBreakdown: [],
          hourlyBreakdown: [],
          recipientDomainBreakdown: []
        });
      }

      // Update stats using the model method
      dailyStats.incrementStat(statType, senderEmail, senderDomain, recipientDomain, hour);

      await dailyStats.save();

      logger.debug('📊 Daily stats updated', {
        campaignId,
        dateString,
        statType,
        senderEmail,
        hour
      });

    } catch (error) {
      logger.error('❌ Failed to update daily stats:', {
        error: error.message,
        campaignId,
        statType
      });
      // Don't throw - we don't want to fail email sending if stats tracking fails
    }
  }

  async shutdown() {
    try {
      if (this.worker) {
        await this.worker.close();
        logger.info('Worker closed');
      }
      if (this.emailQueue) {
        await this.emailQueue.close();
        logger.info('Queue closed');
      }
      this.isInitialized = false;
    } catch (error) {
      logger.error('Error shutting down queue service:', error);
    }
  }
}

module.exports = new QueueService();
