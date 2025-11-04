const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Email management routes
router.get('/list', emailController.getEmailList);
router.get('/unsubscribed', emailController.getUnsubscribedList);
router.get('/stats', emailController.getEmailStats);
router.get('/verified-domains', emailController.getVerifiedDomains);

module.exports = router;
