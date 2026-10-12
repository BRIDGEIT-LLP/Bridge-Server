const HttpResponse = require("../utils/HttpResponse");
const { errorLogger } = require("../configs/logger");
const { ADMIN_CONFIG_MESSAGES } = require('../utils/constant');
const adminConfigService = require('../services/adminConfigService');


const getOtpConfig = async (req, res, next) => {
    try {
        const getOtpConfigResp = await adminConfigService.getOtpConfig();
        if (!getOtpConfigResp.success) {
            return HttpResponse.error(res, {
                message: getOtpConfigResp.message,
                statusCode: getOtpConfigResp.statusCode
            });
        }
        const otpConfig = getOtpConfigResp.data;

        return HttpResponse.success(res, {
            message: ADMIN_CONFIG_MESSAGES.CONFIG_FETCH_SUCCESS,
            data: otpConfig,
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: ADMIN_CONFIG_MESSAGES.CONFIG_FETCH_FAILED,
            statusCode: 500
        });
    }
};

const updateOtpConfig = async (req, res, next) => {
    try {
        const { otpConfig } = req.body;
        const updateOtpConfigResp = await adminConfigService.updateOtpConfig(otpConfig, req.adminId);
        if (!updateOtpConfigResp.success) {
            return HttpResponse.error(res, {
                message: updateOtpConfigResp.message,
                statusCode: updateOtpConfigResp.statusCode
            });
        }

        return HttpResponse.success(res, {
            message: ADMIN_CONFIG_MESSAGES.CONFIG_UPDATE_SUCCESS,
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: ADMIN_CONFIG_MESSAGES.CONFIG_UPDATE_FAILED,
            statusCode: 500
        });
    }
};

const getTrialConfig = async (req, res) => {
    try {
        const getTrialConfigResp = await adminConfigService.getTrialConfig();
        if (!getTrialConfigResp.success) {
            return HttpResponse.error(res, {
                message: getTrialConfigResp.message,
                statusCode: getTrialConfigResp.statusCode
            });
        }
        const trialConfig = getTrialConfigResp.data;

        return HttpResponse.success(res, {
            message: ADMIN_CONFIG_MESSAGES.CONFIG_FETCH_SUCCESS,
            data: trialConfig,
        }); 
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: ADMIN_CONFIG_MESSAGES.CONFIG_FETCH_FAILED,
            statusCode: 500
        });
    }

}
        
const resetOtpConfig = async (req, res, next) => {
    try {
        const resetOtpConfigResp = await adminConfigService.resetOtpConfig(req.adminId);
        if (!resetOtpConfigResp.success) {
            return HttpResponse.error(res, {
                message: resetOtpConfigResp.message,
                statusCode: resetOtpConfigResp.statusCode
            });
        }

        return HttpResponse.success(res, {
            message: ADMIN_CONFIG_MESSAGES.CONFIG_RESET_SUCCESS,
            statusCode: 200
        }); 
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: ADMIN_CONFIG_MESSAGES.CONFIG_RESET_FAILED,
            statusCode: 500
        });
    }
};

const updateTrialConfig = async (req, res) => {
    try {
        const { trialConfig } = req.body;
        const updateTrialConfigResp = await adminConfigService.updateTrialConfig(trialConfig, req.adminId);
        if (!updateTrialConfigResp.success) {
            return HttpResponse.error(res, {
                message: updateTrialConfigResp.message,
                statusCode: updateTrialConfigResp.statusCode
            });
        }

        return HttpResponse.success(res, {
            message: ADMIN_CONFIG_MESSAGES.CONFIG_UPDATE_SUCCESS,
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: ADMIN_CONFIG_MESSAGES.CONFIG_UPDATE_FAILED,
            statusCode: 500
        });
    }
};

module.exports = { getOtpConfig, updateOtpConfig, getTrialConfig, updateTrialConfig, resetOtpConfig }
