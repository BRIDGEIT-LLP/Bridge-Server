class HttpResponse {
    static success(res, {data = [], message = 'Successfully processed.', statusCode = 200} = {}) {

        return res.status(statusCode).json({
            success: true,
            data,
            message
        });
    }

    static error(res, {message = 'Error encountered.', statusCode = 500, data = [], errorCode = 'ERR_001'} = {}) {

        return res.status(statusCode).json({
            success: false,
            error_code: errorCode,
            data,
            message
        });
    }
}

module.exports = HttpResponse;