const AWS = require('aws-sdk');
const csv = require('csv-parser');
const logger = require('../utils/logger');
const SentEmail = require('../models/SentEmail');
const EmailService = require('../services/EmailService');

// Initialize AWS S3
const s3 = new AWS.S3({
  region: process.env.AWS_REGION || 'us-east-1'
});

// Get email list with pagination
exports.getEmailList = async (req, res) => {
  try {
    // Check if AWS S3 environment variables are configured
    if (!process.env.S3_BUCKET || !process.env.EMAIL_LIST_KEY) {
      return res.status(500).json({
        success: false,
        message: 'AWS S3 configuration missing. Please set S3_BUCKET and EMAIL_LIST_KEY environment variables.',
        error: 'Missing S3 configuration'
      });
    }

    const { page = 1, limit = 50 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: process.env.EMAIL_LIST_KEY
    };

    const stream = s3.getObject(params).createReadStream();
    const emails = [];
    let currentIndex = 0;

    return new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (row) => {
          if (row.Email && row.Username) {
            emails.push({
              email: row.Email.toLowerCase().trim(),
              username: row.Username.trim()
            });
          }
        })
        .on('end', async () => {
          // Apply pagination
          const totalEmails = emails.length;
          const paginatedEmails = emails.slice(offset, offset + limitNum);
          const totalPages = Math.ceil(totalEmails / limitNum);

          // Get all unique email addresses from paginated list
          const emailAddresses = paginatedEmails.map(e => e.email);
          
          // Check which emails have received emails across ALL campaigns
          const sentEmails = await SentEmail.find({
            'recipient.email': { $in: emailAddresses }
          }).select('recipient.email createdAt');

          // Create a Map to track sent status
          const sentEmailMap = new Map();
          sentEmails.forEach(sent => {
            const email = sent.recipient.email;
            if (!sentEmailMap.has(email)) {
              sentEmailMap.set(email, {
                hasReceivedEmail: true,
                firstReceivedAt: sent.createdAt,
                campaignsReceived: 1
              });
            } else {
              // Update the map if this is an earlier sent date
              const existing = sentEmailMap.get(email);
              if (sent.createdAt < existing.firstReceivedAt) {
                existing.firstReceivedAt = sent.createdAt;
              }
              existing.campaignsReceived += 1;
            }
          });

          // Add sent status to each email
          const emailsWithStatus = paginatedEmails.map(email => ({
            ...email,
            hasReceivedEmail: sentEmailMap.has(email.email),
            firstReceivedAt: sentEmailMap.get(email.email)?.firstReceivedAt || null,
            campaignsReceived: sentEmailMap.get(email.email)?.campaignsReceived || 0
          }));

          logger.info(`✅ Fetched email list: ${paginatedEmails.length} emails (page ${pageNum}/${totalPages}), ${sentEmailMap.size} have received emails`);

          res.json({
            success: true,
            data: {
              emails: emailsWithStatus,
              pagination: {
                currentPage: pageNum,
                totalPages,
                totalEmails,
                limit: limitNum,
                hasNext: pageNum < totalPages,
                hasPrev: pageNum > 1
              }
            }
          });
        })
        .on('error', (error) => {
          logger.error('❌ Failed to fetch email list:', error);
          // Return empty list instead of rejecting
          res.json({
            success: true,
            data: {
              emails: [],
              pagination: {
                currentPage: pageNum,
                totalPages: 0,
                totalEmails: 0,
                limit: limitNum,
                hasNext: false,
                hasPrev: false
              }
            },
            warning: 'Unable to fetch email list, showing empty list'
          });
        });
    });

  } catch (error) {
    logger.error('❌ Email list error:', error);
    // Always return success to prevent frontend errors
    res.json({
      success: true,
      data: {
        emails: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalEmails: 0,
          limit: 50,
          hasNext: false,
          hasPrev: false
        }
      },
      warning: 'Unable to fetch email list, showing empty list'
    });
  }
};

