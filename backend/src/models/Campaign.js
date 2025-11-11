const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Campaign name is required'],
    trim: true,
    maxlength: [200, 'Campaign name cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'running', 'paused', 'completed', 'failed'],
    default: 'draft'
  },
  type: {
    type: String,
    enum: ['immediate', 'scheduled', 'recurring'],
    default: 'immediate'
  },
  templateName: {
    type: String,
    required: [true, 'Email template name is required'],
    trim: true,
    maxlength: [64, 'Template name cannot exceed 64 characters']
  },
  templateNames: {
    type: [String],
    default: [],
    validate: {
      validator: function(v) {
        // Either templateName or templateNames should exist
        return this.templateName || (v && v.length > 0);
      },
      message: 'Either templateName or templateNames must be provided'
    }
  },
  configuration: {
    domains: [{
      type: String,
      required: true
    }],
    senderEmails: [{
      email: {
        type: String,
        required: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
      },
      domain: {
        type: String,
        required: true
      },
      isActive: {
        type: Boolean,
        default: true
      }
    }],
    baseDailyTotal: {
      type: Number,
      required: true,
      min: 1
    },
    maxEmailPercentage: {
      type: Number,
      required: true,
      min: 1,
      max: 100
    },
    randomizationIntensity: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    quotaDays: {
      type: Number,
      default: 30
    },
    targetSum: {
      type: Number
    },
    templateData: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    enableListUnsubscribe: {
      type: Boolean,
      default: false
    },
    unsubscribeUrl: {
      type: String,
      trim: true
    },
    emailListSource: {
      type: String,
      enum: ['global', 'custom'],
      default: 'global'
    },
    customEmailListId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailList'
    },
    warmupMode: {
      enabled: {
        type: Boolean,
        default: false
      },
      currentIndex: {
        type: Number,
        default: 0
      }
    }
  },
  schedule: {
    startDate: {
      type: Date
    },
    endDate: {
      type: Date
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    recurringPattern: {
      type: String,
      enum: ['daily', 'weekly', 'monthly']
    }
  },
  progress: {
    currentDay: {
      type: Number,
      default: 1
    },
    currentHour: {
      type: Number,
      default: 0
    },
    totalSent: {
      type: Number,
      default: 0
    },
    totalDelivered: {
      type: Number,
      default: 0
    },
    totalFailed: {
      type: Number,
      default: 0
    },
    totalBounced: {
      type: Number,
      default: 0
    },
    totalOpened: {
      type: Number,
      default: 0
    },
    totalClicked: {
      type: Number,
      default: 0
    },
    totalUnsubscribed: {
      type: Number,
      default: 0
    },
    lastSentAt: {
      type: Date
    },
    lastDayTransitionAt: {
      type: Date
    },
    startedOnUTCDay: {
      type: String
    }
  },
  campaignPlan: {
    totalRecipients: {
      type: Number,
      default: 0
    },
    dailyPlans: [{
      day: {
        type: Number,
        required: true
      },
      totalEmails: {
        type: Number,
        required: true
      },
      domains: [{
        domain: String,
        totalEmails: Number,
        emails: [{
          email: String,
          totalEmails: Number,
          hours: [{
            hour: Number,
            count: Number,
            minutes: [Number]
          }]
        }]
      }],
      scheduledAt: {
        type: Date,
        default: Date.now
      }
    }],
    emailListStats: {
      totalEmails: Number,
      alreadySent: Number,
      unsubscribed: Number,
      availableToSend: Number
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  startedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  pausedAt: {
    type: Date
  },
  failedAt: {
    type: Date
  },
  errorMessage: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for performance
campaignSchema.index({ status: 1, createdAt: -1 });
campaignSchema.index({ createdBy: 1, status: 1 });
campaignSchema.index({ 'schedule.startDate': 1 });

module.exports = mongoose.model('Campaign', campaignSchema);
