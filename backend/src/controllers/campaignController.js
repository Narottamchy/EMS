const Campaign = require('../models/Campaign');
const SESTemplateService = require('../services/SESTemplateService');
const CampaignOrchestrator = require('../services/CampaignOrchestrator');
const AnalyticsService = require('../services/AnalyticsService');
const QueueService = require('../services/QueueService');
const SystemLog = require('../models/SystemLog');
const DailyCampaignStats = require('../models/DailyCampaignStats');
const logger = require('../utils/logger');

// Create new campaign
exports.createCampaign = async (req, res) => {
  try {
    const { name, description, type, templateName, templateNames, configuration, schedule } = req.body;

    // Validate templates
    if (templateNames && templateNames.length > 0) {
      // Verify all templates exist in SES
      for (const template of templateNames) {
        const templateExists = await SESTemplateService.templateExists(template);
        if (!templateExists) {
          return res.status(404).json({
            success: false,
            message: `Email template '${template}' not found in SES`
          });
        }
      }
    } else if (templateName) {
      // Single template - verify it exists in SES
      const templateExists = await SESTemplateService.templateExists(templateName);
      if (!templateExists) {
        return res.status(404).json({
          success: false,
          message: 'Email template not found in SES'
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Either templateName or templateNames is required'
      });
    }

    // Create campaign
    const campaign = new Campaign({
      name,
      description,
      type: type || 'immediate',
      templateName: templateName || (templateNames && templateNames[0]), // Keep single template for backward compatibility
      templateNames: templateNames || [templateName], // Store all templates
      configuration,
      schedule,
      status: 'draft',
      createdBy: req.userId
    });

    await campaign.save();

    // Log the action
    await SystemLog.create({
      level: 'info',
      category: 'campaign',
      message: 'Campaign created',
      details: { campaignId: campaign._id, name },
      campaign: campaign._id,
      user: req.userId
    });

    logger.info('✅ Campaign created', { campaignId: campaign._id, name });

    res.status(201).json({
      success: true,
      message: 'Campaign created successfully',
      data: { campaign }
    });

  } catch (error) {
    logger.error('❌ Create campaign error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create campaign',
      error: error.message
    });
  }
};

// Get all campaigns
exports.getCampaigns = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, sort = '-createdAt' } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }

    // Non-admin users can only see their own campaigns
    if (req.user.role !== 'admin') {
      query.createdBy = req.userId;
    }

    const campaigns = await Campaign.find(query)
      .populate('createdBy', 'name email')
      .populate('startedBy', 'name email')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const count = await Campaign.countDocuments(query);

    res.json({
      success: true,
      data: {
        campaigns,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalItems: count,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    logger.error('❌ Get campaigns error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get campaigns',
      error: error.message
    });
  }
};

// Get campaign by ID
exports.getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findById(id)
      .populate('createdBy', 'name email')
      .populate('startedBy', 'name email');

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'admin' && campaign.createdBy._id.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: { campaign }
    });

  } catch (error) {
    logger.error('❌ Get campaign error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get campaign',
      error: error.message
    });
  }
};

// Update campaign
exports.updateCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const campaign = await Campaign.findById(id);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'admin' && campaign.createdBy.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Prevent updating running campaigns
    if (campaign.status === 'running') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update a running campaign. Please pause the campaign first.'
      });
    }

    // Update allowed fields
    const allowedUpdates = ['name', 'description', 'configuration', 'schedule', 'templateName', 'templateNames'];
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        campaign[field] = updates[field];
      }
    });

    await campaign.save();

    logger.info('✅ Campaign updated', { campaignId: id });

    res.json({
      success: true,
      message: 'Campaign updated successfully',
      data: { campaign }
    });

  } catch (error) {
    logger.error('❌ Update campaign error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update campaign',
      error: error.message
    });
  }
};

// Start campaign
exports.startCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await CampaignOrchestrator.startCampaign(id, req.userId);

    // Emit real-time update via WebSocket
    const io = req.app.get('io');
    if (io) {
      io.to(`campaign-${id}`).emit(`campaign-${id}-update`, {
        type: 'campaign_started',
        campaign: {
          status: campaign.status,
          startedAt: campaign.startedAt
        },
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Campaign started successfully',
      data: { campaign }
    });

  } catch (error) {
    logger.error('❌ Start campaign error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to start campaign',
      error: error.message
    });
  }
};