// Get unsubscribed users list
exports.getUnsubscribedList = async (req, res) => {
  try {
    // Check if AWS S3 environment variables are configured
    if (!process.env.S3_BUCKET || !process.env.UNSUBSCRIBED_KEY) {
      return res.status(500).json({
        success: false,
        message: 'AWS S3 configuration missing. Please set S3_BUCKET and UNSUBSCRIBED_KEY environment variables.',
        error: 'Missing S3 configuration'
      });
    }

    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: process.env.UNSUBSCRIBED_KEY
    };

    const data = await s3.getObject(params).promise();
    const content = data.Body.toString('utf-8');
    
    const unsubscribedUsers = content
      .split('\n')
      .map(line => {
        const [email, timestamp] = line.split(',');
        if (email && timestamp) {
          const timestampNum = parseInt(timestamp);
          // Validate timestamp (should be a reasonable Unix timestamp)
          if (isNaN(timestampNum) || timestampNum < 0 || timestampNum > 9999999999) {
            logger.warn(`Invalid timestamp for email ${email}: ${timestamp}`);
            return {
              email: email.toLowerCase().trim(),
              timestamp: Math.floor(Date.now() / 1000), // Use current time as fallback
              unsubscribedAt: new Date().toISOString()
            };
          }
          
          try {
            const date = new Date(timestampNum * 1000);
            if (isNaN(date.getTime())) {
              throw new Error('Invalid date');
            }
            return {
              email: email.toLowerCase().trim(),
              timestamp: timestampNum,
              unsubscribedAt: date.toISOString()
            };
          } catch (error) {
            logger.warn(`Date parsing failed for email ${email}: ${error.message}`);
            return {
              email: email.toLowerCase().trim(),
              timestamp: Math.floor(Date.now() / 1000), // Use current time as fallback
              unsubscribedAt: new Date().toISOString()
            };
          }
        }
        return null;
      })
      .filter(user => user !== null);

    logger.info(`✅ Fetched unsubscribed list: ${unsubscribedUsers.length} users`);

    res.json({
      success: true,
      data: {
        unsubscribedUsers,
        totalCount: unsubscribedUsers.length
      }
    });

  } catch (error) {
    if (error.code === 'NoSuchKey') {
      logger.info('📝 No unsubscribed list found');
      res.json({
        success: true,
        data: {
          unsubscribedUsers: [],
          totalCount: 0
        }
      });
    } else {
      logger.error('❌ Unsubscribed list error:', error);
      // Always return success to prevent frontend errors
      res.json({
        success: true,
        data: {
          unsubscribedUsers: [],
          totalCount: 0
        },
        warning: 'Unable to fetch unsubscribed list, showing empty list'
      });
    }
  }
};

// Get email statistics
exports.getEmailStats = async (req, res) => {
  try {
    // Check if AWS S3 environment variables are configured
    if (!process.env.S3_BUCKET || !process.env.EMAIL_LIST_KEY) {
      return res.status(500).json({
        success: false,
        message: 'AWS S3 configuration missing. Please set S3_BUCKET and EMAIL_LIST_KEY environment variables.',
        error: 'Missing S3 configuration'
      });
    }

    // Get total email count
    const emailListParams = {
      Bucket: process.env.S3_BUCKET,
      Key: process.env.EMAIL_LIST_KEY
    };

    const emailStream = s3.getObject(emailListParams).createReadStream();
    let totalEmails = 0;

    const emailPromise = new Promise((resolve, reject) => {
      emailStream
        .pipe(csv())
        .on('data', (row) => {
          if (row.Email) {
            totalEmails++;
          }
        })
        .on('end', () => resolve(totalEmails))
        .on('error', reject);
    });

    // Get unsubscribed count
    let unsubscribedCount = 0;
    try {
      const unsubscribedParams = {
        Bucket: process.env.S3_BUCKET,
        Key: process.env.UNSUBSCRIBED_KEY
      };

      const unsubscribedData = await s3.getObject(unsubscribedParams).promise();
      const unsubscribedContent = unsubscribedData.Body.toString('utf-8');
      unsubscribedCount = unsubscribedContent.split('\n').filter(line => line.trim()).length;
    } catch (error) {
      if (error.code !== 'NoSuchKey') {
        throw error;
      }
    }

    await emailPromise;

    const activeEmails = totalEmails - unsubscribedCount;

    logger.info(`✅ Email stats: ${totalEmails} total, ${unsubscribedCount} unsubscribed, ${activeEmails} active`);

    res.json({
      success: true,
      data: {
        totalEmails,
        unsubscribedCount,
        activeEmails,
        unsubscribedPercentage: totalEmails > 0 ? ((unsubscribedCount / totalEmails) * 100).toFixed(2) : 0
      }
    });

  } catch (error) {
    logger.error('❌ Email stats error:', error);
    // Always return success to prevent frontend errors
    res.json({
      success: true,
      data: {
        totalEmails: 0,
        unsubscribedCount: 0,
        activeEmails: 0,
        unsubscribedPercentage: 0
      },
      warning: 'Unable to fetch email statistics, showing zero values'
    });
  }
};

// Get verified domains from SES
exports.getVerifiedDomains = async (req, res) => {
  try {
    const domains = await EmailService.getVerifiedDomains();

    res.json({
      success: true,
      data: {
        domains: domains || []
      }
    });

  } catch (error) {
    logger.error('❌ Failed to get verified domains:', error);
    // Return empty array instead of error to allow manual entry
    res.json({
      success: true,
      data: {
        domains: []
      },
      warning: 'Could not fetch domains from SES. You can enter domains manually.'
    });
  }
};
