const AWS = require('aws-sdk');
const logger = require('../utils/logger');

class SESTemplateService {
  constructor() {
    this.ses = new AWS.SES({
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    });
  }

  /**
   * Get all SES templates
   */
  async getAllTemplates() {
    try {
      const params = {
        MaxItems: 50 // SES limit
      };

      const result = await this.ses.listTemplates(params).promise();
      
      // Get detailed information for each template
      const templates = await Promise.all(
        result.TemplatesMetadata.map(async (template) => {
          try {
            const templateDetails = await this.getTemplate(template.Name);
            return {
              name: template.Name,
              subject: templateDetails.Template.SubjectPart,
              htmlBody: templateDetails.Template.HtmlPart,
              textBody: templateDetails.Template.TextPart,
              createdAt: new Date(template.CreatedTimestamp).toISOString(),
              lastModified: new Date(template.CreatedTimestamp).toISOString(), // SES doesn't provide last modified
              isActive: true // All SES templates are considered active
            };
          } catch (error) {
            logger.warn(`Failed to get details for template ${template.Name}:`, error.message);
            return {
              name: template.Name,
              subject: 'N/A',
              htmlBody: 'N/A',
              textBody: 'N/A',
              createdAt: new Date(template.CreatedTimestamp).toISOString(),
              lastModified: new Date(template.CreatedTimestamp).toISOString(),
              isActive: false,
              error: 'Failed to fetch template details'
            };
          }
        })
      );

      logger.info(`✅ Fetched ${templates.length} SES templates`);
      return templates;

    } catch (error) {
      logger.error('❌ Failed to get SES templates:', error);
      throw error;
    }
  }

  /**
   * Get a specific SES template by name
   */
  async getTemplate(templateName) {
    try {
      const params = {
        TemplateName: templateName
      };

      const result = await this.ses.getTemplate(params).promise();
      
      logger.debug(`✅ Fetched SES template: ${templateName}`);
      return result;

    } catch (error) {
      if (error.code === 'TemplateDoesNotExist') {
        throw new Error(`Template '${templateName}' does not exist`);
      }
      logger.error(`❌ Failed to get SES template ${templateName}:`, error);
      throw error;
    }
  }

  /**
   * Create a new SES template
   */
  async createTemplate(templateData) {
    try {
      const { name, subject, htmlBody, textBody } = templateData;

      const params = {
        Template: {
          TemplateName: name,
          SubjectPart: subject,
          HtmlPart: htmlBody,
          TextPart: textBody || ''
        }
      };

      const result = await this.ses.createTemplate(params).promise();
      
      logger.info(`✅ Created SES template: ${name}`);
      return result;

    } catch (error) {
      if (error.code === 'AlreadyExists') {
        throw new Error(`Template '${templateData.name}' already exists`);
      }
      logger.error('❌ Failed to create SES template:', error);
      throw error;
    }
  }

  /**
   * Update an existing SES template
   */
  async updateTemplate(templateName, templateData) {
    try {
      const { subject, htmlBody, textBody } = templateData;

      const params = {
        Template: {
          TemplateName: templateName,
          SubjectPart: subject,
          HtmlPart: htmlBody,
          TextPart: textBody || ''
        }
      };

      const result = await this.ses.updateTemplate(params).promise();
      
      logger.info(`✅ Updated SES template: ${templateName}`);
      return result;

    } catch (error) {
      if (error.code === 'TemplateDoesNotExist') {
        throw new Error(`Template '${templateName}' does not exist`);
      }
      logger.error(`❌ Failed to update SES template ${templateName}:`, error);
      throw error;
    }
  }

  /**
   * Delete an SES template
   */
  async deleteTemplate(templateName) {
    try {
      const params = {
        TemplateName: templateName
      };

      const result = await this.ses.deleteTemplate(params).promise();
      
      logger.info(`✅ Deleted SES template: ${templateName}`);
      return result;

    } catch (error) {
      if (error.code === 'TemplateDoesNotExist') {
        throw new Error(`Template '${templateName}' does not exist`);
      }
      logger.error(`❌ Failed to delete SES template ${templateName}:`, error);
      throw error;
    }
  }

  /**
   * Check if a template exists
   */
  async templateExists(templateName) {
    try {
      await this.getTemplate(templateName);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get template usage statistics (placeholder - SES doesn't provide this directly)
   */
  async getTemplateUsage(templateName) {
    try {
      // SES doesn't provide direct usage statistics
      // This would need to be tracked separately or through CloudWatch
      return {
        totalEmailsSent: 0,
        lastUsedAt: null,
        campaigns: []
      };
    } catch (error) {
      logger.error(`❌ Failed to get usage for template ${templateName}:`, error);
      throw error;
    }
  }

  /**
   * Validate template data
   */
  validateTemplateData(templateData) {
    const { name, subject, htmlBody } = templateData;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new Error('Template name is required and must be a non-empty string');
    }
    
    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      throw new Error('Template subject is required and must be a non-empty string');
    }
    
    if (!htmlBody || typeof htmlBody !== 'string' || htmlBody.trim().length === 0) {
      throw new Error('Template HTML body is required and must be a non-empty string');
    }
    
    // SES template name validation
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new Error('Template name can only contain letters, numbers, hyphens, and underscores');
    }
    
    if (name.length > 64) {
      throw new Error('Template name cannot exceed 64 characters');
    }
    
    return true;
  }
}

module.exports = new SESTemplateService();