// Pause campaign
exports.pauseCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await CampaignOrchestrator.pauseCampaign(id);

    await SystemLog.create({
      level: 'info',
      category: 'campaign',
      message: 'Campaign paused',
      campaign: id,
      user: req.userId
    });

    // Emit real-time update via WebSocket
    const io = req.app.get('io');
    if (io) {
      io.to(`campaign-${id}`).emit(`campaign-${id}-update`, {
        type: 'campaign_paused',
        campaign: {
          status: campaign.status
        },
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Campaign paused successfully',
      data: { campaign }
    });

  } catch (error) {
    logger.error('❌ Pause campaign error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to pause campaign',
      error: error.message
    });
  }
};

// Resume campaign
exports.resumeCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await CampaignOrchestrator.resumeCampaign(id, req.userId);

    await SystemLog.create({
      level: 'info',
      category: 'campaign',
      message: 'Campaign resumed',
      campaign: id,
      user: req.userId
    });

    // Emit real-time update via WebSocket
    const io = req.app.get('io');
    if (io) {
      io.to(`campaign-${id}`).emit(`campaign-${id}-update`, {
        type: 'campaign_resumed',
        campaign: {
          status: campaign.status
        },
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Campaign resumed successfully',
      data: { campaign }
    });

  } catch (error) {
    logger.error('❌ Resume campaign error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to resume campaign',
      error: error.message
    });
  }
};

// Delete campaign
exports.deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findById(id);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'admin' && campaign.createdBy.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Prevent deleting running campaigns
    if (campaign.status === 'running') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a running campaign. Please pause it first.'
      });
    }

    await campaign.deleteOne();

    await SystemLog.create({
      level: 'info',
      category: 'campaign',
      message: 'Campaign deleted',
      details: { campaignId: id, name: campaign.name },
      user: req.userId
    });

    logger.info('✅ Campaign deleted', { campaignId: id });

    res.json({
      success: true,
      message: 'Campaign deleted successfully'
    });

  } catch (error) {
    logger.error('❌ Delete campaign error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete campaign',
      error: error.message
    });
  }
};

// Get campaign analytics
exports.getCampaignAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDay, endDay } = req.query;

    const campaign = await Campaign.findById(id);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    const analytics = await AnalyticsService.getCampaignAnalytics(
      id,
      startDay ? parseInt(startDay) : undefined,
      endDay ? parseInt(endDay) : undefined
    );

    const summary = await AnalyticsService.getCampaignSummary(id);

    res.json({
      success: true,
      data: {
        summary,
        dailyAnalytics: analytics
      }
    });

  } catch (error) {
    logger.error('❌ Get campaign analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get campaign analytics',
      error: error.message
    });
  }
};

// Get campaign realtime stats
exports.getCampaignRealtimeStats = async (req, res) => {
  try {
    const { id } = req.params;

    const [campaign, stats, campaignPlan] = await Promise.all([
      Campaign.findById(id),
      AnalyticsService.getRealtimeStats(id),
      CampaignOrchestrator.getCampaignPlan(id)
    ]);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    // Get campaign-specific queue stats
    const campaignQueueStats = await QueueService.getCampaignQueueStats(id);

    // Log detailed queue information for debugging
    logger.info('📊 Campaign queue stats', {
      campaignId: id,
      campaignStatus: campaign.status,
      queueStats: campaignQueueStats,
      emailStats: stats
    });

    // Patch emailStats.queued to today's queued
    let patchedStats = { ...stats };
    try {
      const todaysPlan = await CampaignOrchestrator.getTodaysPlan(id);
      if (todaysPlan && typeof todaysPlan.todaysQueued === 'number') {
        patchedStats.queued = todaysPlan.todaysQueued;
      }
    } catch (e) { /* ignore */ }
    res.json({
      success: true,
      data: {
        campaign: {
          id: campaign._id,
          name: campaign.name,
          status: campaign.status,
          progress: campaign.progress
        },
        emailStats: patchedStats,
        queueStats: campaignQueueStats,
        campaignPlan,
        isActive: CampaignOrchestrator.isCampaignActive(id)
      }
    });

  } catch (error) {
    logger.error('❌ Get campaign realtime stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get realtime stats',
      error: error.message
    });
  }
};

