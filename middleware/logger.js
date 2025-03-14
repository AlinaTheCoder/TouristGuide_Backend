// middleware/logger.js
const { createLogger, format, transports } = require('winston');

// Set desired log level from environment variable (LOG_LEVEL) or default to 'debug'
const logLevel = process.env.LOG_LEVEL || 'debug';

const logger = createLogger({
  level: logLevel,
  format: format.combine(
    // Include a timestamp
    format.timestamp(),
    // Customize how logs are printed
    format.printf(({ level, message, timestamp }) => {
      return `${timestamp} [${level.toUpperCase()}] : ${message}`;
    })
  ),
  transports: [
    // Log to console; add more transports (files, HTTP, etc.) as needed
    new transports.Console(),
  ],
});

module.exports = logger;
