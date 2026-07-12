const errorHandler = (err, req, res, next) => {
  console.error('API Error Handler Caught:', err);

  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  // Handle postgres database unique constraint error code '23505'
  if (err.code === '23505') {
    return res.status(400).json({
      error: 'Database Unique Constraint Violation: Duplicate field values are not allowed.'
    });
  }

  // Handle postgres foreign key violation error code '23503'
  if (err.code === '23503') {
    return res.status(400).json({
      error: 'Database Foreign Key Constraint Violation: Referenced key check failed.'
    });
  }

  res.status(status).json({
    error: message,
  });
};

module.exports = errorHandler;