// Get dashboard summary
exports.getDashboardSummary = async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { createdBy: req.userId };

    const [totalCampaigns, activeCampaigns, completedCampaigns, queueStats] = await Promise.all([
      Campaign.countDocuments(query),
      Campaign.countDocuments({ ...query, status: 'running' }),
      Campaign.countDocuments({ ...query, status: 'completed' }),
      QueueService.getQueueStats()
    ]);

    const activeCampaignsList = CampaignOrchestrator.getActiveCampaigns();

    res.json({
      success: true,
      data: {
        campaigns: {
          total: totalCampaigns,
          active: activeCampaigns,
          completed: completedCampaigns,
          draft: await Campaign.countDocuments({ ...query, status: 'draft' }),
          paused: await Campaign.countDocuments({ ...query, status: 'paused' }),
          failed: await Campaign.countDocuments({ ...query, status: 'failed' })
        },
        queue: queueStats,
        activeCampaigns: activeCampaignsList
      }
    });

  } catch (error) {
    logger.error('❌ Get dashboard summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard summary',
      error: error.message
    });
  }
};

// Add sender email to campaign
exports.addSenderEmail = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { email, domain, isActive = true } = req.body;

    // Validate input
    if (!email || !domain) {
      return res.status(400).json({
        success: false,
        message: 'Email and domain are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    // Check if email already exists
    const existingSender = campaign.configuration.senderEmails.find(
      sender => sender.email === email
    );

    if (existingSender) {
      return res.status(400).json({
        success: false,
        message: 'Sender email already exists'
      });
    }

    // Add new sender email
    campaign.configuration.senderEmails.push({
      email,
      domain,
      isActive
    });

    await campaign.save();

    logger.info(`✅ Added sender email ${email} to campaign ${campaignId}`);

    res.json({
      success: true,
      message: 'Sender email added successfully',
      data: { senderEmail: { email, domain, isActive } }
    });

  } catch (error) {
    logger.error('❌ Add sender email error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add sender email',
      error: error.message
    });
  }
};

// Update sender email
exports.updateSenderEmail = async (req, res) => {
  try {
    const { campaignId, senderEmailId } = req.params;
    const { email, domain, isActive } = req.body;

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    const senderIndex = campaign.configuration.senderEmails.findIndex(
      sender => sender._id.toString() === senderEmailId
    );

    if (senderIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Sender email not found'
      });
    }

    // Update sender email
    if (email) campaign.configuration.senderEmails[senderIndex].email = email;
    if (domain) campaign.configuration.senderEmails[senderIndex].domain = domain;
    if (typeof isActive === 'boolean') campaign.configuration.senderEmails[senderIndex].isActive = isActive;

    await campaign.save();

    logger.info(`✅ Updated sender email ${senderEmailId} in campaign ${campaignId}`);

    res.json({
      success: true,
      message: 'Sender email updated successfully',
      data: { senderEmail: campaign.configuration.senderEmails[senderIndex] }
    });

  } catch (error) {
    logger.error('❌ Update sender email error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update sender email',
      error: error.message
    });
  }
};

// Remove sender email
exports.removeSenderEmail = async (req, res) => {
  try {
    const { campaignId, senderEmailId } = req.params;

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    const senderIndex = campaign.configuration.senderEmails.findIndex(
      sender => sender._id.toString() === senderEmailId
    );

    if (senderIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Sender email not found'
      });
    }

    const removedSender = campaign.configuration.senderEmails[senderIndex];
    campaign.configuration.senderEmails.splice(senderIndex, 1);

    await campaign.save();

    logger.info(`✅ Removed sender email ${removedSender.email} from campaign ${campaignId}`);

    res.json({
      success: true,
      message: 'Sender email removed successfully'
    });

  } catch (error) {
    logger.error('❌ Remove sender email error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove sender email',
      error: error.message
    });
  }
};

// Get campaign plan (actual plan, not simulation)
exports.getCampaignPlan = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    // Get the actual campaign plan from database
    const campaignPlan = await CampaignOrchestrator.getCampaignPlan(id);

    if (!campaignPlan) {
      return res.status(404).json({
        success: false,
        message: 'Campaign plan not found. Campaign may not have been started yet.'
      });
    }

    res.json({
      success: true,
      data: {
        campaign: {
          id,
          name: campaign.name,
          status: campaign.status
        },
        campaignPlan
      }
    });

  } catch (error) {
    logger.error('❌ Get campaign plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get campaign plan',
      error: error.message
    });
  }
};

