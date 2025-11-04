const mongoose = require('mongoose');

const systemLogSchema = new mongoose.Schema({
  level: {
    type: String,
    enum: ['info', 'warn', 'error', 'debug'],
    required: true,
    index: true
  },
  category: {
    type: String,
    enum: ['campaign', 'email', 'queue', 'auth', 'system', 'api'],
    required: true,
    index: true
  },
  message: {
    type: String,
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  },
  campaign: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    endpoint: String,
    method: String,
    statusCode: Number,
    responseTime: Number,
    errorStack: String
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
systemLogSchema.index({ level: 1, createdAt: -1 });
systemLogSchema.index({ category: 1, createdAt: -1 });
systemLogSchema.index({ campaign: 1, createdAt: -1 });
systemLogSchema.index({ createdAt: -1 });

// TTL index to auto-delete old logs after 90 days
systemLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

module.exports = mongoose.model('SystemLog', systemLogSchema);
