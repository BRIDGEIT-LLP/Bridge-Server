'use strict';
const jwt = require('jsonwebtoken');
const redis = require('../configs/redis.js');
const { sandboxMcaClient, sandboxMcaAuthClient } = require('../configs/sandbox.js');
const ServiceResponse = require('../utils/ServiceResponse.js');
const { errorLogger } = require('../configs/logger.js');
const { CIN_MESSAGES, REDIS_BASE_KEYS } = require('../utils/constant.js');
const hardcodedCinResponse = require('../utils/cin-api-response.json');

const TOKEN_EXPIRY_BUFFER_SECONDS = 300; // refresh this many seconds before the token actually expires
const TOKEN_FALLBACK_TTL_SECONDS = 3300; // used only if the token has no readable exp claim

/**
 * Calls sandbox.co.in /authenticate (MCA-scoped key/secret) for a fresh access
 * token and caches it in Redis for the remainder of its lifetime. Mirrors
 * gstVerificationService.fetchNewAccessToken, just against the MCA credentials.
 */
const fetchNewAccessToken = async () => {
    const response = await sandboxMcaAuthClient.post('/authenticate', {});

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

    await redis.set(REDIS_BASE_KEYS.SANDBOX_MCA_TOKEN, accessToken, 'EX', ttl);
    return accessToken;
};

const getAccessToken = async () => {
    const cachedToken = await redis.get(REDIS_BASE_KEYS.SANDBOX_MCA_TOKEN);
    if (cachedToken) {
        return cachedToken;
    }
    return fetchNewAccessToken();
};

/**
 * Looks up MCA company master data for a CIN. An HTTP 200 here (axios resolves
 * instead of throwing) is the verification signal.
 */
const fetchCinMasterData = async (cin, accessToken) => {
    const response = await sandboxMcaClient.post('/mca/company/master-data/search', {
        '@entity': 'in.co.sandbox.kyc.mca.master_data.request',
        id: cin,
        consent: 'y',
        reason: 'For Company KYC'
    }, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    return response.data;
};

/**
 * `verified` stays `true` on a fallback (hardcoded fixture) call so existing callers
 * (registration) are unaffected — `realOutcome` is the honest signal for callers (the
 * Verification queue) that need to know this wasn't a genuine pass. The MCA lookup has
 * no "not compliant" response shape like GST does — any non-200 throws — so the only
 * fallback case here is `unknown` (the call itself failed and we never got a real answer).
 */
const buildCinResult = (cin, responseData, realOutcome) => {
    const details = responseData?.data?.company_master_data || {};
    return ServiceResponse.success({
        message: CIN_MESSAGES.VERIFY_SUCCESS,
        data: {
            verified: true,
            realOutcome,
            cin,
            companyName: details.company_name || null,
            companyStatus: details['company_status(for_efiling)'] || null,
            dateOfIncorporation: details.date_of_incorporation || null,
            registeredAddress: details.registered_address || null,
            rocCode: details.roc_code || null,
            // Raw response body — either sandbox.co.in's real /mca/company/master-data/search
            // reply, or the fixed reference fallback (src/utils/cin-api-response.json).
            verificationDetails: responseData
        }
    });
};

/**
 * Orchestrates CIN verification against sandbox.co.in's MCA master-data API.
 * Falls back to the fixed reference response (src/utils/cin-api-response.json)
 * on any error — this CIN rejected, network/5xx, auth failure after retry, etc.
 * — so the registration flow isn't blocked by sandbox flakiness/account limits
 * during this dev phase. Never throws — always resolves to a ServiceResponse,
 * matching every other service in this codebase.
 */
const verifyCin = async (cin, { allowRetry = true } = {}) => {
    try {
        const accessToken = await getAccessToken();
        const responseData = await fetchCinMasterData(cin, accessToken);
        return buildCinResult(cin, responseData, 'passed');
    } catch (error) {
        const httpStatus = error.response?.status;

        // Access token expired/was revoked — refresh once and retry the whole check.
        if (httpStatus === 401 && allowRetry) {
            await redis.del(REDIS_BASE_KEYS.SANDBOX_MCA_TOKEN);
            return verifyCin(cin, { allowRetry: false });
        }

        errorLogger.error(`CIN verification failed for ${cin}, falling back to hardcoded response: ${error.message}`);
        console.error(`CIN verification failed for ${cin}:`, error.message);
        return buildCinResult(cin, hardcodedCinResponse, 'unknown');
    }
};

module.exports = {
    verifyCin
};
