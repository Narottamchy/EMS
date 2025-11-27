const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// SES Webhook - Public route (no auth middleware)
// SNS sends POST requests to this endpoint
router.post('/ses', webhookController.handleSESWebhook);

module.exports = router;
