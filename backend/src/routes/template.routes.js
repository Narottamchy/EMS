const express = require('express');
const router = express.Router();
const templateController = require('../controllers/templateController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Template CRUD
router.post('/', authorize('admin', 'manager'), templateController.createTemplate);
router.get('/', templateController.getTemplates);
router.get('/:id', templateController.getTemplateById);
router.put('/:id', authorize('admin', 'manager'), templateController.updateTemplate);
router.delete('/:id', authorize('admin'), templateController.deleteTemplate);

// Template usage
router.get('/:id/usage', templateController.getTemplateUsage);
router.post('/validate-html', templateController.validateHTML);
router.post('/generate-text', templateController.generateText);

module.exports = router;
