const scanErrorMiddleware = (err, req, res, next) => {
    if (err.name === "MulterError") {
        return res.status(400).json({
            success: false,
            message: err.message,
        });
    }

    if (err) {
        return res.status(400).json({
            success: false,
            message: err.message || "Bad Request",
        });
    }

    next();
}

module.exports = scanErrorMiddleware;