class ServiceResponse {
    static success = ({data=[], message='Successfully processed.', statusCode=200}={}) => {
        return {
            success: true,
            data,
            message,
            statusCode

        };
    };

    static error = ({message='Error encountered.', data=[], statusCode=500}={}) => {
        return {
            success: false,
            data,
            message,
            statusCode
        };
    };
}

module.exports = ServiceResponse;