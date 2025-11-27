const mongoose = require('mongoose');

const campaignEventSchema = new mongoose.Schema({
    campaign: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Campaign',
        required: true,
        index: true
    },
    messageId: {
        type: String,
        required: true,
        index: true
    },
    eventType: {
        type: String,
        required: true,
        enum: ['Send', 'Delivery', 'Open', 'Click', 'Bounce', 'Complaint', 'Reject', 'Rendering Failure'],
        index: true
    },
    timestamp: {
        type: Date,
        required: true,
        index: true
    },
    recipient: {
        type: String,
        required: true,
        index: true
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    userAgent: String,
    ipAddress: String,
    link: String // For clicks
}, {
    timestamps: true
});

// Indexes for analytics
campaignEventSchema.index({ campaign: 1, eventType: 1 });
campaignEventSchema.index({ campaign: 1, timestamp: 1 });

module.exports = mongoose.model('CampaignEvent', campaignEventSchema);
