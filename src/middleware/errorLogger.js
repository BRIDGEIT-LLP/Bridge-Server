const { errorLogger } = require('../configs/logger');

const errorMiddleware = (err, req, res, next) => {
    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';
    const errors = err.errors || [];

    const errorMessage =
        'ERROR - ' +
        `${req.method} - ` +
        `${req.originalUrl} - ` +
        `STATUS: ${status} - ` +
        `MESSAGE: ${message} - ` +
        `ERRORS: ${JSON.stringify(errors)} - ` +
        `STACK: ${err.stack}`;

    errorLogger.error(errorMessage);

    res.status(status).json({
        success: false,
        message,
        errors
    });
};

module.exports = errorMiddleware;