// Get today's plan (what's running today)
exports.getTodaysPlan = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    // Get today's plan from database
    const todaysData = await CampaignOrchestrator.getTodaysPlan(id);

    if (!todaysData) {
      return res.status(404).json({
        success: false,
        message: 'Today\'s plan not found. Campaign may not have been started yet.'
      });
    }

    res.json({
      success: true,
      data: {
        campaign: {
          id,
          name: campaign.name,
          status: campaign.status,
          currentDay: todaysData.currentDay
        },
        todaysPlan: todaysData.todaysPlan,
        emailListStats: todaysData.emailListStats,
        totalRecipients: todaysData.todaysScheduled,
        todaysQueued: todaysData.todaysQueued
      }
    });

  } catch (error) {
    logger.error('❌ Get today\'s plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get today\'s plan',
      error: error.message
    });
  }
};

// Current execution plan (what's happening right now)
exports.getCurrentExecutionPlan = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    // Get current execution plan
    const executionData = await CampaignOrchestrator.getCurrentExecutionPlan(id);

    if (!executionData) {
      return res.status(404).json({
        success: false,
        message: 'Current execution plan not found. Campaign may not have been started yet.'
      });
    }

    res.json({
      success: true,
      data: {
        campaign: {
          id,
          name: campaign.name,
          status: campaign.status,
          currentDay: executionData.campaign.currentDay
        },
        execution: executionData.execution,
        emailListStats: executionData.emailListStats
      }
    });

  } catch (error) {
    logger.error('❌ Get current execution plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get current execution plan',
      error: error.message
    });
  }
};




