const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');

// Public routes
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);

// Protected routes
router.use(authenticate);

router.get('/me', authController.getCurrentUser);
router.post('/logout', authController.logout);
router.post('/change-password', authController.changePassword);

// Admin only
router.post('/register', authorize('admin'), authController.register);

module.exports = router;
