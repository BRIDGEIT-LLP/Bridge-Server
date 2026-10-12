'use strict';

// Mock the DB models/sequelize before requiring anything that touches them
jest.mock('../../models', () => ({
    sequelize: {
        query: jest.fn(),
        transaction: jest.fn(),
        authenticate: jest.fn().mockResolvedValue(true)
    },
    Sequelize: {}
}));

// Mock the matching repository so tests are DB-free
jest.mock('../../matching/matchingRepository', () => ({
    getProfileWithRole: jest.fn(),
    getCandidateProfiles: jest.fn()
}));

// Mock the connection service so tests are DB-free
jest.mock('../../services/connectionService', () => ({
    getConnectionBillingWindow: jest.fn().mockResolvedValue({
        success: true,
        data: { windowStart: new Date('2026-01-01'), windowEnd: new Date('2026-02-01') }
    }),
    getConnectionRequestsInWindow: jest.fn().mockResolvedValue({
        success: true,
        data: { count: 0 }
    }),
    getConnectionRequestLimit: jest.fn().mockImplementation(async (_userId, hasActiveSubscription) => (
        hasActiveSubscription ? 50 : 3
    ))
}));

// Mock the subscription service so tests are DB-free (defaults to no active premium subscription)
jest.mock('../../services/subscriptionService', () => ({
    findActivePrememiumSubscription: jest.fn().mockResolvedValue({
        success: true,
        data: null
    })
}));

// Mock the logger to suppress output during tests
jest.mock('../../configs/logger', () => ({
    errorLogger: { error: jest.fn(), info: jest.fn() },
    accessLogger: { info: jest.fn() }
}));

const matchingRepository = require('../../matching/matchingRepository');
const connectionService  = require('../../services/connectionService');
const subscriptionService = require('../../services/subscriptionService');
const matchingService    = require('../../matching/matchingService');
const { MATCHES_LIMIT }  = require('../../matching/matchingConfig');

// ─── Shared mock data ─────────────────────────────────────────────────────────

const STARTUP_USER_ID = '11111111-1111-4111-8111-111111111111';
const INVESTOR_USER_ID = '22222222-2222-4222-8222-222222222222';
const INVESTOR_SOURCE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ANOTHER_INVESTOR_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ANOTHER_STARTUP_ID = '55555555-5555-4555-8555-555555555555';
const MISSING_USER_ID = '99999999-9999-4999-8999-999999999999';

const mockStartupProfile = {
    id: STARTUP_USER_ID,
    role_code: 'STARTUP',
    company_id: 100,
    company_name: 'FinCo',
    organization_name: 'FinCo',
    startup_industry_sector: ['fintech', 'saas'],
    primary_sector: ['ai_ml'],
    startup_intent: 'seed_investment',
    funding_ask_amt_min: 500000,
    funding_ask_amt_max: 2000000,
    funding_stage: 'seed',
    country: 'India', continent: 'Asia',
    profile_photo: 'photo.jpg', short_bio: 'A startup',
    first_name: 'Alice', last_name: 'Smith',
    linkedin_profile_url: 'https://linkedin.com/in/alice',
    business_description: 'Fintech tools',
    is_active: true, is_deleted: false
};

const mockInvestorProfile = {
    id: INVESTOR_USER_ID,
    role_code: 'INVESTOR',
    company_id: 200,
    company_name: 'VC Fund',
    organization_name: 'VC Fund',
    investor_sector_preference: ['fintech', 'saas'],
    investor_intent: 'actively_deploying',
    ticket_size_amt_min: 1000000,
    ticket_size_amt_max: 5000000,
    prefrerred_investment_stage: ['seed'],
    investor_type: 'vc',
    country: 'India', continent: 'Asia',
    profile_photo: 'photo.jpg', short_bio: 'VC firm',
    first_name: 'Bob', last_name: 'Jones',
    linkedin_profile_url: 'https://linkedin.com/in/bob',
    is_active: true, is_deleted: false
};

// ─── getMatches() Service Tests ───────────────────────────────────────────────

