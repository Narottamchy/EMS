const SESTemplateService = require('../services/SESTemplateService');
const SystemLog = require('../models/SystemLog');
const logger = require('../utils/logger');
const { validateHTML, generateTextFromHTML, minifyHTML } = require('../utils/htmlProcessor');

// Create email template
exports.createTemplate = async (req, res) => {
  try {
    const { name, subject, htmlBody, textBody } = req.body;

    // Validate template data
    SESTemplateService.validateTemplateData({ name, subject, htmlBody, textBody });

    // Check if template already exists in SES
    const templateExists = await SESTemplateService.templateExists(name);
    if (templateExists) {
      return res.status(400).json({
        success: false,
        message: 'Template with this name already exists in SES'
      });
    }

    // Minify HTML for storage
    const minifiedHtml = minifyHTML(htmlBody);
    const minifiedText = textBody ? textBody.trim() : '';

    // Create template in SES
    await SESTemplateService.createTemplate({
      name,
      subject,
      htmlBody: minifiedHtml,
      textBody: minifiedText
    });

    await SystemLog.create({
      level: 'info',
      category: 'system',
      message: 'SES email template created',
      details: { templateName: name },
      user: req.userId
    });

    logger.info('✅ SES email template created', { templateName: name });

    res.status(201).json({
      success: true,
      message: 'Template created successfully in SES',
      data: { 
        template: {
          name,
          subject,
          htmlBody,
          textBody,
          createdAt: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    logger.error('❌ Create template error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create template',
      error: error.message
    });
  }
};

// Get all templates
exports.getTemplates = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    // Get all templates from SES
    const allTemplates = await SESTemplateService.getAllTemplates();
    
    // Apply pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    
    const templates = allTemplates.slice(startIndex, endIndex);
    const totalItems = allTemplates.length;

    res.json({
      success: true,
      data: {
        templates,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalItems / limitNum),
          totalItems,
          itemsPerPage: limitNum
        }
      }
    });

  } catch (error) {
    logger.error('❌ Get templates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get templates',
      error: error.message
    });
  }
};

// Get template by name
exports.getTemplateById = async (req, res) => {
  try {
    const { id: templateName } = req.params;

    const template = await SESTemplateService.getTemplate(templateName);

    res.json({
      success: true,
      data: { 
        template: {
          name: templateName,
          subject: template.Template.SubjectPart,
          htmlBody: template.Template.HtmlPart,
          textBody: template.Template.TextPart,
          createdAt: new Date().toISOString(),
          isActive: true,
          lastModified: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    logger.error('❌ Get template error:', error);
    if (error.message.includes('does not exist')) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to get template',
      error: error.message
    });
  }
};

// Update template
exports.updateTemplate = async (req, res) => {
  try {
    const { id: templateName } = req.params;
    const { subject, htmlBody, textBody } = req.body;

    // Validate template data
    SESTemplateService.validateTemplateData({ 
      name: templateName, 
      subject, 
      htmlBody, 
      textBody 
    });

    // Minify HTML for storage
    const minifiedHtml = minifyHTML(htmlBody);
    const minifiedText = textBody ? textBody.trim() : '';

    // Update template in SES
    await SESTemplateService.updateTemplate(templateName, {
      subject,
      htmlBody: minifiedHtml,
      textBody: minifiedText
    });

    await SystemLog.create({
      level: 'info',
      category: 'system',
      message: 'SES email template updated',
      details: { templateName },
      user: req.userId
    });

    logger.info('✅ SES template updated', { templateName });

    res.json({
      success: true,
      message: 'Template updated successfully in SES',
      data: { 
        template: {
          name: templateName,
          subject,
          htmlBody,
          textBody,
          updatedAt: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    logger.error('❌ Update template error:', error);
    if (error.message.includes('does not exist')) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to update template',
      error: error.message
    });
  }
};

// Delete template
exports.deleteTemplate = async (req, res) => {
  try {
    const { id: templateName } = req.params;

    // Check if template exists in SES
    const templateExists = await SESTemplateService.templateExists(templateName);
    if (!templateExists) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    // Check if template is being used in any campaigns
    const Campaign = require('../models/Campaign');
    const campaignsUsingTemplate = await Campaign.countDocuments({
      templateName: templateName,
      status: { $in: ['running', 'scheduled'] }
    });

    if (campaignsUsingTemplate > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete template that is being used in active campaigns'
      });
    }

    // Delete template from SES
    await SESTemplateService.deleteTemplate(templateName);

    await SystemLog.create({
      level: 'info',
      category: 'system',
      message: 'SES email template deleted',
      details: { templateName },
      user: req.userId
    });

    logger.info('✅ SES template deleted', { templateName });

    res.json({
      success: true,
      message: 'Template deleted successfully from SES'
    });

  } catch (error) {
    logger.error('❌ Delete template error:', error);
    if (error.message.includes('does not exist')) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to delete template',
      error: error.message
    });
  }
};

// Get template usage statistics
exports.getTemplateUsage = async (req, res) => {
  try {
    const { id: templateName } = req.params;

    // Check if template exists in SES
    const templateExists = await SESTemplateService.templateExists(templateName);
    if (!templateExists) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    // Get campaigns using this template
    const Campaign = require('../models/Campaign');
    const campaigns = await Campaign.find({ templateName: templateName })
      .select('name status createdAt progress')
      .sort('-createdAt')
      .limit(10);

    // Get usage statistics from SES service
    const usage = await SESTemplateService.getTemplateUsage(templateName);

    res.json({
      success: true,
      data: {
        usage,
        recentCampaigns: campaigns
      }
    });

  } catch (error) {
    logger.error('❌ Get template usage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get template usage',
      error: error.message
    });
  }
};

// Validate HTML content
exports.validateHTML = async (req, res) => {
  try {
    const { htmlContent } = req.body;

    if (!htmlContent) {
      return res.status(400).json({
        success: false,
        message: 'HTML content is required'
      });
    }

    const validation = await validateHTML(htmlContent);

    res.json({
      success: true,
      data: {
        validation
      }
    });

  } catch (error) {
    logger.error('❌ HTML validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate HTML',
      error: error.message
    });
  }
};

// Generate text from HTML
exports.generateText = async (req, res) => {
  try {
    const { htmlContent } = req.body;

    if (!htmlContent) {
      return res.status(400).json({
        success: false,
        message: 'HTML content is required'
      });
    }

    const textContent = await generateTextFromHTML(htmlContent);

    res.json({
      success: true,
      data: {
        textBody: textContent
      }
    });

  } catch (error) {
    logger.error('❌ Text generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate text from HTML',
      error: error.message
    });
  }
};
