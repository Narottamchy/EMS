const Campaign = require('../models/Campaign');
const SentEmail = require('../models/SentEmail');
const QueueService = require('./QueueService');
const logger = require('../utils/logger');
const AWS = require('aws-sdk');
const csv = require('csv-parser');
const {
  generateDailyTotal,
  generateDomainDistribution,
  generateEmailDistribution,
  generateHourlyDistribution,
  generateMinuteDistribution
} = require('../utils/randomization');

class CampaignOrchestrator {
  constructor() {
    this.activeCampaigns = new Map();
    this.s3 = new AWS.S3({
      region: process.env.AWS_REGION || 'us-east-1'
    });
  }

  // Helper method to randomly select a template from multiple templates
  getRandomTemplate(campaign) {
    const templates = campaign.templateNames && campaign.templateNames.length > 0 
      ? campaign.templateNames 
      : [campaign.templateName];
    
    return templates[Math.floor(Math.random() * templates.length)];
  }

  async startCampaign(campaignId, userId) {
    try {
      const campaign = await Campaign.findById(campaignId);
      
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      if (campaign.status === 'running') {
        throw new Error('Campaign is already running');
      }

      if (campaign.status === 'completed') {
        throw new Error('Campaign is already completed');
      }

      // Update campaign status
      campaign.status = 'running';
      campaign.startedBy = userId;
      campaign.startedAt = new Date();
      
      // Set the UTC day when campaign started for day transition tracking
      const startedOnUTCDay = new Date().toISOString().split('T')[0];
      campaign.progress.startedOnUTCDay = startedOnUTCDay;
      campaign.progress.lastDayTransitionAt = new Date();
      
      await campaign.save();

      // Initialize campaign in memory
      this.activeCampaigns.set(campaignId.toString(), {
        id: campaignId,
        status: 'running',
        startedAt: new Date()
      });

      // Safety: purge any existing queued/delayed jobs for this campaign
      await QueueService.removeCampaignJobs(campaignId);

      logger.info('🚀 Campaign started', {
        campaignId,
        name: campaign.name,
        startedBy: userId
      });

      // Start processing campaign (fire and forget with error handling)
      setImmediate(() => {
        this.processCampaign(campaignId).catch(error => {
          logger.error('❌ Campaign processing failed:', error);
          Campaign.findByIdAndUpdate(campaignId, {
            status: 'failed',
            failedAt: new Date(),
            errorMessage: error.message
          }).catch(err => {
            logger.error('❌ Failed to update campaign status:', err);
          });
        });
      });

      return campaign;

    } catch (error) {
      logger.error('❌ Failed to start campaign:', error);
      throw error;
    }
  }

