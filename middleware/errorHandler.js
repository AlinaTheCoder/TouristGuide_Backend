function errorHandler(err, req, res, next) {
    console.error('Global Error Handler:', err);
    // If headers have already been sent, delegate to the default Express error handler.
    if (res.headersSent) {
      return next(err);
    }
    res.status(err.status || 500).send({
      error: err.message || 'Internal Server Error. Please try again later.'
    });
  }
  
  module.exports = errorHandler;