describe('MatchingService — getMatches()', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // --- Successful response ---
    test('returns success with matches array for valid profileId', async () => {
        matchingRepository.getProfileWithRole.mockResolvedValue(mockStartupProfile);
        matchingRepository.getCandidateProfiles.mockResolvedValue([mockInvestorProfile]);

        const result = await matchingService.getMatches(STARTUP_USER_ID, 'STARTUP');

        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty('profileId', STARTUP_USER_ID);
        expect(result.data).toHaveProperty('matches');
        expect(Array.isArray(result.data.matches)).toBe(true);
    });

    test('returned matches contain required fields', async () => {
        matchingRepository.getProfileWithRole.mockResolvedValue(mockStartupProfile);
        matchingRepository.getCandidateProfiles.mockResolvedValue([mockInvestorProfile]);

        const result = await matchingService.getMatches(STARTUP_USER_ID, 'STARTUP');
        const match  = result.data.matches[0];

        expect(match).toHaveProperty('profileId');
        expect(match).toHaveProperty('companyName');
        expect(match).toHaveProperty('role');
        expect(match).toHaveProperty('compatibility');
        expect(match).toHaveProperty('breakdown');
        expect(match).toHaveProperty('topFactors');
        expect(match).toHaveProperty('rationale');
        expect(match).toHaveProperty('short_bio');
        expect(match).toHaveProperty('linkedin_profile_url');
        expect(match).toHaveProperty('linkedin_url');
    });

    test('compatibility score is a number between 0 and 100', async () => {
        matchingRepository.getProfileWithRole.mockResolvedValue(mockStartupProfile);
        matchingRepository.getCandidateProfiles.mockResolvedValue([mockInvestorProfile]);

        const result = await matchingService.getMatches(STARTUP_USER_ID, 'STARTUP');
        const { compatibility } = result.data.matches[0];

        expect(typeof compatibility).toBe('number');
        expect(compatibility).toBeGreaterThanOrEqual(0);
        expect(compatibility).toBeLessThanOrEqual(100);
    });

    test('breakdown contains all 7 factor keys', async () => {
        matchingRepository.getProfileWithRole.mockResolvedValue(mockStartupProfile);
        matchingRepository.getCandidateProfiles.mockResolvedValue([mockInvestorProfile]);

        const result  = await matchingService.getMatches(STARTUP_USER_ID, 'STARTUP');
        const { breakdown } = result.data.matches[0];

        ['sector', 'intent', 'geo', 'revenue', 'moq', 'completeness', 'exportReady'].forEach(key => {
            expect(breakdown).toHaveProperty(key);
        });
    });

    test('topFactors is an array of strings', async () => {
        matchingRepository.getProfileWithRole.mockResolvedValue(mockStartupProfile);
        matchingRepository.getCandidateProfiles.mockResolvedValue([mockInvestorProfile]);

        const result      = await matchingService.getMatches(STARTUP_USER_ID, 'STARTUP');
        const { topFactors } = result.data.matches[0];

        expect(Array.isArray(topFactors)).toBe(true);
        topFactors.forEach(f => expect(typeof f).toBe('string'));
    });

    test('rationale is a non-empty string', async () => {
        matchingRepository.getProfileWithRole.mockResolvedValue(mockStartupProfile);
        matchingRepository.getCandidateProfiles.mockResolvedValue([mockInvestorProfile]);

        const result    = await matchingService.getMatches(STARTUP_USER_ID, 'STARTUP');
        const { rationale } = result.data.matches[0];

        expect(typeof rationale).toBe('string');
        expect(rationale.length).toBeGreaterThan(0);
    });

    test('matches are sorted by compatibility descending', async () => {
        const secondInvestor = {
            ...mockInvestorProfile,
            id: 3,
            investor_sector_preference: ['gaming'],
            investor_intent: 'open_to_co_investment',
            country: 'USA', continent: 'North America',
            ticket_size_amt_min: 20000000,
            ticket_size_amt_max: 50000000
        };
        matchingRepository.getProfileWithRole.mockResolvedValue(mockStartupProfile);
        matchingRepository.getCandidateProfiles.mockResolvedValue([secondInvestor, mockInvestorProfile]);

        const result  = await matchingService.getMatches(STARTUP_USER_ID, 'STARTUP');
        const matches = result.data.matches;

        expect(matches.length).toBe(2);
        expect(matches[0].compatibility).toBeGreaterThanOrEqual(matches[1].compatibility);
    });

    // --- Empty matches ---
    test('returns success with empty matches when no candidates exist', async () => {
        matchingRepository.getProfileWithRole.mockResolvedValue(mockStartupProfile);
        matchingRepository.getCandidateProfiles.mockResolvedValue([]);

        const result = await matchingService.getMatches(STARTUP_USER_ID, 'STARTUP');

        expect(result.success).toBe(true);
        expect(result.data.matches).toHaveLength(0);
    });

    test('returns success with empty matches when no eligible candidates exist', async () => {
        // INVESTOR source — only STARTUP is eligible. If all candidates are INVESTOR, result is empty.
        const investorSource = { ...mockInvestorProfile, id: INVESTOR_SOURCE_ID };
        const anotherInvestor = { ...mockInvestorProfile, id: ANOTHER_INVESTOR_ID };

        matchingRepository.getProfileWithRole.mockResolvedValue(investorSource);
        matchingRepository.getCandidateProfiles.mockResolvedValue([anotherInvestor]);

        const result = await matchingService.getMatches(INVESTOR_SOURCE_ID, 'INVESTOR');

        expect(result.success).toBe(true);
        expect(result.data.matches).toHaveLength(0);
    });

    // --- Invalid profile ID ---
    test('returns 404 error for non-existent profileId', async () => {
        matchingRepository.getProfileWithRole.mockResolvedValue(null);
        matchingRepository.getCandidateProfiles.mockResolvedValue([]);

        const result = await matchingService.getMatches(MISSING_USER_ID);

        expect(result.success).toBe(false);
        expect(result.statusCode).toBe(404);
    });

    test('returns 404 error for non-numeric profileId', async () => {
        const result = await matchingService.getMatches('not-a-number');
        expect(result.success).toBe(false);
        expect(result.statusCode).toBe(404);
    });

    test('returns 404 error for null profileId', async () => {
        const result = await matchingService.getMatches(null);
        expect(result.success).toBe(false);
        expect(result.statusCode).toBe(404);
    });

    test('returns 500 error when repository throws', async () => {
        matchingRepository.getProfileWithRole.mockRejectedValue(new Error('DB connection failed'));

        const result = await matchingService.getMatches(STARTUP_USER_ID, 'STARTUP');

        expect(result.success).toBe(false);
        expect(result.statusCode).toBe(500);
    });

    // --- Response shape ---
    test('success response has correct statusCode 200', async () => {
        matchingRepository.getProfileWithRole.mockResolvedValue(mockStartupProfile);
        matchingRepository.getCandidateProfiles.mockResolvedValue([mockInvestorProfile]);

        const result = await matchingService.getMatches(STARTUP_USER_ID, 'STARTUP');
        expect(result.statusCode).toBe(200);
    });

    test('profileId in response matches the requested profileId', async () => {
        matchingRepository.getProfileWithRole.mockResolvedValue(mockStartupProfile);
        matchingRepository.getCandidateProfiles.mockResolvedValue([mockInvestorProfile]);

        const result = await matchingService.getMatches(STARTUP_USER_ID, 'STARTUP');
        expect(result.data.profileId).toBe(STARTUP_USER_ID);
    });

    test('ineligible candidates are excluded from matches', async () => {
        // STARTUP source — INVESTOR (id:2) is eligible, but another STARTUP (id:5) is not
        const anotherStartup = { ...mockStartupProfile, id: ANOTHER_STARTUP_ID, role_code: 'STARTUP' };

        matchingRepository.getProfileWithRole.mockResolvedValue(mockStartupProfile);
        matchingRepository.getCandidateProfiles.mockResolvedValue([mockInvestorProfile, anotherStartup]);

        const result  = await matchingService.getMatches(STARTUP_USER_ID, 'STARTUP');
        const ids     = result.data.matches.map(m => m.profileId);

        expect(ids).toContain(mockInvestorProfile.id);
        expect(ids).not.toContain(anotherStartup.id);
    });

    test('limits returned matches to MATCHES_LIMIT configuration value', async () => {
        const candidates = Array.from({ length: MATCHES_LIMIT + 3 }, (_, i) => ({
            ...mockInvestorProfile,
            id: `${String(i + 2).padStart(8, '0')}-2222-4222-8222-222222222222`,
            company_name: `Investor ${i + 2}`
        }));

        matchingRepository.getProfileWithRole.mockResolvedValue(mockStartupProfile);
        matchingRepository.getCandidateProfiles.mockResolvedValue(candidates);

        const result = await matchingService.getMatches(STARTUP_USER_ID, 'STARTUP');
        expect(result.success).toBe(true);
        expect(result.data.matches).toHaveLength(MATCHES_LIMIT);
    });

    // --- Connection request count in current billing window ---
    test('includes requestsSentInWindow from connectionService in success response', async () => {
        matchingRepository.getProfileWithRole.mockResolvedValue(mockStartupProfile);
        matchingRepository.getCandidateProfiles.mockResolvedValue([mockInvestorProfile]);
        connectionService.getConnectionRequestsInWindow.mockResolvedValueOnce({ success: true, data: { count: 3 } });

        const result = await matchingService.getMatches(STARTUP_USER_ID, 'STARTUP');

        expect(result.data.requestsSentInWindow).toBe(3);
    });

    test('includes requestsSentInWindow when there are no eligible candidates', async () => {
        const investorSource = { ...mockInvestorProfile, id: INVESTOR_SOURCE_ID };
        const anotherInvestor = { ...mockInvestorProfile, id: ANOTHER_INVESTOR_ID };

        matchingRepository.getProfileWithRole.mockResolvedValue(investorSource);
        matchingRepository.getCandidateProfiles.mockResolvedValue([anotherInvestor]);
        connectionService.getConnectionRequestsInWindow.mockResolvedValueOnce({ success: true, data: { count: 1 } });

        const result = await matchingService.getMatches(INVESTOR_SOURCE_ID, 'INVESTOR');

        expect(result.data.matches).toHaveLength(0);
        expect(result.data.requestsSentInWindow).toBe(1);
    });

    test('returns error when fetching the billing window fails', async () => {
        matchingRepository.getProfileWithRole.mockResolvedValue(mockStartupProfile);
        matchingRepository.getCandidateProfiles.mockResolvedValue([mockInvestorProfile]);
        connectionService.getConnectionBillingWindow.mockResolvedValueOnce({ success: false, message: 'window failed', statusCode: 500 });

        const result = await matchingService.getMatches(STARTUP_USER_ID, 'STARTUP');

        expect(result.success).toBe(false);
        expect(result.statusCode).toBe(500);
    });

    test('returns error when fetching the request count fails', async () => {
        matchingRepository.getProfileWithRole.mockResolvedValue(mockStartupProfile);
        matchingRepository.getCandidateProfiles.mockResolvedValue([mockInvestorProfile]);
        connectionService.getConnectionRequestsInWindow.mockResolvedValueOnce({ success: false, message: 'count failed', statusCode: 500 });

        const result = await matchingService.getMatches(STARTUP_USER_ID, 'STARTUP');

        expect(result.success).toBe(false);
        expect(result.statusCode).toBe(500);
    });

    // --- Connection request limit and remaining count ---
    test('uses the FREE limit and computes remaining when there is no active subscription', async () => {
        matchingRepository.getProfileWithRole.mockResolvedValue(mockStartupProfile);
        matchingRepository.getCandidateProfiles.mockResolvedValue([mockInvestorProfile]);
        subscriptionService.findActivePrememiumSubscription.mockResolvedValueOnce({ success: true, data: null });
        connectionService.getConnectionRequestsInWindow.mockResolvedValueOnce({ success: true, data: { count: 1 } });

        const result = await matchingService.getMatches(STARTUP_USER_ID, 'STARTUP');

        expect(connectionService.getConnectionBillingWindow).toHaveBeenCalledWith(STARTUP_USER_ID, null);
        expect(result.data.requestLimit).toBe(3);
        expect(result.data.requestsRemaining).toBe(2);
    });

    test('uses the PREMIUM limit when the user has an active subscription', async () => {
        matchingRepository.getProfileWithRole.mockResolvedValue(mockStartupProfile);
        matchingRepository.getCandidateProfiles.mockResolvedValue([mockInvestorProfile]);
        subscriptionService.findActivePrememiumSubscription.mockResolvedValueOnce({
            success: true,
            data: { id: 1, start_date: '11 Sep 2026' }
        });
        connectionService.getConnectionRequestsInWindow.mockResolvedValueOnce({ success: true, data: { count: 10 } });

        const result = await matchingService.getMatches(STARTUP_USER_ID, 'STARTUP');

        expect(connectionService.getConnectionBillingWindow).toHaveBeenCalledWith(STARTUP_USER_ID, '11 Sep 2026');
        expect(result.data.requestLimit).toBe(50);
        expect(result.data.requestsRemaining).toBe(40);
    });

    test('requestsRemaining does not go below zero when the limit is exceeded', async () => {
        matchingRepository.getProfileWithRole.mockResolvedValue(mockStartupProfile);
        matchingRepository.getCandidateProfiles.mockResolvedValue([mockInvestorProfile]);
        subscriptionService.findActivePrememiumSubscription.mockResolvedValueOnce({ success: true, data: null });
        connectionService.getConnectionRequestsInWindow.mockResolvedValueOnce({ success: true, data: { count: 5 } });

        const result = await matchingService.getMatches(STARTUP_USER_ID, 'STARTUP');

        expect(result.data.requestLimit).toBe(3);
        expect(result.data.requestsRemaining).toBe(0);
    });

    test('returns error when fetching the subscription status fails', async () => {
        matchingRepository.getProfileWithRole.mockResolvedValue(mockStartupProfile);
        matchingRepository.getCandidateProfiles.mockResolvedValue([mockInvestorProfile]);
        subscriptionService.findActivePrememiumSubscription.mockResolvedValueOnce({ success: false, message: 'subscription lookup failed', statusCode: 500 });

        const result = await matchingService.getMatches(STARTUP_USER_ID, 'STARTUP');

        expect(result.success).toBe(false);
        expect(result.statusCode).toBe(500);
    });
});
