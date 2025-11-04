const AWS = require('aws-sdk');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.ses = new AWS.SES({
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    });
    
    this.rateLimiter = {
      requests: [],
      maxRequests: 14,
      windowMs: 1000
    };
  }

  async sendEmail({ to, from, subject, htmlBody, textBody, templateData = {} }) {
    try {
      let processedHtml = htmlBody;
      let processedText = textBody || '';
      let processedSubject = subject;

      Object.keys(templateData).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        processedHtml = processedHtml.replace(regex, templateData[key]);
        processedText = processedText.replace(regex, templateData[key]);
        processedSubject = processedSubject.replace(regex, templateData[key]);
      });

      const params = {
        Source: from,
        Destination: {
          ToAddresses: [to]
        },
        Message: {
          Subject: {
            Data: processedSubject,
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: processedHtml,
              Charset: 'UTF-8'
            },
            Text: {
              Data: processedText,
              Charset: 'UTF-8'
            }
          }
        },
        ConfigurationSetName: process.env.SES_CONFIGURATION_SET || undefined
      };

      const result = await this.ses.sendEmail(params).promise();

      logger.debug('📧 Email sent successfully', {
        to,
        from,
        messageId: result.MessageId
      });

      return result;

    } catch (error) {
      logger.error('❌ Failed to send email:', {
        to,
        from,
        error: error.message
      });
      throw error;
    }
  }

  async sendTemplatedEmail({ to, from, templateName, templateData = {} }) {
    try {
      const params = {
        Source: from,
        Destination: {
          ToAddresses: [to]
        },
        Template: templateName,
        TemplateData: JSON.stringify(templateData),
        ConfigurationSetName: process.env.SES_CONFIGURATION_SET || undefined
      };

      const result = await this.ses.sendTemplatedEmail(params).promise();

      logger.debug('📧 Templated email sent successfully', {
        to,
        from,
        template: templateName,
        messageId: result.MessageId
      });

      return result;

    } catch (error) {
      logger.error('❌ Failed to send templated email:', {
        to,
        from,
        template: templateName,
        error: error.message
      });
      throw error;
    }
  }

  async sendEmailWithTemplate({ to, from, templateName, templateData = {} }) {
    try {
      await this.applyRateLimit();
      
      const params = {
        Source: from,
        Destination: {
          ToAddresses: [to]
        },
        Template: templateName,
        TemplateData: JSON.stringify(templateData),
        ConfigurationSetName: process.env.SES_CONFIGURATION_SET || undefined
      };

      const result = await this.ses.sendTemplatedEmail(params).promise();

      logger.debug('📧 Email sent with SES template', {
        to,
        from,
        template: templateName,
        messageId: result.MessageId
      });

      return result;

    } catch (error) {
      logger.error('❌ Failed to send email with SES template:', {
        to,
        from,
        template: templateName,
        error: error.message
      });
      throw error;
    }
  }

  async verifyEmailAddress(email) {
    try {
      const params = {
        EmailAddress: email
      };

      await this.ses.verifyEmailIdentity(params).promise();

      logger.info('✅ Email verification initiated', { email });

      return { success: true, message: 'Verification email sent' };

    } catch (error) {
      logger.error('❌ Failed to verify email:', {
        email,
        error: error.message
      });
      throw error;
    }
  }

  async getSendQuota() {
    try {
      const result = await this.ses.getSendQuota().promise();

      return {
        max24HourSend: result.Max24HourSend,
        maxSendRate: result.MaxSendRate,
        sentLast24Hours: result.SentLast24Hours,
        remaining24Hours: result.Max24HourSend - result.SentLast24Hours
      };

    } catch (error) {
      logger.error('❌ Failed to get send quota:', error);
      throw error;
    }
  }

  async getSendStatistics() {
    try {
      const result = await this.ses.getSendStatistics().promise();

      return result.SendDataPoints.map(point => ({
        timestamp: point.Timestamp,
        deliveryAttempts: point.DeliveryAttempts,
        bounces: point.Bounces,
        complaints: point.Complaints,
        rejects: point.Rejects
      }));

    } catch (error) {
      logger.error('❌ Failed to get send statistics:', error);
      throw error;
    }
  }

  async applyRateLimit() {
    const now = Date.now();
    
    this.rateLimiter.requests = this.rateLimiter.requests.filter(
      time => now - time < this.rateLimiter.windowMs
    );
    
    if (this.rateLimiter.requests.length >= this.rateLimiter.maxRequests) {
      const oldestRequest = Math.min(...this.rateLimiter.requests);
      const waitTime = this.rateLimiter.windowMs - (now - oldestRequest);
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.applyRateLimit();
      }
    }
    
    this.rateLimiter.requests.push(now);
  }

  async getTemplate(templateName) {
    try {
      const params = {
        TemplateName: templateName
      };

      const result = await this.ses.getTemplate(params).promise();
      
      return {
        TemplateName: result.Template.TemplateName,
        SubjectPart: result.Template.SubjectPart,
        HtmlPart: result.Template.HtmlPart,
        TextPart: result.Template.TextPart
      };

    } catch (error) {
      logger.error('❌ Failed to get template:', error);
      throw error;
    }
  }

  async getVerifiedDomains() {
    try {
      const result = await this.ses.listIdentities({
        IdentityType: 'Domain',
        MaxItems: 100
      }).promise();

      const domains = result.Identities || [];
      logger.info(`Found ${domains.length} domains in SES`);

      if (domains.length === 0) {
        logger.warn('No domains found in SES');
        return [];
      }

      // Get verification status for each domain
      const domainsWithStatus = await Promise.all(
        domains.map(async (domain) => {
          try {
            const attributes = await this.ses.getIdentityVerificationAttributes({
              Identities: [domain]
            }).promise();

            const verificationStatus = attributes.VerificationAttributes[domain]?.VerificationStatus || 'Unknown';
            
            logger.debug(`Domain ${domain} verification status: ${verificationStatus}`);
            
            return {
              domain,
              verificationStatus,
              verified: verificationStatus === 'Success'
            };
          } catch (error) {
            logger.warn(`Failed to get verification status for ${domain}:`, error.message);
            return {
              domain,
              verificationStatus: 'Unknown',
              verified: false
            };
          }
        })
      );

      // Log all domain statuses
      domainsWithStatus.forEach(d => {
        logger.info(`Domain: ${d.domain}, Status: ${d.verificationStatus}, Verified: ${d.verified}`);
      });

      // Filter only verified domains
      const verifiedDomains = domainsWithStatus
        .filter(d => d.verified)
        .map(d => d.domain);

      logger.info(`✅ Fetched ${verifiedDomains.length} verified domains from SES (out of ${domains.length} total)`);

      return verifiedDomains;

    } catch (error) {
      logger.error('❌ Failed to get verified domains:', error);
      // Return empty array instead of throwing to allow manual entry
      return [];
    }
  }
}

module.exports = new EmailService();
