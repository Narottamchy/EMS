const mongoose = require('mongoose');

const emailListSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Email list name is required'],
    trim: true,
    maxlength: [200, 'Email list name cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  type: {
    type: String,
    enum: ['custom', 'global'],
    default: 'custom'
  },
  s3Key: {
    type: String,
    required: true,
    trim: true
  },
  emailCount: {
    type: Number,
    default: 0
  },
  fileName: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  metadata: {
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    lastUsedAt: {
      type: Date
    },
    usageCount: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Indexes for performance
emailListSchema.index({ uploadedBy: 1, isActive: 1 });
emailListSchema.index({ type: 1, isActive: 1 });
emailListSchema.index({ createdAt: -1 });

module.exports = mongoose.model('EmailList', emailListSchema);
