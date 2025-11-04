const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

const logDir = process.env.LOG_DIR || 'logs';
const logLevel = process.env.LOG_LEVEL || 'info';

// Custom format
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format with colors
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Transport configurations
const transports = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat,
    level: logLevel
  }),

  // Error log file
  new DailyRotateFile({
    filename: path.join(logDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    format: customFormat,
    maxSize: '20m',
    maxFiles: '30d',
    zippedArchive: true
  }),

  // Combined log file
  new DailyRotateFile({
    filename: path.join(logDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    format: customFormat,
    maxSize: '20m',
    maxFiles: '30d',
    zippedArchive: true
  }),

  // Campaign-specific log file
  new DailyRotateFile({
    filename: path.join(logDir, 'campaign-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'info',
    format: customFormat,
    maxSize: '20m',
    maxFiles: '30d',
    zippedArchive: true
  })
];

// Create logger
const logger = winston.createLogger({
  level: logLevel,
  format: customFormat,
  transports,
  exitOnError: false
});

// Add stream for Morgan HTTP logging
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

module.exports = logger;
