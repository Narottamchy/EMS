const mongoose = require('mongoose');

const dailyAnalyticsSchema = new mongoose.Schema({
  campaign: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true,
    index: true
  },
  date: {
    type: Date,
    required: true,
    index: true
  },
  day: {
    type: Number,
    required: true
  },
  summary: {
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
    uniqueOpens: {
      type: Number,
      default: 0
    },
    uniqueClicks: {
      type: Number,
      default: 0
    }
  },
  rates: {
    deliveryRate: {
      type: Number,
      default: 0
    },
    bounceRate: {
      type: Number,
      default: 0
    },
    openRate: {
      type: Number,
      default: 0
    },
    clickRate: {
      type: Number,
      default: 0
    },
    unsubscribeRate: {
      type: Number,
      default: 0
    },
    clickToOpenRate: {
      type: Number,
      default: 0
    }
  },
  hourlyBreakdown: [{
    hour: {
      type: Number,
      required: true,
      min: 0,
      max: 23
    },
    sent: {
      type: Number,
      default: 0
    },
    delivered: {
      type: Number,
      default: 0
    },
    failed: {
      type: Number,
      default: 0
    },
    opened: {
      type: Number,
      default: 0
    },
    clicked: {
      type: Number,
      default: 0
    }
  }],
  domainBreakdown: [{
    domain: {
      type: String,
      required: true
    },
    sent: {
      type: Number,
      default: 0
    },
    delivered: {
      type: Number,
      default: 0
    },
    failed: {
      type: Number,
      default: 0
    },
    bounced: {
      type: Number,
      default: 0
    }
  }],
  senderBreakdown: [{
    email: {
      type: String,
      required: true
    },
    sent: {
      type: Number,
      default: 0
    },
    delivered: {
      type: Number,
      default: 0
    },
    failed: {
      type: Number,
      default: 0
    }
  }],
  performance: {
    averageProcessingTime: {
      type: Number,
      default: 0
    },
    peakHour: {
      type: Number
    },
    peakHourVolume: {
      type: Number
    }
  }
}, {
  timestamps: true
});

// Compound indexes
dailyAnalyticsSchema.index({ campaign: 1, date: -1 });
dailyAnalyticsSchema.index({ campaign: 1, day: 1 }, { unique: true });

// Calculate rates before saving
dailyAnalyticsSchema.pre('save', function(next) {
  const { totalSent, totalDelivered, totalBounced, totalOpened, totalClicked, totalUnsubscribed, uniqueOpens } = this.summary;
  
  if (totalSent > 0) {
    this.rates.deliveryRate = ((totalDelivered / totalSent) * 100).toFixed(2);
    this.rates.bounceRate = ((totalBounced / totalSent) * 100).toFixed(2);
    this.rates.unsubscribeRate = ((totalUnsubscribed / totalSent) * 100).toFixed(2);
  }
  
  if (totalDelivered > 0) {
    this.rates.openRate = ((totalOpened / totalDelivered) * 100).toFixed(2);
    this.rates.clickRate = ((totalClicked / totalDelivered) * 100).toFixed(2);
  }
  
  if (uniqueOpens > 0) {
    this.rates.clickToOpenRate = ((totalClicked / uniqueOpens) * 100).toFixed(2);
  }
  
  next();
});

module.exports = mongoose.model('DailyAnalytics', dailyAnalyticsSchema);
