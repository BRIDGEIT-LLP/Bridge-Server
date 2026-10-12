
const { applicationLogger } = require('../configs/logger');

const requestResponseLogger = (req, res, next) => {

    const startTime = Date.now();

    const originalJson = res.json;
    const originalSend = res.send;

    let responseBody;

    // Capture res.json()
    res.json = function (body) {
        responseBody = body;
        return originalJson.call(this, body);
    };

    // Capture res.send()
    res.send = function (body) {
        responseBody = body;
        return originalSend.call(this, body);
    };

    res.on('finish', () => {

        const endTime = Date.now();
        const timeConsumed = `${endTime - startTime} ms`;

        // Determine log level
        let logLevel = 'info';

        if (res.statusCode >= 500) {
            logLevel = 'error';
        } else if (res.statusCode >= 400) {
            logLevel = 'warn';
        } else if (res.statusCode >= 300) {
            logLevel = 'warn';
        }

        const logMessage =
            `${logLevel.toUpperCase()} - ` +
            `${req.method} - ` +
            `${req.originalUrl} - ` +
            `${res.statusCode} - ` +
            `${timeConsumed} - ` +
            `Time: ${new Date()} - ` +
            `IP Address: ${req.headers["x-forwarded-for"]?.split(",")[0]} || ${req.socket.remoteAddress} - ` +
            `Browser: ${req.headers["sec-ch-ua"]} - ` +
            `Platform: ${req.headers["sec-ch-ua-platform"]} - ` +
            `Mobile: ${req.headers["sec-ch-ua-mobile"] === "?1"} - ` +
            `Origin: ${req.headers.origin} - ` +
            `REQUEST_HEADERS: ${JSON.stringify(req.headers)} - ` +
            `REQUEST_BODY: ${JSON.stringify(req.body)} - ` +
            `RESPONSE_HEADERS: ${JSON.stringify(res.getHeaders())} - ` +
            `RESPONSE_BODY: ${JSON.stringify(responseBody)}`;

        applicationLogger.log({
            level: logLevel,
            message: logMessage
        });
    });

    next();
};

module.exports = requestResponseLogger;