// Simulate daily plan for campaign using actual generateDailyPlan function
exports.simulateDailyPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { day = 1, totalRecipients = 450000 } = req.query;
    
    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    const config = campaign.configuration;
    const dayNumber = parseInt(day);
    const totalRecipientsCount = parseInt(totalRecipients);
    
    // Get the actual CampaignOrchestrator instance
    const orchestrator = require('../services/CampaignOrchestrator');
    
    // Generate daily plan using the actual function
    const dailyPlan = orchestrator.generateDailyPlan(config, dayNumber, totalRecipientsCount);
    
    // Get sender emails (custom or generated)
    const senderEmails = orchestrator.generateSenderEmails(config);
    
        // Format the plan for frontend with minute-level details
        const formattedPlan = {
          day: dailyPlan.day,
          date: new Date(Date.now() + (dayNumber - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          totalEmails: dailyPlan.totalEmails,
          domains: dailyPlan.domains.map(domainPlan => ({
            domain: domainPlan.domain,
            totalEmails: domainPlan.totalEmails,
            senders: domainPlan.emails.map(emailPlan => ({
              email: emailPlan.email,
              totalEmails: emailPlan.totalEmails,
              hours: emailPlan.hours.map(h => ({
                hour: h.hour,
                count: h.count,
                timeLabel: `${h.hour.toString().padStart(2, '0')}:00`,
                minuteDistribution: h.minutes ? h.minutes.map((count, minute) => ({
                  minute,
                  count,
                  timeLabel: `${h.hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
                })).filter(m => m.count > 0) : []
              }))
            }))
          })),
          senderEmails: senderEmails,
          configuration: {
            baseDailyTotal: config.baseDailyTotal,
            maxEmailPercentage: config.maxEmailPercentage,
            randomizationIntensity: config.randomizationIntensity,
            domains: config.domains,
            emailsPerDomain: orchestrator.calculateEmailsPerDomain(config),
            customSenderEmails: config.senderEmails || [],
            quotaDays: config.quotaDays || 30,
            targetSum: config.targetSum || 450000
          }
        };

    // Calculate growth metrics for this day
    const growthFactor = 1 + (dayNumber - 1) * 0.1; // 10% growth per day
    const randomFactor = 1 + (Math.random() - 0.5) * config.randomizationIntensity;
    const projectedTotal = Math.min(
      Math.floor(config.baseDailyTotal * growthFactor * randomFactor),
      totalRecipientsCount
    );

    const growthMetrics = {
      day: dayNumber,
      projectedEmails: projectedTotal,
      growthFactor: growthFactor.toFixed(2),
      randomFactor: randomFactor.toFixed(2),
      baseDailyTotal: config.baseDailyTotal,
      totalRecipients: totalRecipientsCount,
      remainingRecipients: Math.max(0, totalRecipientsCount - projectedTotal)
    };

    logger.info(`✅ Generated daily plan simulation for campaign ${id}, day ${dayNumber}`);

    res.json({
      success: true,
      data: {
        campaign: {
          id,
          name: campaign.name,
          status: campaign.status
        },
        simulation: {
          dailyPlan: formattedPlan,
          growthMetrics
        }
      }
    });

  } catch (error) {
    logger.error('❌ Simulate daily plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to simulate daily plan',
      error: error.message
    });
  }
};


// Regenerate campaign plan
exports.regenerateCampaignPlan = async (req, res) => {
  try {
    const { id } = req.params;
    
    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    if (campaign.status !== 'running') {
      return res.status(400).json({
        success: false,
        message: 'Campaign must be running to regenerate plan'
      });
    }

    // Clear existing campaign plan
    await Campaign.findByIdAndUpdate(id, {
      $unset: { campaignPlan: 1 }
    });

    // Regenerate the plan
    const CampaignOrchestrator = require('../services/CampaignOrchestrator');
    await CampaignOrchestrator.processCampaign(id);

    res.json({
      success: true,
      message: 'Campaign plan regenerated successfully'
    });
  } catch (error) {
    logger.error('❌ Regenerate campaign plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to regenerate campaign plan',
      error: error.message
    });
  }
};


// Get template fields for campaign configuration
exports.getTemplateFields = async (req, res) => {
  try {
    const { id } = req.params;
    
    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    // Get all templates for this campaign
    const templates = campaign.templateNames && campaign.templateNames.length > 0 
      ? campaign.templateNames 
      : [campaign.templateName];

    const EmailService = require('../services/EmailService');
    const allVariables = new Map();
    const templatesData = [];

    // Extract variables from all templates
    for (const templateName of templates) {
      try {
        const template = await EmailService.getTemplate(templateName);
        
        if (!template) {
          templatesData.push({
            name: templateName,
            status: 'not_found',
            variables: []
          });
          continue;
        }

        const templateContent = template.HtmlPart || template.TextPart || '';
        const variableRegex = /\{\{([^}]+)\}\}/g;
        const templateVariables = [];
        let match;

        while ((match = variableRegex.exec(templateContent)) !== null) {
          const variableName = match[1].trim();
          if (!allVariables.has(variableName)) {
            allVariables.set(variableName, {
              name: variableName,
              type: getVariableType(variableName),
              description: getVariableDescription(variableName),
              suggestions: getVariableSuggestions(variableName),
              templates: []
            });
          }
          
          allVariables.get(variableName).templates.push(templateName);
          
          if (!templateVariables.find(v => v.name === variableName)) {
            templateVariables.push({
              name: variableName,
              type: getVariableType(variableName),
              description: getVariableDescription(variableName)
            });
          }
        }

        templatesData.push({
          name: templateName,
          status: 'found',
          variables: templateVariables,
          content: templateContent.substring(0, 300) + '...'
        });
      } catch (error) {
        logger.error(`Failed to get template ${templateName}:`, error);
        templatesData.push({
          name: templateName,
          status: 'error',
          variables: []
        });
      }
    }

    // Convert Map to Array
    const variables = Array.from(allVariables.values());

    res.json({
      success: true,
      data: {
        templates: templates,
        templatesData: templatesData,
        variables: variables,
        hasVariables: variables.length > 0
      }
    });
  } catch (error) {
    logger.error('❌ Get template fields error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get template fields',
      error: error.message
    });
  }
};

// Helper function to determine variable type
function getVariableType(variableName) {
  const lowerName = variableName.toLowerCase();
  
  if (lowerName.includes('email') || lowerName.includes('recipient')) {
    return 'email';
  } else if (lowerName.includes('name') || lowerName.includes('handle')) {
    return 'text';
  } else if (lowerName.includes('url') || lowerName.includes('link')) {
    return 'url';
  } else if (lowerName.includes('day') || lowerName.includes('date')) {
    return 'number';
  } else {
    return 'text';
  }
}

// Helper function to get variable description
function getVariableDescription(variableName) {
  const lowerName = variableName.toLowerCase();
  
  if (lowerName.includes('recipientname')) {
    return 'Recipient\'s name (extracted from email)';
  } else if (lowerName.includes('recipientemail')) {
    return 'Recipient\'s email address';
  } else if (lowerName.includes('campaignname')) {
    return 'Campaign name';
  } else if (lowerName.includes('instahandle')) {
    return 'Instagram handle (can be static or dynamic)';
  } else if (lowerName.includes('url')) {
    return 'URL (can be static or dynamic)';
  } else if (lowerName.includes('day')) {
    return 'Campaign day number';
  } else {
    return `Template variable: ${variableName}`;
  }
}

// Helper function to get variable suggestions
function getVariableSuggestions(variableName) {
  const lowerName = variableName.toLowerCase();
  
  if (lowerName.includes('instahandle')) {
    return [
      { type: 'static', value: '@yourhandle', description: 'Static Instagram handle' },
      { type: 'dynamic', value: '{{recipientName}}', description: 'Use recipient name as handle' },
      { type: 'dynamic', value: '{{recipientEmail}}', description: 'Use email prefix as handle' }
    ];
  } else if (lowerName.includes('url')) {
    return [
      { type: 'static', value: 'https://example.com', description: 'Static URL' },
      { type: 'dynamic', value: 'https://lpv4lifyk9.execute-api.eu-west-1.amazonaws.com/Unsubscribefunction?email={{recipientEmail}}', description: 'Dynamic URL with email parameter' },
      { type: 'dynamic', value: 'https://example.com/{{recipientName}}', description: 'Dynamic URL with recipient name' }
    ];
  } else if (lowerName.includes('recipientname')) {
    return [
      { type: 'dynamic', value: '{{recipientEmail}}', description: 'Extract name from email' }
    ];
  } else {
    return [
      { type: 'static', value: 'Your value', description: 'Enter a static value' },
      { type: 'dynamic', value: '{{recipientEmail}}', description: 'Use recipient email' },
      { type: 'dynamic', value: '{{recipientName}}', description: 'Use recipient name' }
    ];
  }
}

// Save template data configuration
exports.saveTemplateData = async (req, res) => {
  try {
    const { id } = req.params;
    const { templateData } = req.body;
    
    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    // Update campaign with template data
    await Campaign.findByIdAndUpdate(id, {
      $set: {
        'configuration.templateData': templateData
      }
    });

    res.json({
      success: true,
      message: 'Template data saved successfully',
      data: {
        templateData: templateData
      }
    });
  } catch (error) {
    logger.error('❌ Save template data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save template data',
      error: error.message
    });
  }
};

// Get daily stats for a campaign with date range filtering
exports.getDailyStats = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    // Validate campaign exists
    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    // Build query
    const query = { campaign: id };

    // Add date range filter if provided
    if (startDate || endDate) {
      query.dateString = {};
      if (startDate) {
        query.dateString.$gte = startDate;
      }
      if (endDate) {
        query.dateString.$lte = endDate;
      }
    }

    // Fetch daily stats
    const dailyStats = await DailyCampaignStats.find(query)
      .sort({ date: -1 })
      .lean();

    // Calculate summary
    const summary = {
      totalDays: dailyStats.length,
      totalSent: dailyStats.reduce((sum, day) => sum + (day.stats.totalSent || 0), 0),
      totalFailed: dailyStats.reduce((sum, day) => sum + (day.stats.totalFailed || 0), 0),
      totalQueued: dailyStats.reduce((sum, day) => sum + (day.stats.totalQueued || 0), 0),
      dateRange: {
        start: dailyStats.length > 0 ? dailyStats[dailyStats.length - 1].dateString : null,
        end: dailyStats.length > 0 ? dailyStats[0].dateString : null
      }
    };

    res.json({
      success: true,
      data: {
        campaign: {
          id: campaign._id,
          name: campaign.name,
          status: campaign.status
        },
        summary,
        dailyStats
      }
    });

  } catch (error) {
    logger.error('❌ Get daily stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get daily stats',
      error: error.message
    });
  }
};

// Get detailed stats for a specific date
exports.getDateStats = async (req, res) => {
  try {
    const { id, date } = req.params;

    // Validate campaign exists
    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    // Fetch stats for specific date
    const dateStats = await DailyCampaignStats.findOne({
      campaign: id,
      dateString: date
    }).lean();

    if (!dateStats) {
      return res.status(404).json({
        success: false,
        message: 'No stats found for this date'
      });
    }

    res.json({
      success: true,
      data: {
        campaign: {
          id: campaign._id,
          name: campaign.name,
          status: campaign.status
        },
        dateStats
      }
    });

  } catch (error) {
    logger.error('❌ Get date stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get date stats',
      error: error.message
    });
  }
};
