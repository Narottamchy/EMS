require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');

const connectDB = require('./config/database');
const QueueService = require('./services/QueueService');
const DayTransitionScheduler = require('./services/DayTransitionScheduler');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth.routes');
const campaignRoutes = require('./routes/campaign.routes');
const templateRoutes = require('./routes/template.routes');
const emailRoutes = require('./routes/email.routes');
const emailListRoutes = require('./routes/emailList.routes');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

app.set('io', io);
app.use(helmet());
app.use(mongoSanitize());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 5 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later'
});

app.use('/api/', limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Email Campaign Management System is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

const API_PREFIX = process.env.API_PREFIX || '/api/v1';

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/campaigns`, campaignRoutes);
app.use(`${API_PREFIX}/templates`, templateRoutes);
app.use(`${API_PREFIX}/emails`, emailRoutes);
app.use(`${API_PREFIX}/email-lists`, emailListRoutes);

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Email Campaign Management System API',
    version: '3.0.0',
    documentation: '/api/docs',
    endpoints: {
      auth: `${API_PREFIX}/auth`,
      campaigns: `${API_PREFIX}/campaigns`,
      templates: `${API_PREFIX}/templates`
    }
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

app.use(errorHandler);
io.on('connection', (socket) => {
  socket.on('subscribe-campaign', (campaignId) => {
    socket.join(`campaign-${campaignId}`);
  });

  socket.on('unsubscribe-campaign', (campaignId) => {
    socket.leave(`campaign-${campaignId}`);
  });

  socket.on('disconnect', () => {
    // Connection closed
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    QueueService.setSocketIO(io);
    await QueueService.initialize();

    // Initialize Day Transition Scheduler
    DayTransitionScheduler.initialize();

    // Create default admin user if not exists
    const User = require('./models/User');
    const adminExists = await User.findOne({ role: 'admin' });
    
    if (!adminExists) {
      const admin = new User({
        name: process.env.ADMIN_NAME || 'Admin',
        email: process.env.ADMIN_EMAIL || 'admin@example.com',
        password: process.env.ADMIN_PASSWORD || 'changeme123',
        role: 'admin',
        isActive: true
      });
      await admin.save();
      logger.info('✅ Default admin user created', { email: admin.email });
    }

    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔗 API: http://localhost:${PORT}${API_PREFIX}`);
      logger.info(`💻 Frontend: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
    });

  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

const gracefulShutdown = async () => {
  logger.info('Shutting down gracefully...');

  try {
    // Close server
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // Stop day transition scheduler
    DayTransitionScheduler.stop();

    await QueueService.shutdown();

    const mongoose = require('mongoose');
    await mongoose.connection.close();

    logger.info('✅ Graceful shutdown completed');
    process.exit(0);

  } catch (error) {
    logger.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

process.on('uncaughtException', (error) => {
  logger.error('❌ Uncaught Exception:', error);
  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ Unhandled Rejection:', { reason, promise });
  gracefulShutdown();
});

startServer();

module.exports = app;
