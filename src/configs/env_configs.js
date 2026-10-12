const env = {
    SERVER_PORT: process.env.SERVER_PORT,
    SKIP_VIRUS_SCAN: process.env.SKIP_VIRUS_SCAN === 'true',
    // The frontend origin(s) allowed to send/receive the httpOnly auth cookies (CORS
    // credentials require an explicit origin per request, never '*' — this list lets
    // multiple known dev/staging/prod origins each be individually allowed).
    FRONTEND_ORIGINS: (process.env.FRONTEND_ORIGINS || 'http://localhost:3000')
        .split(',').map((s) => s.trim()).filter(Boolean),
    // true when the frontend and backend are on genuinely different domains (e.g. a
    // devtunnel/forwarded-port URL) rather than just different localhost ports — a real
    // cross-SITE setup, which needs SameSite=None + Secure instead of the local default
    // Lax/non-Secure (SameSite=Lax cookies are never sent on cross-site fetch/XHR/socket
    // requests, only top-level navigations, so the cookie would silently never arrive).
    COOKIE_CROSS_SITE: process.env.COOKIE_CROSS_SITE === 'true',
    // Whether the connection this server is actually reached over is HTTPS. Deliberately
    // NOT derived from NODE_ENV — a production deployment can still be served over plain
    // HTTP (e.g. no TLS termination in front of it yet), and a Secure cookie is dropped
    // by the browser on any non-HTTPS connection, silently breaking auth. Only flip this
    // on once the deployment is confirmed to be served over HTTPS.
    COOKIE_SECURE: process.env.COOKIE_SECURE === 'true',
    DB: {
        DB_HOST: process.env.DB_HOST,
        DB_PORT: process.env.DB_PORT,
        DB_NAME: process.env.DB_NAME,
        DB_USER: process.env.DB_USER,
        DB_PASSWORD: process.env.DB_PASSWORD,
        DB_DILECT: process.env.DB_DILECT,
        DB_DILECT_MODE: process.env.DB_DILECT_MODE
    },
    JWT: {
        ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'jwt_access_secret_key_12345',
        REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'jwt_refresh_secret_key_12345',
        ACCESS_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY || '55m',
        REFRESH_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY || '7d',
        RESET_PASSWORD_SECRET: process.env.RESET_PASSWORD_SECRET || 'reset_password_secret_key_12345',
        RESET_PASSWORD_EXPIRY: process.env.RESET_PASSWORD_EXPIRY || '10m',
        MFA_SECRET: process.env.MFA_SECRET || 'mfa_secret_key_12345',
        MFA_EXPIRY: process.env.MFA_EXPIRY || '15m'
    },
    OTP: {
        EXPIRY_MINUTES: parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10),
        RESEND_COOLDOWN_SECONDS: parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '60', 10),
        MAX_RESEND_PER_HOUR: parseInt(process.env.OTP_MAX_RESEND_PER_HOUR || '10', 10),
        MAX_VERIFY_ATTEMPTS: parseInt(process.env.OTP_MAX_VERIFY_ATTEMPTS || '5', 10),
        BLOCK_DURATION_MINUTES: parseInt(process.env.OTP_BLOCK_DURATION_MINUTES || '15', 10)
    }
};

module.exports = env;