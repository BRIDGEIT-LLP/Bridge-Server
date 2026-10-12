'use strict';

const matchingService      = require('./matchingService');
const HttpResponse         = require('../utils/HttpResponse');
const { MATCHING_MESSAGES } = require('../utils/constant');
const { errorLogger }      = require('../configs/logger');

/**
 * GET /api/v1/matching/:profileId
 *
 * Returns a ranked list of compatible profiles for the given profileId.
 */
const getMatches = async (req, res) => {
    try {
        const userId = req.userId;
        const userRole = req.role;

        const result = await matchingService.getMatches(userId, userRole);

        if (!result.success) {
            return HttpResponse.error(res, {
                message: result.message,
                statusCode: result.statusCode
            });
        }

        return HttpResponse.success(res, {
            message: result.message,
            data: result.data,
            statusCode: result.statusCode
        });

    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: MATCHING_MESSAGES.MATCH_FAILED,
            statusCode: 500
        });
    }
};

module.exports = { getMatches };
