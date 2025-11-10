const AWS = require('aws-sdk');
const csv = require('csv-parser');
const multer = require('multer');
const { Readable } = require('stream');
const EmailList = require('../models/EmailList');
const logger = require('../utils/logger');

// Initialize AWS S3
const s3 = new AWS.S3({
  region: process.env.AWS_REGION || 'us-east-1'
});

// Configure multer for file upload (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Upload email list
exports.uploadEmailList = [
  upload.single('file'),
  async (req, res) => {
    try {
      const { name, description } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Email list name is required'
        });
      }

      // Parse CSV to count emails and validate format
      const emails = [];
      const stream = Readable.from(file.buffer);

      await new Promise((resolve, reject) => {
        stream
          .pipe(csv())
          .on('data', (row) => {
            // Check for email column (case-insensitive)
            const email = row.email || row.Email || row.EMAIL;
            if (email && email.trim()) {
              emails.push(email.toLowerCase().trim());
            }
          })
          .on('end', resolve)
          .on('error', reject);
      });

      if (emails.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid emails found in CSV file. Please ensure the CSV has an "email" column.'
        });
      }

      // Remove duplicates
      const uniqueEmails = [...new Set(emails)];

      // Generate S3 key
      const timestamp = Date.now();
      const s3Key = `email-lists/${req.userId}/${timestamp}-${file.originalname}`;

      // Upload to S3
      const uploadParams = {
        Bucket: process.env.S3_BUCKET,
        Key: s3Key,
        Body: file.buffer,
        ContentType: 'text/csv'
      };

      await s3.upload(uploadParams).promise();

      // Create email list record
      const emailList = new EmailList({
        name,
        description,
        type: 'custom',
        s3Key,
        emailCount: uniqueEmails.length,
        fileName: file.originalname,
        fileSize: file.size,
        uploadedBy: req.userId,
        isActive: true
      });

      await emailList.save();

      logger.info('✅ Email list uploaded', {
        emailListId: emailList._id,
        name,
        emailCount: uniqueEmails.length,
        uploadedBy: req.userId
      });

      res.status(201).json({
        success: true,
        message: 'Email list uploaded successfully',
        data: {
          emailList: {
            id: emailList._id,
            name: emailList.name,
            description: emailList.description,
            emailCount: emailList.emailCount,
            fileName: emailList.fileName,
            fileSize: emailList.fileSize,
            createdAt: emailList.createdAt
          }
        }
      });

    } catch (error) {
      logger.error('❌ Upload email list error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upload email list',
        error: error.message
      });
    }
  }
];

// Get all email lists
exports.getEmailLists = async (req, res) => {
  try {
    const { page = 1, limit = 20, type } = req.query;

    const query = { isActive: true };
    
    // Non-admin users can only see their own custom lists and global lists
    if (req.user.role !== 'admin') {
      query.$or = [
        { uploadedBy: req.userId },
        { type: 'global' }
      ];
    }

    if (type) {
      query.type = type;
    }

    const emailLists = await EmailList.find(query)
      .populate('uploadedBy', 'name email')
      .sort('-createdAt')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const count = await EmailList.countDocuments(query);

    res.json({
      success: true,
      data: {
        emailLists,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalItems: count,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    logger.error('❌ Get email lists error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get email lists',
      error: error.message
    });
  }
};

// Get email list by ID
exports.getEmailListById = async (req, res) => {
  try {
    const { id } = req.params;

    const emailList = await EmailList.findById(id)
      .populate('uploadedBy', 'name email');

    if (!emailList) {
      return res.status(404).json({
        success: false,
        message: 'Email list not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'admin' && 
        emailList.type !== 'global' && 
        emailList.uploadedBy._id.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: { emailList }
    });

  } catch (error) {
    logger.error('❌ Get email list error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get email list',
      error: error.message
    });
  }
};

// Get email list preview (first N emails)
exports.getEmailListPreview = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;

    const emailList = await EmailList.findById(id);

    if (!emailList) {
      return res.status(404).json({
        success: false,
        message: 'Email list not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'admin' && 
        emailList.type !== 'global' && 
        emailList.uploadedBy.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Fetch from S3
    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: emailList.s3Key
    };

    const stream = s3.getObject(params).createReadStream();
    const emails = [];

    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (row) => {
          if (emails.length < limit) {
            const email = row.email || row.Email || row.EMAIL;
            const username = row.username || row.Username || row.USERNAME || email.split('@')[0];
            if (email) {
              emails.push({
                email: email.toLowerCase().trim(),
                username: username.trim()
              });
            }
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    res.json({
      success: true,
      data: {
        emailList: {
          id: emailList._id,
          name: emailList.name,
          totalCount: emailList.emailCount
        },
        emails,
        previewCount: emails.length
      }
    });

  } catch (error) {
    logger.error('❌ Get email list preview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get email list preview',
      error: error.message
    });
  }
};

// Delete email list
exports.deleteEmailList = async (req, res) => {
  try {
    const { id } = req.params;

    const emailList = await EmailList.findById(id);

    if (!emailList) {
      return res.status(404).json({
        success: false,
        message: 'Email list not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'admin' && 
        emailList.uploadedBy.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Soft delete
    emailList.isActive = false;
    await emailList.save();

    // Optionally delete from S3
    // await s3.deleteObject({
    //   Bucket: process.env.S3_BUCKET,
    //   Key: emailList.s3Key
    // }).promise();

    logger.info('✅ Email list deleted', { emailListId: id });

    res.json({
      success: true,
      message: 'Email list deleted successfully'
    });

  } catch (error) {
    logger.error('❌ Delete email list error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete email list',
      error: error.message
    });
  }
};

// Update email list
exports.updateEmailList = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const emailList = await EmailList.findById(id);

    if (!emailList) {
      return res.status(404).json({
        success: false,
        message: 'Email list not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'admin' && 
        emailList.uploadedBy.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (name) emailList.name = name;
    if (description !== undefined) emailList.description = description;

    await emailList.save();

    logger.info('✅ Email list updated', { emailListId: id });

    res.json({
      success: true,
      message: 'Email list updated successfully',
      data: { emailList }
    });

  } catch (error) {
    logger.error('❌ Update email list error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update email list',
      error: error.message
    });
  }
};