  async processCampaign(campaignId) {
    try {
      logger.info('🔄 Starting campaign processing', { 
        campaignId: campaignId.toString(),
        timestamp: new Date().toISOString()
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      logger.info('⏰ Delay completed, fetching campaign', { campaignId });
      
      const campaign = await Campaign.findById(campaignId).populate('configuration.customEmailListId');
      
      if (!campaign) {
        logger.error('❌ Campaign not found in database', { campaignId });
        throw new Error('Campaign not found');
      }

      logger.info('📋 Campaign found', {
        campaignId,
        name: campaign.name,
        status: campaign.status,
        currentDay: campaign.progress.currentDay,
        emailListSource: campaign.configuration.emailListSource,
        warmupMode: campaign.configuration.warmupMode?.enabled,
        hasConfiguration: !!campaign.configuration,
        hasDomains: campaign.configuration?.domains?.length > 0
      });

      // Get email list based on source (global or custom)
      const emailList = await this.getEmailListForCampaign(campaign);
      logger.info('📧 Email list fetched', { 
        totalEmails: emailList.length,
        source: campaign.configuration.emailListSource 
      });
      
      if (emailList.length === 0) {
        throw new Error('No emails found in S3 email list');
      }
      
      // Check emails sent - if warmup mode is enabled, only check THIS campaign
      // Otherwise, check across ALL campaigns for global deduplication
      const sentEmailQuery = campaign.configuration.warmupMode?.enabled 
        ? { campaign: campaignId }  // Warmup mode: only check this campaign
        : {};                        // Normal mode: check all campaigns
      
      const sentEmails = await SentEmail.find(sentEmailQuery)
        .select('recipient.email');

      const sentEmailSet = new Set(sentEmails.map(e => e.recipient.email));
      const unsubscribedList = await this.getUnsubscribedList();
      const unsubscribedSet = new Set(unsubscribedList);

      let recipientsToSend = emailList.filter(email => 
        !sentEmailSet.has(email) && !unsubscribedSet.has(email)
      );

      logger.info('📊 Email filtering results', {
        campaignId,
        warmupMode: campaign.configuration.warmupMode?.enabled,
        totalInList: emailList.length,
        alreadySent: sentEmailSet.size,
        unsubscribed: unsubscribedSet.size,
        availableToSend: recipientsToSend.length,
        sentCheckScope: campaign.configuration.warmupMode?.enabled ? 'this_campaign_only' : 'all_campaigns'
      });

      // In warmup mode, if we've exhausted the list, reset and start over
      if (campaign.configuration.warmupMode?.enabled && recipientsToSend.length === 0) {
        logger.info('🔄 Warmup mode: All emails sent, resetting sent emails for this campaign to restart cycle');
        
        // Delete all sent emails for this campaign to restart the cycle
        await SentEmail.deleteMany({ campaign: campaignId });
        
        // Reset the warmup index
        await Campaign.findByIdAndUpdate(campaignId, {
          'configuration.warmupMode.currentIndex': 0
        });
        
        // Recalculate available recipients (all emails minus unsubscribed)
        recipientsToSend = emailList.filter(email => !unsubscribedSet.has(email));
        
        logger.info('✅ Warmup mode: Reset complete', {
          campaignId,
          availableToSend: recipientsToSend.length
        });
      }

      // Apply warmup mode if enabled
      if (campaign.configuration.warmupMode?.enabled) {
        recipientsToSend = await this.applyWarmupMode(campaign, recipientsToSend);
      }

      logger.info('📊 Campaign processing summary', {
        campaignId,
        totalRecipients: emailList.length,
        alreadySent: sentEmailSet.size,
        unsubscribed: unsubscribedSet.size,
        toSend: recipientsToSend.length,
        warmupMode: campaign.configuration.warmupMode?.enabled
      });

      if (recipientsToSend.length === 0) {
        logger.warn('⚠️ No recipients to send to');
        return;
      }

      const dailyPlan = this.generateDailyPlan(
        campaign.configuration,
        campaign.progress.currentDay,
        recipientsToSend.length
      );
      
      logger.info('📅 Daily plan generated', {
        day: dailyPlan.day,
        totalEmails: dailyPlan.totalEmails
      });

      // Calculate global stats (across all campaigns)
      await this.storeCampaignPlan(campaignId, dailyPlan, {
        totalEmails: emailList.length,
        alreadySent: sentEmailSet.size,
        unsubscribed: unsubscribedSet.size,
        availableToSend: recipientsToSend.length,
        alreadySentGlobal: sentEmailSet.size, // Emails that have received ANY campaign
        availableToSendGlobal: recipientsToSend.length // Emails that haven't received ANY campaign
      });

      await this.scheduleEmails(campaign, dailyPlan, recipientsToSend);

      logger.info('✅ Campaign emails scheduled successfully', {
        campaignId,
        emailsScheduled: dailyPlan.totalEmails,
        recipientsUsed: recipientsToSend.length
      });

    } catch (error) {
      logger.error('❌ Failed to process campaign:', error);
      
      // Update campaign status to failed
      await Campaign.findByIdAndUpdate(campaignId, {
        status: 'failed',
        failedAt: new Date(),
        errorMessage: error.message
      });

      this.activeCampaigns.delete(campaignId.toString());
    }
  }

  async scheduleEmails(campaign, dailyPlan, recipients) {
    logger.info('📬 Starting email scheduling', {
      campaignId: campaign._id,
      totalRecipients: recipients.length,
      dailyPlan: dailyPlan.totalEmails
    });

    const emailJobs = [];
    const senderEmails = this.generateSenderEmails(campaign.configuration);
    let recipientIndex = 0;

    logger.info('📧 Generated sender emails', {
      count: senderEmails.length,
      senders: senderEmails.slice(0, 5)
    });

    // Calculate end of current UTC day
    const now = new Date();
    const endOfUTCDay = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      23, 59, 59, 999
    ));

    logger.info('⏰ Scheduling window', {
      now: now.toISOString(),
      endOfUTCDay: endOfUTCDay.toISOString(),
      currentUTCHour: now.getUTCHours()
    });

    for (const domainPlan of dailyPlan.domains) {
      for (const emailPlan of domainPlan.emails) {
        for (const hourPlan of emailPlan.hours) {
          const emailsThisHour = hourPlan.count;
          
          // Use the advanced minute distribution from the plan
          const minuteDistribution = hourPlan.minutes || this.distributeAcrossHour(emailsThisHour);

          for (let minute = 0; minute < 60; minute++) {
            const emailsThisMinute = minuteDistribution[minute] || 0;
            
            for (let i = 0; i < emailsThisMinute; i++) {
              if (recipientIndex >= recipients.length) break;

              const recipient = recipients[recipientIndex++];
              const recipientDomain = recipient.split('@')[1];

              const currentUTCHour = now.getUTCHours();
              const currentUTCMinute = now.getUTCMinutes();
              
              // Create scheduled time in UTC
              let scheduledTime = new Date(Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate(),
                hourPlan.hour,
                minute,
                0,
                0
              ));
              
              const emailsInThisMinute = minuteDistribution[minute] || 0;
              const emailIndexInMinute = i;
              const secondsOffset = emailsInThisMinute > 1 
                ? Math.floor((emailIndexInMinute * 60) / emailsInThisMinute) 
                : 0;
              
              scheduledTime.setUTCSeconds(secondsOffset);
              
              // If scheduled time is in the past or beyond current UTC day, skip
              if (scheduledTime <= now) {
                // Skip past times
                continue;
              }
              
              if (scheduledTime > endOfUTCDay) {
                // Skip times beyond current UTC day - they'll be scheduled tomorrow
                continue;
              }
              
              const delay = Math.max(0, scheduledTime - now);

              // Randomly select a template if multiple templates are available
              const selectedTemplate = this.getRandomTemplate(campaign);
              
              emailJobs.push({
                campaignId: campaign._id,
                recipient: {
                  email: recipient,
                  domain: recipientDomain
                },
                sender: {
                  email: emailPlan.email,
                  domain: domainPlan.domain
                },
                templateName: selectedTemplate,
                templateData: {
                  recipientName: recipient.split('@')[0],
                  recipientEmail: recipient,
                  campaignName: campaign.name,
                  day: campaign.progress.currentDay,
                  ...this.processTemplateData(campaign.configuration?.templateData || {}, {
                    recipientName: recipient.split('@')[0],
                    recipientEmail: recipient,
                    campaignName: campaign.name,
                    day: campaign.progress.currentDay
                  })
                },
                metadata: {
                  day: campaign.progress.currentDay,
                  hour: hourPlan.hour,
                  minute: minute,
                  second: secondsOffset
                },
                delay: delay,
                priority: 5,
                scheduledFor: scheduledTime.toISOString()
              });
            }
          }
        }
      }
    }

