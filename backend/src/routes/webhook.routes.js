const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// SNS sends Content-Type: text/plain, so we need to parse it as JSON
router.use(express.json({ type: ['application/json', 'text/plain'] }));

// SES Webhook - Public route (no auth middleware)
// SNS sends POST requests to this endpoint
router.post('/ses', webhookController.handleSESWebhook);

module.exports = router;
