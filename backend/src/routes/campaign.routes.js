const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Dashboard
router.get('/dashboard', campaignController.getDashboardSummary);

// Campaign CRUD
router.post('/', authorize('admin', 'manager'), campaignController.createCampaign);
router.get('/', campaignController.getCampaigns);
router.get('/:id', campaignController.getCampaignById);
router.put('/:id', authorize('admin', 'manager'), campaignController.updateCampaign);
router.delete('/:id', authorize('admin', 'manager'), campaignController.deleteCampaign);

// Campaign control
router.post('/:id/start', authorize('admin', 'manager'), campaignController.startCampaign);
router.post('/:id/pause', authorize('admin', 'manager'), campaignController.pauseCampaign);
router.post('/:id/resume', authorize('admin', 'manager'), campaignController.resumeCampaign);

// Campaign analytics
router.get('/:id/analytics', campaignController.getCampaignAnalytics);
router.get('/:id/realtime', campaignController.getCampaignRealtimeStats);

// Campaign simulation
router.get('/:id/simulate', campaignController.simulateDailyPlan);

// Campaign plan (actual plan, not simulation)
router.get('/:id/plan', campaignController.getCampaignPlan);

// Today's plan (what's running today)
router.get('/:id/today', campaignController.getTodaysPlan);

// Current execution plan (what's happening right now)
router.get('/:id/execution', campaignController.getCurrentExecutionPlan);

// Regenerate campaign plan
router.post('/:id/regenerate-plan', campaignController.regenerateCampaignPlan);

// Get template fields for campaign configuration
router.get('/:id/template-fields', campaignController.getTemplateFields);

// Save template data configuration
router.post('/:id/template-data', campaignController.saveTemplateData);

// Sender email management
router.post('/:campaignId/senders', authorize('admin', 'manager'), campaignController.addSenderEmail);
router.put('/:campaignId/senders/:senderEmailId', authorize('admin', 'manager'), campaignController.updateSenderEmail);
router.delete('/:campaignId/senders/:senderEmailId', authorize('admin', 'manager'), campaignController.removeSenderEmail);

// Day transition management
router.post('/:id/transition-day', authorize('admin', 'manager'), campaignController.transitionToNextDay);
router.get('/scheduler/status', authorize('admin'), campaignController.getSchedulerStatus);

module.exports = router;
