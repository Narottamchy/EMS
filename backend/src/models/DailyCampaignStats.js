const mongoose = require('mongoose');

const dailyCampaignStatsSchema = new mongoose.Schema({
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
  dateString: {
    type: String, // Format: YYYY-MM-DD for easy querying
    required: true,
    index: true
  },
  campaignDay: {
    type: Number,
    required: true,
    index: true
  },
  stats: {
    totalScheduled: {
      type: Number,
      default: 0
    },
    totalSent: {
      type: Number,
      default: 0
    },
    totalFailed: {
      type: Number,
      default: 0
    },
    totalQueued: {
      type: Number,
      default: 0
    }
  },
  // Breakdown by sender email
  senderBreakdown: [{
    senderEmail: {
      type: String,
      required: true
    },
    domain: {
      type: String,
      required: true
    },
    sent: {
      type: Number,
      default: 0
    },
    failed: {
      type: Number,
      default: 0
    },
    queued: {
      type: Number,
      default: 0
    }
  }],
  // Breakdown by hour
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
    failed: {
      type: Number,
      default: 0
    },
    queued: {
      type: Number,
      default: 0
    }
  }],
  // Breakdown by recipient domain
  recipientDomainBreakdown: [{
    domain: {
      type: String,
      required: true
    },
    sent: {
      type: Number,
      default: 0
    },
    failed: {
      type: Number,
      default: 0
    }
  }],
  metadata: {
    lastUpdatedAt: {
      type: Date,
      default: Date.now
    },
    updateCount: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Compound indexes for efficient querying
dailyCampaignStatsSchema.index({ campaign: 1, dateString: 1 }, { unique: true });
dailyCampaignStatsSchema.index({ campaign: 1, date: -1 });
dailyCampaignStatsSchema.index({ campaign: 1, campaignDay: 1 });

// Method to increment stats
dailyCampaignStatsSchema.methods.incrementStat = function(statType, senderEmail, domain, recipientDomain, hour) {
  // Update overall stats
  if (statType === 'sent') {
    this.stats.totalSent += 1;
  } else if (statType === 'failed') {
    this.stats.totalFailed += 1;
  } else if (statType === 'queued') {
    this.stats.totalQueued += 1;
  }

  // Update sender breakdown
  let senderStat = this.senderBreakdown.find(s => s.senderEmail === senderEmail);
  if (!senderStat) {
    senderStat = {
      senderEmail,
      domain,
      sent: 0,
      failed: 0,
      queued: 0
    };
    this.senderBreakdown.push(senderStat);
  }
  senderStat[statType] = (senderStat[statType] || 0) + 1;

  // Update hourly breakdown
  if (hour !== undefined && hour !== null) {
    let hourlyStat = this.hourlyBreakdown.find(h => h.hour === hour);
    if (!hourlyStat) {
      hourlyStat = {
        hour,
        sent: 0,
        failed: 0,
        queued: 0
      };
      this.hourlyBreakdown.push(hourlyStat);
    }
    hourlyStat[statType] = (hourlyStat[statType] || 0) + 1;
  }

  // Update recipient domain breakdown
  if (recipientDomain && (statType === 'sent' || statType === 'failed')) {
    let domainStat = this.recipientDomainBreakdown.find(d => d.domain === recipientDomain);
    if (!domainStat) {
      domainStat = {
        domain: recipientDomain,
        sent: 0,
        failed: 0
      };
      this.recipientDomainBreakdown.push(domainStat);
    }
    domainStat[statType] = (domainStat[statType] || 0) + 1;
  }

  // Update metadata
  this.metadata.lastUpdatedAt = new Date();
  this.metadata.updateCount += 1;
};

module.exports = mongoose.model('DailyCampaignStats', dailyCampaignStatsSchema);
