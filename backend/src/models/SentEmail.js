const mongoose = require('mongoose');

const sentEmailSchema = new mongoose.Schema({
  campaign: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true,
    index: true
  },
  recipient: {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    domain: {
      type: String,
      required: true,
      index: true
    }
  },
  sender: {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    domain: {
      type: String,
      required: true
    }
  },
  templateName: {
    type: String,
    required: true,
    trim: true
  },
  messageId: {
    type: String,
    unique: true,
    sparse: true
  },
  status: {
    type: String,
    enum: ['queued', 'sent', 'delivered', 'failed', 'bounced', 'opened', 'clicked', 'unsubscribed'],
    default: 'queued',
    index: true
  },
  deliveryStatus: {
    sentAt: Date,
    deliveredAt: Date,
    bouncedAt: Date,
    failedAt: Date,
    openedAt: Date,
    clickedAt: Date,
    unsubscribedAt: Date
  },
  metadata: {
    day: {
      type: Number,
      required: true,
      index: true
    },
    hour: {
      type: Number,
      required: true
    },
    minute: {
      type: Number
    },
    second: {
      type: Number
    },
    attemptNumber: {
      type: Number,
      default: 1
    },
    queuedAt: Date,
    processingTime: Number // in milliseconds
  },
  errorDetails: {
    code: String,
    message: String,
    timestamp: Date
  },
  tracking: {
    openCount: {
      type: Number,
      default: 0
    },
    clickCount: {
      type: Number,
      default: 0
    },
    lastOpenedAt: Date,
    lastClickedAt: Date,
    userAgent: String,
    ipAddress: String
  }
}, {
  timestamps: true
});

// Compound indexes for common queries
sentEmailSchema.index({ campaign: 1, status: 1 });
sentEmailSchema.index({ campaign: 1, 'metadata.day': 1 });
// Modified unique index to allow re-sending in warmup mode (different days)
sentEmailSchema.index({ 'recipient.email': 1, campaign: 1, 'metadata.day': 1 }, { unique: true });
sentEmailSchema.index({ createdAt: -1 });
sentEmailSchema.index({ 'deliveryStatus.sentAt': -1 });

// Prevent duplicate sends
sentEmailSchema.pre('save', async function (next) {
  if (this.isNew) {
    const existing = await this.constructor.findOne({
      campaign: this.campaign,
      'recipient.email': this.recipient.email,
      'metadata.day': this.metadata.day // Check for duplicate only on the same day
    });

    if (existing) {
      const error = new Error('Email already sent to this recipient in this campaign on this day');
      error.code = 'DUPLICATE_EMAIL';
      return next(error);
    }
  }
  next();
});

module.exports = mongoose.model('SentEmail', sentEmailSchema);