    logger.info('📬 Email jobs created', { 
      totalJobs: emailJobs.length,
      recipientsProcessed: recipientIndex,
      totalRecipients: recipients.length
    });

    if (emailJobs.length === 0) {
      logger.warn('⚠️ No email jobs created - all times may be in the past or beyond current UTC day');
      return;
    }

    const batchSize = 1000;

    for (let i = 0; i < emailJobs.length; i += batchSize) {
      const batch = emailJobs.slice(i, i + batchSize);
      await QueueService.addBulkEmailsToQueue(batch);
      logger.info(`📦 Batch ${Math.floor(i/batchSize) + 1} added to queue`, {
        batchSize: batch.length,
        progress: `${i + batch.length}/${emailJobs.length}`
      });
    }

    logger.info('🎉 All email jobs added to queue successfully', {
      totalJobs: emailJobs.length
    });
  }

  distributeAcrossHour(totalEmails) {
    const distribution = new Map();
    const basePerMinute = Math.floor(totalEmails / 60);
    const remainder = totalEmails % 60;

    // Give each minute the base amount
    for (let minute = 0; minute < 60; minute++) {
      distribution.set(minute, basePerMinute);
    }

    // Distribute remainder evenly
    if (remainder > 0) {
      const spacing = Math.floor(60 / remainder);
      for (let i = 0; i < remainder; i++) {
        const minute = i * spacing;
        distribution.set(minute, distribution.get(minute) + 1);
      }
    }

    return distribution;
  }

  generateDailyPlan(config, day, totalRecipients) {
    const { 
      domains, 
      baseDailyTotal, 
      maxEmailPercentage = 35, 
      randomizationIntensity = 0.7,
      quotaDays = 30,
      targetSum = 450000
    } = config;
    
    // Calculate emailsPerDomain based on configured sender emails
    const emailsPerDomain = this.calculateEmailsPerDomain(config);
    
    // Use advanced target-based daily total generation
    const dailyTotal = Math.min(
      generateDailyTotal(baseDailyTotal, day, quotaDays, targetSum),
      totalRecipients
    );

    const plan = {
      day,
      totalEmails: dailyTotal,
      domains: []
    };

    // Generate domain distribution using advanced logic
    const domainDistribution = generateDomainDistribution(dailyTotal, domains.length);

    for (let domainIndex = 0; domainIndex < domains.length; domainIndex++) {
      const domain = domains[domainIndex];
      const domainEmails = domainDistribution[domainIndex];
      
      const domainPlan = {
        domain,
        totalEmails: domainEmails,
        emails: []
      };

      // Generate email distribution within domain using advanced logic
      const emailDistribution = generateEmailDistribution(
        domainEmails, 
        emailsPerDomain, 
        maxEmailPercentage, 
        randomizationIntensity
      );

      // Get sender emails (custom or generated)
      const senderEmails = this.generateSenderEmails(config);
      const domainSenderEmails = senderEmails.filter(email => email.includes(domain));

      for (let emailIndex = 0; emailIndex < emailsPerDomain; emailIndex++) {
        const emailCount = emailDistribution[emailIndex];
        const senderEmail = domainSenderEmails[emailIndex] || `sender${emailIndex + 1}@${domain}`;
        
        // Generate hourly distribution using advanced logic
        const hourlyDistribution = generateHourlyDistribution(emailCount, randomizationIntensity);
        
        // Convert hourly distribution to the format expected by the system
        const hours = [];
        for (let hour = 0; hour < 24; hour++) {
          if (hourlyDistribution[hour] > 0) {
            hours.push({ 
              hour, 
              count: hourlyDistribution[hour],
              minutes: generateMinuteDistribution(hourlyDistribution[hour])
            });
          }
        }

        const emailPlan = {
          email: senderEmail,
          totalEmails: emailCount,
          hours: hours
        };

        domainPlan.emails.push(emailPlan);
      }

      plan.domains.push(domainPlan);
    }

    return plan;
  }

  generateHourlyDistribution(totalEmails) {
    const activeHours = 8; // 8 active hours per day
    const hours = [];
    const basePerHour = Math.floor(totalEmails / activeHours);
    const remainder = totalEmails % activeHours;

    // Random starting hour between 8 AM and 4 PM
    const startHour = 8 + Math.floor(Math.random() * 8);

    for (let i = 0; i < activeHours; i++) {
      const hour = (startHour + i) % 24;
      const count = basePerHour + (i < remainder ? 1 : 0);
      
      if (count > 0) {
        hours.push({ hour, count });
      }
    }

    return hours;
  }

  calculateEmailsPerDomain(config) {
    // If custom sender emails are configured, calculate based on them
    if (config.senderEmails && config.senderEmails.length > 0) {
      const emailsPerDomainMap = {};
      
      // Count sender emails per domain
      config.senderEmails.forEach(sender => {
        if (sender.isActive) {
          const domain = sender.domain;
          emailsPerDomainMap[domain] = (emailsPerDomainMap[domain] || 0) + 1;
        }
      });
      
      // Return the maximum count across all domains
      return Math.max(...Object.values(emailsPerDomainMap), 1);
    }
    
    // Fallback to default if no custom sender emails
    return 5; // Default value
  }

  generateSenderEmails(config) {
    // If custom sender emails are configured, use them
    if (config.senderEmails && config.senderEmails.length > 0) {
      return config.senderEmails
        .filter(sender => sender.isActive)
        .map(sender => sender.email);
    }
    
    // Fallback to generated sender emails if no custom ones are provided
    const emailsPerDomain = this.calculateEmailsPerDomain(config);
    const senders = [];
    for (const domain of config.domains) {
      for (let i = 1; i <= emailsPerDomain; i++) {
        senders.push(`sender${i}@${domain}`);
      }
    }

    return senders;
  }

  async pauseCampaign(campaignId) {
    try {
      const campaign = await Campaign.findById(campaignId);
      
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      if (campaign.status !== 'running') {
        throw new Error('Campaign is not running');
      }

      campaign.status = 'paused';
      campaign.pausedAt = new Date();
      await campaign.save();

      // DO NOT pause the global queue - this affects all campaigns
      // Instead, we'll remove jobs from the queue for this specific campaign
      await QueueService.removeCampaignJobs(campaignId);

      this.activeCampaigns.delete(campaignId.toString());

      logger.info('⏸️  Campaign paused', { campaignId });

      return campaign;

    } catch (error) {
      logger.error('❌ Failed to pause campaign:', error);
      throw error;
    }
  }

  async resumeCampaign(campaignId, userId) {
    try {
      const campaign = await Campaign.findById(campaignId);
      
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      if (campaign.status !== 'paused') {
        throw new Error('Campaign is not paused');
      }

      campaign.status = 'running';
      campaign.pausedAt = null;
      await campaign.save();

      // Initialize campaign in memory
      this.activeCampaigns.set(campaignId.toString(), {
        id: campaignId,
        status: 'running',
        resumedAt: new Date()
      });

      // Safety: purge any existing queued/delayed jobs for this campaign
      // This ensures we don't send stale emails from when it was paused
      await QueueService.removeCampaignJobs(campaignId);

      // Resume using existing plan if available, otherwise generate new plan
      await this.resumeCampaignWithExistingPlan(campaignId).catch(error => {
        logger.error('❌ Campaign resume failed:', error);
        Campaign.findByIdAndUpdate(campaignId, {
          status: 'failed',
          failedAt: new Date(),
          errorMessage: error.message
        });
      });

      logger.info('▶️  Campaign resumed', { campaignId });

      return campaign;

    } catch (error) {
      logger.error('❌ Failed to resume campaign:', error);
      throw error;
    }
  }

  async resumeCampaignWithExistingPlan(campaignId) {
    try {
      const campaign = await Campaign.findById(campaignId).populate('configuration.customEmailListId');
      
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Check if campaign has an existing plan for current day
      const currentDay = campaign.progress.currentDay;
      const existingPlan = campaign.campaignPlan?.dailyPlans?.find(plan => plan.day === currentDay);

      if (existingPlan) {
        logger.info('📋 Resuming campaign with existing plan', {
          campaignId,
          currentDay,
          totalEmails: existingPlan.totalEmails
        });

        // Get email list based on source (global or custom)
        const emailList = await this.getEmailListForCampaign(campaign);
        
        // Check emails sent - if warmup mode is enabled, only check THIS campaign
        // Otherwise, check across ALL campaigns for global deduplication
        const sentEmailQuery = campaign.configuration.warmupMode?.enabled 
          ? { campaign: campaignId }  // Warmup mode: only check this campaign
          : {};                        // Normal mode: check all campaigns
        
        const allSentEmails = await SentEmail.find(sentEmailQuery)
          .select('recipient.email');
        const sentEmailSet = new Set(allSentEmails.map(e => e.recipient.email));
        const unsubscribedList = await this.getUnsubscribedList();
        const unsubscribedSet = new Set(unsubscribedList);

        let recipientsToSend = emailList.filter(email => 
          !sentEmailSet.has(email) && !unsubscribedSet.has(email)
        );

        // In warmup mode, if we've exhausted the list, reset and start over
        if (campaign.configuration.warmupMode?.enabled && recipientsToSend.length === 0) {
          logger.info('🔄 Warmup mode (resume): All emails sent, resetting sent emails for this campaign to restart cycle');
          
          // Delete all sent emails for this campaign to restart the cycle
          await SentEmail.deleteMany({ campaign: campaignId });
          
          // Reset the warmup index
          await Campaign.findByIdAndUpdate(campaignId, {
            'configuration.warmupMode.currentIndex': 0
          });
          
          // Recalculate available recipients (all emails minus unsubscribed)
          recipientsToSend = emailList.filter(email => !unsubscribedSet.has(email));
          
          logger.info('✅ Warmup mode (resume): Reset complete', {
            campaignId,
            availableToSend: recipientsToSend.length
          });
        }

        if (recipientsToSend.length === 0) {
          logger.warn('⚠️ No recipients to send to on resume');
          return;
        }

        // Schedule emails using the existing plan structure
        await this.scheduleEmails(campaign, existingPlan, recipientsToSend);

        logger.info('✅ Campaign resumed with existing plan', {
          campaignId,
          emailsScheduled: existingPlan.totalEmails,
          recipientsUsed: recipientsToSend.length
        });
      } else {
        // No existing plan, generate a new one
        logger.info('📋 No existing plan found, generating new plan', {
          campaignId,
          currentDay
        });
        await this.processCampaign(campaignId);
      }

    } catch (error) {
      logger.error('❌ Failed to resume campaign with existing plan:', error);
      throw error;
    }
  }

  async getEmailList() {
    try {
      const params = {
        Bucket: process.env.S3_BUCKET,
        Key: process.env.EMAIL_LIST_KEY
      };

      logger.info('📧 Fetching email list from S3', {
        bucket: process.env.S3_BUCKET,
        key: process.env.EMAIL_LIST_KEY
      });

      const stream = this.s3.getObject(params).createReadStream();
      const emails = [];

      return new Promise((resolve, reject) => {
        let firstRow = true;
        stream
          .pipe(csv())
          .on('data', (row) => {
            // Log the first row to see column names
            if (firstRow) {
              logger.info('📧 CSV columns found:', Object.keys(row));
              firstRow = false;
            }
            
            // Check for different possible column names
            const email = row.email || row.Email || row.EMAIL;
            if (email) {
              emails.push(email.toLowerCase().trim());
            }
          })
          .on('end', () => {
            const uniqueEmails = [...new Set(emails)]; // Remove duplicates
            logger.info('📧 Email list loaded successfully', {
              totalEmails: uniqueEmails.length,
              sampleEmails: uniqueEmails.slice(0, 5)
            });
            resolve(uniqueEmails);
          })
          .on('error', (error) => {
            logger.error('❌ Failed to read email list from S3:', error);
            reject(error);
          });
      });

    } catch (error) {
      logger.error('❌ Failed to get email list from S3:', {
        error: error.message,
        bucket: process.env.S3_BUCKET,
        key: process.env.EMAIL_LIST_KEY
      });
      throw error;
    }
  }

  async getUnsubscribedList() {
    try {
      const params = {
        Bucket: process.env.S3_BUCKET,
        Key: process.env.UNSUBSCRIBED_KEY
      };

      const data = await this.s3.getObject(params).promise();
      const content = data.Body.toString('utf-8');
      
      return content
        .split('\n')
        .map(email => email.toLowerCase().trim())
        .filter(email => email.length > 0);

    } catch (error) {
      if (error.code === 'NoSuchKey') {
        return [];
      }
      logger.error('❌ Failed to get unsubscribed list from S3:', error);
      throw error;
    }
  }

  isCampaignActive(campaignId) {
    return this.activeCampaigns.has(campaignId.toString());
  }

  getActiveCampaigns() {
    return Array.from(this.activeCampaigns.values());
  }

  async storeCampaignPlan(campaignId, dailyPlan, emailListStats) {
    try {
      // First, ensure the campaignPlan object exists
      await Campaign.findByIdAndUpdate(campaignId, {
        $setOnInsert: {
          'campaignPlan.totalRecipients': 0,
          'campaignPlan.dailyPlans': []
        }
      });

      // Then update with the daily plan
      await Campaign.findByIdAndUpdate(campaignId, {
        $set: {
          'campaignPlan.totalRecipients': emailListStats.availableToSend,
          'campaignPlan.emailListStats': emailListStats
        },
        $push: {
          'campaignPlan.dailyPlans': {
            day: dailyPlan.day,
            totalEmails: dailyPlan.totalEmails,
            domains: dailyPlan.domains,
            scheduledAt: new Date()
          }
        }
      });

      logger.info('📋 Campaign plan stored', {
        campaignId,
        day: dailyPlan.day,
        totalEmails: dailyPlan.totalEmails,
        emailStats: emailListStats
      });

    } catch (error) {
      logger.error('❌ Failed to store campaign plan:', error);
      throw error;
    }
  }

  async getCampaignPlan(campaignId) {
    try {
      const campaign = await Campaign.findById(campaignId).select('campaignPlan progress');
      return campaign ? campaign.campaignPlan : null;
    } catch (error) {
      logger.error('❌ Failed to get campaign plan:', error);
      throw error;
    }
  }

  async getTodaysPlan(campaignId) {
    try {
      const SentEmail = require('../models/SentEmail');
      const campaign = await Campaign.findById(campaignId).select('campaignPlan progress');
      
      if (!campaign || !campaign.campaignPlan) {
        return null;
      }

      const currentDay = campaign.progress.currentDay;
      const todaysPlan = campaign.campaignPlan.dailyPlans.find(plan => plan.day === currentDay);
      
      // Get current count of already sent emails GLOBALLY across all campaigns
      const allSentEmails = await SentEmail.find({}).select('recipient.email');
      const uniqueSentEmails = new Set(allSentEmails.map(e => e.recipient.email));
      const alreadySentGlobal = uniqueSentEmails.size;
      
      // Get updated email list stats with GLOBAL sent count
      const emailListStats = {
        ...campaign.campaignPlan.emailListStats,
        alreadySent: alreadySentGlobal,
        availableToSend: Math.max(0, (campaign.campaignPlan.emailListStats.totalEmails || 0) - alreadySentGlobal - (campaign.campaignPlan.emailListStats.unsubscribed || 0)),
        alreadySentGlobal: alreadySentGlobal,
        availableToSendGlobal: Math.max(0, (campaign.campaignPlan.emailListStats.totalEmails || 0) - alreadySentGlobal - (campaign.campaignPlan.emailListStats.unsubscribed || 0))
      };
      
      return {
        currentDay,
        todaysPlan,
        emailListStats,
        totalRecipients: campaign.campaignPlan.totalRecipients
      };
    } catch (error) {
      logger.error('❌ Failed to get today\'s plan:', error);
      throw error;
    }
  }

  processTemplateData(templateData, variables) {
    const processed = {};
    
    Object.keys(templateData).forEach(key => {
      let value = templateData[key];
      
      // Replace template variables in the value
      Object.keys(variables).forEach(varKey => {
        const regex = new RegExp(`{{${varKey}}}`, 'g');
        value = value.replace(regex, variables[varKey]);
      });
      
      processed[key] = value;
    });
    
    return processed;
  }

  async getCurrentExecutionPlan(campaignId) {
    try {
      logger.info(`🔍 Getting current execution plan for campaign: ${campaignId}`);
      
      const campaign = await Campaign.findById(campaignId)
        .select('campaignPlan progress status configuration')
        .populate('configuration.customEmailListId');
      
      if (!campaign) {
        logger.error(`❌ Campaign not found: ${campaignId}`);
        return null;
      }

      logger.info(`📊 Campaign status: ${campaign.status}, Progress: ${JSON.stringify(campaign.progress)}`);
      
      if (!campaign.campaignPlan) {
        logger.error(`❌ Campaign plan not found for campaign: ${campaignId}`);
        logger.info(`🔄 Attempting to regenerate campaign plan...`);
        
        // Try to regenerate the plan if it doesn't exist
        try {
          await this.processCampaign(campaignId);
          logger.info(`✅ Campaign plan regenerated successfully`);
          
          // Fetch the campaign again after processing
          const updatedCampaign = await Campaign.findById(campaignId)
            .select('campaignPlan progress status configuration')
            .populate('configuration.customEmailListId');
          if (updatedCampaign && updatedCampaign.campaignPlan) {
            logger.info(`✅ Found regenerated campaign plan`);
            // Continue with the updated campaign
            const currentDay = updatedCampaign.progress.currentDay;
            const todaysPlan = updatedCampaign.campaignPlan.dailyPlans.find(plan => plan.day === currentDay);
            
            if (!todaysPlan) {
              logger.error(`❌ Today's plan still not found after regeneration for day ${currentDay}`);
              return null;
            }
            
            // Use the updated campaign data
            campaign.campaignPlan = updatedCampaign.campaignPlan;
            campaign.progress = updatedCampaign.progress;
          } else {
            logger.error(`❌ Failed to regenerate campaign plan`);
            return null;
          }
        } catch (regenerateError) {
          logger.error(`❌ Failed to regenerate campaign plan:`, regenerateError);
          return null;
        }
      }

      logger.info(`📋 Campaign plan exists with ${campaign.campaignPlan.dailyPlans?.length || 0} daily plans`);

      const currentDay = campaign.progress.currentDay;
      const todaysPlan = campaign.campaignPlan.dailyPlans.find(plan => plan.day === currentDay);
      
      if (!todaysPlan) {
        logger.error(`❌ Today's plan not found for day ${currentDay}. Available days: ${campaign.campaignPlan.dailyPlans.map(p => p.day).join(', ')}`);
        return null;
      }

      logger.info(`✅ Found today's plan for day ${currentDay}`);

      // Get current time
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      // Calculate what's happening right now
      const currentExecution = {
        currentTime: {
          hour: currentHour,
          minute: currentMinute,
          timestamp: now.toISOString()
        },
        todaysPlan: todaysPlan,
        currentHourPlan: null,
        upcomingHours: [],
        completedHours: [],
        totalScheduled: 0,
        totalCompleted: 0,
        totalRemaining: 0
      };

      // Process each domain and email to find current hour's plan
      for (const domainPlan of todaysPlan.domains) {
        for (const emailPlan of domainPlan.emails) {
          for (const hourPlan of emailPlan.hours) {
            const hour = hourPlan.hour;
            const count = hourPlan.count;
            
            currentExecution.totalScheduled += count;
            
            if (hour < currentHour) {
              // Past hour - completed
              currentExecution.completedHours.push({
                hour,
                count,
                domain: domainPlan.domain,
                sender: emailPlan.email,
                status: 'completed'
              });
              currentExecution.totalCompleted += count;
            } else if (hour === currentHour) {
              // Current hour
              if (!currentExecution.currentHourPlan) {
                currentExecution.currentHourPlan = {
                  hour,
                  totalEmails: 0,
                  domains: []
                };
              }
              
              currentExecution.currentHourPlan.totalEmails += count;
              currentExecution.currentHourPlan.domains.push({
                domain: domainPlan.domain,
                sender: emailPlan.email,
                count,
                minuteDistribution: hourPlan.minutes || []
              });
            } else {
              // Future hour
              currentExecution.upcomingHours.push({
                hour,
                count,
                domain: domainPlan.domain,
                sender: emailPlan.email,
                status: 'scheduled'
              });
            }
          }
        }
      }

      // Get actual sent count for this campaign to show real completion
      const SentEmail = require('../models/SentEmail');
      const actualSentCount = await SentEmail.countDocuments({ campaign: campaignId });
      
      // Update execution stats with actual sent emails
      currentExecution.totalCompleted = actualSentCount;
      currentExecution.totalRemaining = Math.max(0, currentExecution.totalScheduled - actualSentCount);
      
      // Sort hours
      currentExecution.completedHours.sort((a, b) => a.hour - b.hour);
      currentExecution.upcomingHours.sort((a, b) => a.hour - b.hour);

      // Get CAMPAIGN-SPECIFIC email list statistics
      
      // Get the email list for this campaign
      const campaignEmailList = await this.getEmailListForCampaign(campaign);
      const campaignEmailSet = new Set(campaignEmailList.map(e => e.toLowerCase().trim()));
      
      // Get emails sent by THIS campaign only
      const campaignSentEmails = await SentEmail.find({ 
        campaign: campaignId 
      }).select('recipient.email');
      const sentByCampaignSet = new Set(campaignSentEmails.map(e => e.recipient.email.toLowerCase().trim()));
      
      // Get unsubscribed emails that exist in THIS campaign's email list
      const unsubscribedList = await this.getUnsubscribedList();
      const unsubscribedInCampaignList = unsubscribedList.filter(email => 
        campaignEmailSet.has(email.toLowerCase().trim())
      );
      
      // Calculate campaign-specific statistics
      const totalEmails = campaignEmailList.length;
      const alreadySent = sentByCampaignSet.size;
      const unsubscribed = unsubscribedInCampaignList.length;
      const available = Math.max(0, totalEmails - alreadySent - unsubscribed);
      
      // Log for debugging
      logger.info('📊 Campaign-specific email list statistics', {
        campaignId,
        emailListSource: campaign.configuration.emailListSource,
        totalEmails,
        alreadySent,
        unsubscribed,
        available,
        calculation: `${totalEmails} - ${alreadySent} - ${unsubscribed} = ${available}`
      });
      
      const emailListStats = {
        totalEmails,
        alreadySent,
        unsubscribed,
        availableToSend: available
      };

      return {
        campaign: {
          id: campaignId,
          status: campaign.status,
          currentDay
        },
        execution: currentExecution,
        emailListStats
      };
    } catch (error) {
      logger.error('❌ Failed to get current execution plan:', error);
      throw error;
    }
  }

  async getEmailListForCampaign(campaign) {
    try {
      const config = campaign.configuration;
      
      // If using custom email list
      if (config.emailListSource === 'custom' && config.customEmailListId) {
        const EmailList = require('../models/EmailList');
        const emailList = await EmailList.findById(config.customEmailListId);
        
        if (!emailList || !emailList.isActive) {
          logger.warn('⚠️ Custom email list not found or inactive, falling back to global list');
          return await this.getEmailList();
        }
        
        // Fetch emails from S3 using custom list's key
        const params = {
          Bucket: process.env.S3_BUCKET,
          Key: emailList.s3Key
        };
        
        logger.info('📧 Fetching custom email list from S3', {
          emailListId: emailList._id,
          name: emailList.name,
          s3Key: emailList.s3Key
        });
        
        const stream = this.s3.getObject(params).createReadStream();
        const emails = [];
        
        return new Promise((resolve, reject) => {
          stream
            .pipe(csv())
            .on('data', (row) => {
              const email = row.email || row.Email || row.EMAIL;
              if (email) {
                emails.push(email.toLowerCase().trim());
              }
            })
            .on('end', () => {
              const uniqueEmails = [...new Set(emails)];
              logger.info('📧 Custom email list loaded', {
                totalEmails: uniqueEmails.length,
                listName: emailList.name
              });
              
              // Update last used timestamp
              EmailList.findByIdAndUpdate(emailList._id, {
                'metadata.lastUsedAt': new Date(),
                $inc: { 'metadata.usageCount': 1 }
              }).catch(err => logger.error('Failed to update email list metadata:', err));
              
              resolve(uniqueEmails);
            })
            .on('error', (error) => {
              logger.error('❌ Failed to read custom email list from S3:', error);
              reject(error);
            });
        });
      }
      
      // Fall back to global email list
      return await this.getEmailList();
      
    } catch (error) {
      logger.error('❌ Failed to get email list for campaign:', error);
      throw error;
    }
  }

  async applyWarmupMode(campaign, recipients) {
    try {
      const warmupConfig = campaign.configuration.warmupMode;
      
      if (!warmupConfig || !warmupConfig.enabled) {
        return recipients;
      }
      
      const currentIndex = warmupConfig.currentIndex || 0;
      const dailyPlanTotal = this.calculateDailyTotal(campaign);
      
      logger.info('🔥 Applying warmup mode', {
        campaignId: campaign._id,
        currentIndex,
        totalRecipients: recipients.length,
        dailyPlanTotal
      });
      
      // If we've reached the end of the list, restart from beginning
      if (currentIndex >= recipients.length) {
        logger.info('🔄 Warmup mode: Restarting from beginning of list');
        await Campaign.findByIdAndUpdate(campaign._id, {
          'configuration.warmupMode.currentIndex': 0
        });
        return recipients.slice(0, dailyPlanTotal);
      }
      
      // Get the next batch of recipients
      const endIndex = Math.min(currentIndex + dailyPlanTotal, recipients.length);
      const selectedRecipients = recipients.slice(currentIndex, endIndex);
      
      // Update the current index for next run
      await Campaign.findByIdAndUpdate(campaign._id, {
        'configuration.warmupMode.currentIndex': endIndex
      });
      
      logger.info('🔥 Warmup mode applied', {
        campaignId: campaign._id,
        selectedCount: selectedRecipients.length,
        nextIndex: endIndex,
        willRestart: endIndex >= recipients.length
      });
      
      return selectedRecipients;
      
    } catch (error) {
      logger.error('❌ Failed to apply warmup mode:', error);
      // Return all recipients if warmup mode fails
      return recipients;
    }
  }

  calculateDailyTotal(campaign) {
    const config = campaign.configuration;
    const day = campaign.progress.currentDay;
    const { baseDailyTotal, quotaDays = 30, targetSum = 450000 } = config;
    
    // Use the same logic as generateDailyTotal
    const { generateDailyTotal } = require('../utils/randomization');
    return generateDailyTotal(baseDailyTotal, day, quotaDays, targetSum);
  }
}

module.exports = new CampaignOrchestrator();
