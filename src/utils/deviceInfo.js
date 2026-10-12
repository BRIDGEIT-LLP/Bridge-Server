'use strict';
const UAParser = require('ua-parser-js');

/**
 * Parses device/browser/OS info from request headers.
 *
 * Mirrors the same header fields that requestResponseLogger.js already reads:
 *   sec-ch-ua          → browser brand  (logger's "Browser" field)
 *   sec-ch-ua-platform → OS             (logger's "Platform" field)
 *   sec-ch-ua-mobile   → mobile flag    (logger's "Mobile" field)
 *
 * These are HTTP Client Hint headers sent automatically by Chromium-based
 * browsers (Chrome, Edge, Brave, Opera). When they are absent — Firefox,
 * Safari, older browsers, Postman, curl, mobile HTTP clients — falls back
 * to parsing the User-Agent string with ua-parser-js, which is what the
 * original implementation used exclusively.
 *
 * @param {object} headers - req.headers from Express
 */
function parseDeviceInfo(headers = {}) {
    let browser = null;
    let os = null;

    try {
        // ---------------------------------------------------------------
        // Primary: sec-ch-ua* Client Hint headers
        // Same source as requestResponseLogger.js — read as-is, no regex.
        // ---------------------------------------------------------------
        const secChUaPlatform = headers['sec-ch-ua-platform'];
        const secChUa         = headers['sec-ch-ua'];
        const secChUaMobile   = headers['sec-ch-ua-mobile'];

        // sec-ch-ua-platform arrives as a quoted string e.g. "Windows", "macOS"
        if (secChUaPlatform) {
            os = secChUaPlatform.replace(/"/g, '').trim() || null;
        }

        // sec-ch-ua format: `"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"`
        // Skip the generic "Chromium" and any "Not..." pseudo-brand entries
        // to surface the real product name (e.g. "Google Chrome", "Microsoft Edge").
        if (secChUa) {
            const brands = secChUa.split(',');
            for (const entry of brands) {
                const match = entry.match(/"([^"]+)";v="(\d+)"/);
                if (match) {
                    const name = match[1];
                    if (!name.startsWith('Not') && name !== 'Chromium') {
                        browser = name;
                        break;
                    }
                }
            }
            // If only "Chromium" / "Not..." brands present, use Chromium
            if (!browser) {
                const chromiumMatch = secChUa.match(/"Chromium";v="\d+"/);
                if (chromiumMatch) browser = 'Chromium';
            }
        }

        // ---------------------------------------------------------------
        // Fallback: ua-parser-js on User-Agent
        // Covers every case where Client Hint headers are absent.
        // ---------------------------------------------------------------
        if (!browser || !os) {
            const result = UAParser(headers['user-agent'] || '');
            if (!browser) browser = (result.browser && result.browser.name) || null;
            if (!os)      os      = (result.os      && result.os.name)      || null;
        }

        browser = browser || 'Unknown browser';
        os      = os      || 'Unknown OS';

        // Mirror the logger's mobile detection: sec-ch-ua-mobile === "?1"
        const isMobile  = secChUaMobile === '?1';
        const deviceName = isMobile
            ? `Mobile`
            : `Desktop`;

        return { deviceName, browser, os };

    } catch (err) {
        return {
            deviceName: 'Unknown device',
            browser:    'Unknown browser',
            os:         'Unknown OS',
        };
    }
}

module.exports = { parseDeviceInfo };