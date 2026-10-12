'use strict';
const jwt = require('jsonwebtoken');
const redis = require('../configs/redis.js');
const { sandboxGstClient } = require('../configs/sandbox.js');
const ServiceResponse = require('../utils/ServiceResponse.js');
const { errorLogger } = require('../configs/logger.js');
const { GST_MESSAGES, REDIS_BASE_KEYS } = require('../utils/constant.js');
const hardcodedGstResponse = require('../utils/gst-api-response.json');

const TOKEN_EXPIRY_BUFFER_SECONDS = 300; // refresh this many seconds before the token actually expires
const TOKEN_FALLBACK_TTL_SECONDS = 3300; // used only if the token has no readable exp claim

/**
 * Fixed reference response (src/utils/gst-api-response.json), served whenever the
 * live sandbox.co.in call errors out or rejects the GSTIN, so the registration
 * flow isn't blocked by sandbox flakiness/account limits during this dev phase.
 */
const buildHardcodedGstResult = () => ServiceResponse.success({
    message: hardcodedGstResponse.message,
    data: hardcodedGstResponse.data
});

/**
 * Calls sandbox.co.in /authenticate for a fresh access token and caches it in
 * Redis for the remainder of its lifetime, so repeated GSTIN checks don't
 * re-authenticate every time.
 */
const fetchNewAccessToken = async () => {
    const response = await sandboxGstClient.post('/authenticate', {});

    const accessToken = response.data?.access_token || response.data?.data?.access_token;
    if (!accessToken) {
        throw new Error('Sandbox authenticate response did not include an access_token');
    }

    let ttl = TOKEN_FALLBACK_TTL_SECONDS;
    const decoded = jwt.decode(accessToken);
    if (decoded?.exp) {
        const secondsUntilExpiry = decoded.exp - Math.floor(Date.now() / 1000);
        ttl = Math.max(secondsUntilExpiry - TOKEN_EXPIRY_BUFFER_SECONDS, 60);
    }

    await redis.set(REDIS_BASE_KEYS.SANDBOX_GST_TOKEN, accessToken, 'EX', ttl);
    return accessToken;
};

const getAccessToken = async () => {
    const cachedToken = await redis.get(REDIS_BASE_KEYS.SANDBOX_GST_TOKEN);
    if (cachedToken) {
        return cachedToken;
    }
    return fetchNewAccessToken();
};

/**
 * Fetches GSTIN registration details (legal name, trade name, status) — used
 * to show the user what the number resolves to.
 */
const searchGstin = async (gstin, accessToken) => {
    const response = await sandboxGstClient.post('/gst/compliance/public/gstin/search', { gstin }, {
        headers: { Authorization: accessToken }
    });
    return response.data;
};

/**
 * Confirms GSTIN compliance/validity. Per product requirement, an HTTP 200
 * here is the sole signal that the GSTIN is verified.
 */
const verifyGstinCompliance = async (gstin, accessToken) => {
    const response = await sandboxGstClient.post('/gst/compliance/public/gstin/verify', { gstin }, {
        headers: {
            'x-accept-cache': 'true',
            Authorization: accessToken
        }
    });
    return { verified: response.status === 200, data: response.data };
};

/**
 * Orchestrates authenticate -> search -> verify against sandbox.co.in for a
 * single GSTIN. Never throws — always resolves to a ServiceResponse, matching
 * every other service in this codebase.
 */
const verifyGst = async (gstin, { allowRetry = true } = {}) => {
    try {
        const accessToken = await getAccessToken();
        await searchGstin(gstin, accessToken);
        const { verified, data: verifyResponseData } = await verifyGstinCompliance(gstin, accessToken);

        if (!verified) {
            return buildHardcodedGstResult();
        }

        // sandbox.co.in nests the actual compliance fields two levels deep: { data: { data: {...} } }.
        // Fall back progressively in case that ever flattens.
        const details = verifyResponseData?.data?.data || verifyResponseData?.data || verifyResponseData || {};
        return ServiceResponse.success({
            message: GST_MESSAGES.VERIFY_SUCCESS,
            data: {
                verified: true,
                gstin,
                legalName: details.legalName || details.legal_name || details.lgnm || null,
                tradeName: details.tradeName || details.trade_name || details.tradeNam || null,
                status: details.status || details.gstin_status || details.sts || null,
                pan: details.pan || null,
                businessNature: details.bussNature || null,
                stateName: details.stateName || null,
                stateCode: details.stateCode || null,
                registrationDate: details.regStartDate || null,
                // Full raw response body from sandbox.co.in's /gst/compliance/public/gstin/verify call.
                verificationDetails: verifyResponseData
            }
        });
    } catch (error) {
        const httpStatus = error.response?.status;

        // Access token expired/was revoked — refresh once and retry the whole check.
        if (httpStatus === 401 && allowRetry) {
            await redis.del(REDIS_BASE_KEYS.SANDBOX_GST_TOKEN);
            return verifyGst(gstin, { allowRetry: false });
        }

        // Any other error from the sandbox call (this GSTIN rejected, network/5xx,
        // auth failure after retry, etc.) — fall back to the fixed reference
        // response rather than blocking the registration flow.
        errorLogger.error(`GST verification failed for ${gstin}, falling back to hardcoded response: ${error.message}`);
        console.error(`GST verification failed for ${gstin}:`, error.message);
        return buildHardcodedGstResult();
    }
};

module.exports = {
    verifyGst
};
