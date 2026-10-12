const axios = require('axios');

// GST compliance lookup — LIVE key pair, api.sandbox.co.in host.
const sandboxGstClient = axios.create({
    baseURL: process.env.SANDBOX_API_BASE_URL,
    headers: {
        'x-api-key': process.env.SANDBOX_API_KEY,
        'x-api-secret': process.env.SANDBOX_API_SECRET,
        'x-api-version': process.env.SANDBOX_API_VERSION,
        'Content-Type': 'application/json'
    }
});

// MCA/CIN lookup lives on a separate sandbox.co.in host + key pair from GST above
// — this account's MCA access is enabled only under the TEST key, resolved
// against the test-api host, while GST compliance is LIVE.
const sandboxMcaClient = axios.create({
    baseURL: process.env.SANDBOX_MCA_API_BASE_URL,
    headers: {
        'x-api-key': process.env.SANDBOX_MCA_API_KEY,
        'x-api-version': process.env.SANDBOX_MCA_API_VERSION,
        'Content-Type': 'application/json'
    }
});

// /authenticate itself is served off the shared sandbox.co.in host (same one GST
// authenticates against) — only the MCA resource call above moves to test-api.
const sandboxMcaAuthClient = axios.create({
    baseURL: process.env.SANDBOX_API_BASE_URL,
    headers: {
        'x-api-key': process.env.SANDBOX_MCA_API_KEY,
        'x-api-secret': process.env.SANDBOX_MCA_API_SECRET,
        'x-api-version': process.env.SANDBOX_MCA_API_VERSION,
        'Content-Type': 'application/json'
    }
});

module.exports = { sandboxGstClient, sandboxMcaClient, sandboxMcaAuthClient };
