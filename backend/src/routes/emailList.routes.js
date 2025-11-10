const express = require('express');
const router = express.Router();
const emailListController = require('../controllers/emailListController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Email list management routes
router.post('/upload', emailListController.uploadEmailList);
router.get('/', emailListController.getEmailLists);
router.get('/:id', emailListController.getEmailListById);
router.get('/:id/preview', emailListController.getEmailListPreview);
router.put('/:id', emailListController.updateEmailList);
router.delete('/:id', emailListController.deleteEmailList);

module.exports = router;
