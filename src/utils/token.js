'use strict';
const jwt = require('jsonwebtoken');
const ms = require('ms');
const env = require('../configs/env_configs');
const { TOKEN_TYPES } = require('../utils/constant');

// Cookie names for each token — one shared shape so every controller sets/clears them
// identically instead of repeating the options object.
const COOKIE_NAMES = {
    ACCESS_TOKEN: 'access_token',
    REFRESH_TOKEN: 'refresh_token',
    MFA_TOKEN: 'mfa_token',
    RESET_TOKEN: 'reset_token'
};

/**
 * SameSite/Secure flip based on COOKIE_CROSS_SITE / COOKIE_SECURE (env_configs.js):
 *   - Same-site (default: plain localhost, or any two ports on the same domain):
 *     SameSite=Lax, Secure only when COOKIE_SECURE=true. Works over plain HTTP.
 *   - Cross-site (COOKIE_CROSS_SITE=true: a devtunnel/forwarded-port URL, a genuinely
 *     different domain from the frontend): SameSite=None + Secure=true — required
 *     together, or the browser drops the cookie. Needs the connection to actually be
 *     HTTPS (true for devtunnels; NOT true for plain http://localhost, so don't set
 *     this flag unless you're actually tunneling).
 * Secure is intentionally NOT derived from NODE_ENV — a production deployment can still
 * be served over plain HTTP, and the browser silently drops a Secure cookie on any
 * non-HTTPS connection. Only set COOKIE_SECURE once the deployment is actually HTTPS.
 */
const crossSiteCookieFlags = () =>
    env.COOKIE_CROSS_SITE
        ? { sameSite: 'none', secure: true }
        : { sameSite: 'lax', secure: env.COOKIE_SECURE };

const cookieOptions = (maxAgeExpiry) => ({
    httpOnly: true,
    ...crossSiteCookieFlags(),
    path: '/',
    maxAge: ms(maxAgeExpiry)
});

// res.clearCookie must be called with the same httpOnly/secure/sameSite/path flags the
// cookie was set with (maxAge is irrelevant for clearing).
const clearCookieOptions = () => ({
    httpOnly: true,
    ...crossSiteCookieFlags(),
    path: '/'
});


const generateAccessToken = (payload, type=TOKEN_TYPES.AUTH_ACCESS_TOKEN) => {
    let ACCESS_SECRET = null;
    let ACCESS_EXPIRY = null;

    if (type === TOKEN_TYPES.RESET_PASSWORD_ACCESS_TOKEN) {
        payload.type = TOKEN_TYPES.RESET_PASSWORD_ACCESS_TOKEN;
        ACCESS_SECRET = env.JWT.RESET_PASSWORD_SECRET;
        ACCESS_EXPIRY = env.JWT.RESET_PASSWORD_EXPIRY;
    }
    else if (type === TOKEN_TYPES.MFA_ACCESS_TOKEN) {
        payload.type = TOKEN_TYPES.MFA_ACCESS_TOKEN;
        ACCESS_SECRET = env.JWT.MFA_SECRET;
        ACCESS_EXPIRY = env.JWT.MFA_EXPIRY;
    }
    else {
        payload.type = TOKEN_TYPES.AUTH_ACCESS_TOKEN;
        ACCESS_SECRET = env.JWT.ACCESS_SECRET;
        ACCESS_EXPIRY = env.JWT.ACCESS_EXPIRY;
    }
     
    return jwt.sign(payload, ACCESS_SECRET, {
        expiresIn: ACCESS_EXPIRY
    });
};

const generateRefreshToken = (payload, type=TOKEN_TYPES.AUTH_REFRESH_ACCESS_TOKEN) => {
    let REFRESH_SECRET = env.JWT.REFRESH_SECRET;
    let REFRESH_EXPIRY = env.JWT.REFRESH_EXPIRY;

    payload.type = TOKEN_TYPES.AUTH_REFRESH_ACCESS_TOKEN;
    
    return jwt.sign(payload, REFRESH_SECRET, {
        expiresIn: REFRESH_EXPIRY
    });
};

const verifyAccessToken = (token, type=TOKEN_TYPES.AUTH_ACCESS_TOKEN) => {
    let secret = null;
    if (type === TOKEN_TYPES.RESET_PASSWORD_ACCESS_TOKEN) {
        secret = env.JWT.RESET_PASSWORD_SECRET;
    }
    else if (type === TOKEN_TYPES.MFA_ACCESS_TOKEN) {
        secret = env.JWT.MFA_SECRET;
    }
    else if (type === TOKEN_TYPES.AUTH_REFRESH_ACCESS_TOKEN) {
        secret = env.JWT.REFRESH_SECRET;
    }
    else {
        secret = env.JWT.ACCESS_SECRET;
    }
    return jwt.verify(token, secret);
};

const verifyRefreshToken = (token) => {
    return jwt.verify(token, env.JWT.REFRESH_SECRET);
};

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    COOKIE_NAMES,
    cookieOptions,
    clearCookieOptions
};
