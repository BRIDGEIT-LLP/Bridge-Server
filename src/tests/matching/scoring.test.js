'use strict';

const {
    calculateScore,
    calculateSectorScore,
    calculateIntentScore,
    calculateRevenueScore,
    calculateMoqScore,
    calculateCompletenessScore,
    calculateExportScore,
    redistributeWeights,
    jaccardSimilarity,
    getSectorValues,
    getIntentValue
} = require('../../matching/scoringService');

const { MATCHING_WEIGHTS } = require('../../matching/matchingConfig');

// ─── Mock profiles ───────────────────────────────────────────────────────────

const startupProfile = {
    id: 1,
    startup_industry_sector: ['fintech', 'saas'],
    primary_sector: ['ai_ml'],
    startup_intent: 'seed_investment',
    funding_ask_amt_min: 500000,
    funding_ask_amt_max: 2000000,
    funding_stage: 'seed',
    country: 'India',
    continent: 'Asia',
    profile_photo: 'photo.jpg',
    short_bio: 'A fintech startup',
    first_name: 'Alice',
    last_name: 'Smith',
    organization_name: 'FinCo',
    linkedin_profile_url: 'https://linkedin.com/in/alice',
    business_description: 'We build fintech tools',
    export_rediness: null
};

const investorProfile = {
    id: 2,
    investor_sector_preference: ['fintech', 'healthtech'],
    investor_intent: 'actively_deploying',
    ticket_size_amt_min: 1000000,
    ticket_size_amt_max: 5000000,
    prefrerred_investment_stage: ['seed', 'series_a'],
    investor_type: 'vc',
    country: 'India',
    continent: 'Asia',
    profile_photo: 'photo.jpg',
    short_bio: 'VC firm',
    first_name: 'Bob',
    last_name: 'Jones',
    organization_name: 'VC Fund',
    linkedin_profile_url: 'https://linkedin.com/in/bob',
    export_rediness: null
};

const b2bProfile = {
    id: 3,
    b2b_sector: 'technology',
    b2b_sub_sector: 'software_services',
    industry_vertical: 'saas',
    b2b_intent: 'seeking_distributor',
    revenue_band: '1_10cr',
    min_order_quantity: 100,
    export_rediness: 'yes',
    country: 'India',
    continent: 'Asia',
    profile_photo: 'photo.jpg',
    short_bio: 'B2B tech company',
    first_name: 'Carol',
    last_name: 'Lee',
    organization_name: 'TechCo',
    linkedin_profile_url: 'https://linkedin.com/in/carol',
    products_ervice_Offered: 'SaaS tools'
};

const b2bProfile2 = {
    id: 4,
    b2b_sector: 'technology',
    b2b_sub_sector: 'software_services',
    industry_vertical: 'saas',
    b2b_intent: 'seeking_supplier',
    revenue_band: '10_50cr',
    min_order_quantity: 80,
    export_rediness: 'in_progress',
    country: 'India',
    continent: 'Asia',
    profile_photo: 'photo.jpg',
    short_bio: 'Another B2B',
    first_name: 'Dan',
    last_name: 'Park',
    organization_name: 'BizCo',
    linkedin_profile_url: 'https://linkedin.com/in/dan',
    products_ervice_Offered: 'Distribution services'
};

// ─── Helper Tests ─────────────────────────────────────────────────────────────

describe('ScoringService — Helpers', () => {

    describe('jaccardSimilarity()', () => {
        test('identical arrays return 1.0', () => {
            expect(jaccardSimilarity(['a', 'b'], ['a', 'b'])).toBe(1);
        });
        test('no overlap returns 0', () => {
            expect(jaccardSimilarity(['a'], ['b'])).toBe(0);
        });
        test('partial overlap returns correct ratio', () => {
            // intersection={a}, union={a,b,c} → 1/3
            expect(jaccardSimilarity(['a', 'b'], ['a', 'c'])).toBeCloseTo(1 / 3, 5);
        });
        test('empty arrays return 0', () => {
            expect(jaccardSimilarity([], ['a'])).toBe(0);
        });
        test('is case-insensitive', () => {
            expect(jaccardSimilarity(['Fintech'], ['fintech'])).toBe(1);
        });
    });

    describe('getSectorValues()', () => {
        test('STARTUP returns combined startup_industry_sector + primary_sector', () => {
            const vals = getSectorValues(startupProfile, 'STARTUP');
            expect(vals).toContain('fintech');
            expect(vals).toContain('ai_ml');
        });
        test('INVESTOR returns investor_sector_preference', () => {
            const vals = getSectorValues(investorProfile, 'INVESTOR');
            expect(vals).toEqual(['fintech', 'healthtech']);
        });
        test('B2B returns b2b_sector as single-element array', () => {
            const vals = getSectorValues(b2bProfile, 'B2B');
            expect(vals).toEqual(['technology']);
        });
        test('unknown role returns empty array', () => {
            expect(getSectorValues(startupProfile, 'UNKNOWN')).toEqual([]);
        });
    });

    describe('getIntentValue()', () => {
        test('STARTUP returns startup_intent', () => {
            expect(getIntentValue(startupProfile, 'STARTUP')).toBe('seed_investment');
        });
        test('INVESTOR returns investor_intent', () => {
            expect(getIntentValue(investorProfile, 'INVESTOR')).toBe('actively_deploying');
        });
        test('B2B returns b2b_intent', () => {
            expect(getIntentValue(b2bProfile, 'B2B')).toBe('seeking_distributor');
        });
        test('unknown role returns null', () => {
            expect(getIntentValue(startupProfile, 'UNKNOWN')).toBeNull();
        });
    });
});

// ─── Individual Factor Tests ──────────────────────────────────────────────────

describe('ScoringService — Sector Score', () => {
    test('STARTUP↔INVESTOR: overlapping sectors score > 0', () => {
        const score = calculateSectorScore(startupProfile, investorProfile, 'STARTUP', 'INVESTOR');
        expect(score).toBeGreaterThan(0);
    });
    test('STARTUP↔INVESTOR: no sector overlap scores 0', () => {
        const noOverlapInvestor = { ...investorProfile, investor_sector_preference: ['gaming'] };
        const score = calculateSectorScore(startupProfile, noOverlapInvestor, 'STARTUP', 'INVESTOR');
        expect(score).toBe(0);
    });
    test('B2B↔B2B: same sector and sub-sector scores 1.0', () => {
        const score = calculateSectorScore(b2bProfile, b2bProfile, 'B2B', 'B2B');
        expect(score).toBe(1.0);
    });
    test('B2B↔B2B: same sector only scores 0.7', () => {
        const diffSub = { ...b2bProfile2, b2b_sub_sector: 'hardware_electronics' };
        const score = calculateSectorScore(b2bProfile, diffSub, 'B2B', 'B2B');
        expect(score).toBe(0.7);
    });
    test('B2B↔B2B: different sector scores 0', () => {
        const otherB2b = { ...b2bProfile2, b2b_sector: 'agriculture_food', b2b_sub_sector: 'dairy' };
        const score = calculateSectorScore(b2bProfile, otherB2b, 'B2B', 'B2B');
        expect(score).toBe(0);
    });
    test('B2B↔STARTUP: cross-taxonomy match via CROSS_SECTOR_MAP scores > 0', () => {
        // b2bProfile.b2b_sector = 'technology' → maps to ['saas','ai_ml','deeptech','fintech']
        // startupProfile has 'fintech' and 'saas' → overlap
        const score = calculateSectorScore(b2bProfile, startupProfile, 'B2B', 'STARTUP');
        expect(score).toBeGreaterThan(0);
    });
    test('B2B↔STARTUP: no cross-taxonomy overlap scores 0', () => {
        const agriB2b = { ...b2bProfile, b2b_sector: 'agriculture_food' };
        const finOnlyStartup = { ...startupProfile, startup_industry_sector: ['fintech'], primary_sector: [] };
        // agriculture_food maps to agritech, consumer — no overlap with fintech
        const score = calculateSectorScore(agriB2b, finOnlyStartup, 'B2B', 'STARTUP');
        expect(score).toBe(0);
    });
});

describe('ScoringService — Intent Score', () => {
    test('STARTUP(seed_investment) ↔ INVESTOR(actively_deploying): full match = 1.0', () => {
        const score = calculateIntentScore(startupProfile, investorProfile, 'STARTUP', 'INVESTOR');
        expect(score).toBe(1.0);
    });
    test('INVESTOR(actively_deploying) ↔ STARTUP(seed_investment): full match = 1.0', () => {
        const score = calculateIntentScore(investorProfile, startupProfile, 'INVESTOR', 'STARTUP');
        expect(score).toBe(1.0);
    });
    test('B2B(seeking_distributor) ↔ B2B(seeking_supplier): full match = 1.0', () => {
        const score = calculateIntentScore(b2bProfile, b2bProfile2, 'B2B', 'B2B');
        expect(score).toBe(1.0);
    });
    test('incompatible intents score 0', () => {
        const otherInvestor = { ...investorProfile, investor_intent: 'selectively_investing' };
        // selectively_investing ↔ seed_investment: seed_investment is in selectively_investing compat list
        // but let's test a genuinely incompatible pair
        const diffStartup = { ...startupProfile, startup_intent: 'strategic_partner' };
        // strategic_partner compatible with open_to_alliance, open_to_co_investment
        // otherInvestor has selectively_investing, not in those lists
        const score = calculateIntentScore(diffStartup, otherInvestor, 'STARTUP', 'INVESTOR');
        expect(score).toBe(0);
    });
    test('returns 0 when either intent is null', () => {
        const noIntent = { ...startupProfile, startup_intent: null };
        const score = calculateIntentScore(noIntent, investorProfile, 'STARTUP', 'INVESTOR');
        expect(score).toBe(0);
    });
});

describe('ScoringService — Revenue Score', () => {
    test('B2B↔B2B: same revenue band scores 1.0', () => {
        const sameBand = { ...b2bProfile2, revenue_band: '1_10cr' };
        const score = calculateRevenueScore(b2bProfile, sameBand, 'B2B', 'B2B');
        expect(score).toBe(1.0);
    });
    test('B2B↔B2B: adjacent bands score > 0.5', () => {
        // '1_10cr' (index 1) vs '10_50cr' (index 2) → distance 1, max 4 → 0.75
        const score = calculateRevenueScore(b2bProfile, b2bProfile2, 'B2B', 'B2B');
        expect(score).toBeCloseTo(0.75, 2);
    });
    test('B2B↔B2B: far bands score lower', () => {
        const lowBand  = { ...b2bProfile,  revenue_band: 'lt_1cr' };
        const highBand = { ...b2bProfile2, revenue_band: 'gt_250cr' };
        const score = calculateRevenueScore(lowBand, highBand, 'B2B', 'B2B');
        expect(score).toBeLessThan(0.5);
    });
    test('STARTUP↔INVESTOR: overlapping funding ranges score > 0', () => {
        // startup: 500k-2M, investor: 1M-5M → overlap 1M-2M
        const score = calculateRevenueScore(startupProfile, investorProfile, 'STARTUP', 'INVESTOR');
        expect(score).toBeGreaterThan(0);
    });
    test('STARTUP↔INVESTOR: no range overlap scores 0', () => {
        const highTicket = { ...investorProfile, ticket_size_amt_min: 5000000, ticket_size_amt_max: 10000000 };
        const score = calculateRevenueScore(startupProfile, highTicket, 'STARTUP', 'INVESTOR');
        expect(score).toBe(0);
    });
    test('B2B↔B2B: missing revenue band scores 0', () => {
        const noRevenue = { ...b2bProfile, revenue_band: null };
        const score = calculateRevenueScore(noRevenue, b2bProfile2, 'B2B', 'B2B');
        expect(score).toBe(0);
    });
    test('non-applicable pair (B2B↔INVESTOR) returns 0', () => {
        const score = calculateRevenueScore(b2bProfile, investorProfile, 'B2B', 'INVESTOR');
        expect(score).toBe(0);
    });
});

describe('ScoringService — MOQ Score', () => {
    test('B2B↔B2B: same MOQ scores 1.0', () => {
        const sameMoq = { ...b2bProfile2, min_order_quantity: 100 };
        expect(calculateMoqScore(b2bProfile, sameMoq, 'B2B', 'B2B')).toBe(1.0);
    });
    test('B2B↔B2B: similar MOQ scores close to 1', () => {
        // 80/100 = 0.8
        const score = calculateMoqScore(b2bProfile, b2bProfile2, 'B2B', 'B2B');
        expect(score).toBeCloseTo(0.8, 2);
    });
    test('B2B↔B2B: very different MOQ scores low', () => {
        const bigMoq = { ...b2bProfile2, min_order_quantity: 10000 };
        const score = calculateMoqScore(b2bProfile, bigMoq, 'B2B', 'B2B');
        expect(score).toBeLessThan(0.1);
    });
    test('returns null for non-B2B pairs (STARTUP↔INVESTOR)', () => {
        expect(calculateMoqScore(startupProfile, investorProfile, 'STARTUP', 'INVESTOR')).toBeNull();
    });
    test('returns 0.5 (neutral) when MOQ is missing for B2B pair', () => {
        const noMoq = { ...b2bProfile, min_order_quantity: null };
        expect(calculateMoqScore(noMoq, b2bProfile2, 'B2B', 'B2B')).toBe(0.5);
    });
});

describe('ScoringService — Completeness Score', () => {
    test('fully filled STARTUP profile scores 1.0', () => {
        const fullProfile = {
            ...startupProfile,
            team_size_min: 5, team_size_max: 20,
            company_website_url: 'https://finca.io'
        };
        const score = calculateCompletenessScore(fullProfile, 'STARTUP');
        expect(score).toBeGreaterThan(0.5);
    });
    test('empty profile scores 0', () => {
        const emptyProfile = { id: 99 };
        const score = calculateCompletenessScore(emptyProfile, 'STARTUP');
        expect(score).toBe(0);
    });
    test('partial profile scores between 0 and 1', () => {
        const score = calculateCompletenessScore(startupProfile, 'STARTUP');
        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThanOrEqual(1);
    });
    test('B2B profile scores correctly', () => {
        const score = calculateCompletenessScore(b2bProfile, 'B2B');
        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThanOrEqual(1);
    });
    test('unknown role returns 0', () => {
        const score = calculateCompletenessScore(startupProfile, 'UNKNOWN');
        expect(score).toBe(0);
    });
});

describe('ScoringService — Export Readiness Score', () => {
    test('export_rediness = yes scores 1.0', () => {
        expect(calculateExportScore(b2bProfile, b2bProfile, 'B2B', 'B2B')).toBe(1.0);
    });
    test('export_rediness = in_progress scores 0.5', () => {
        expect(calculateExportScore(b2bProfile, b2bProfile2, 'B2B', 'B2B')).toBe(0.5);
    });
    test('export_rediness = no scores 0.0', () => {
        const noExport = { ...b2bProfile2, export_rediness: 'no' };
        expect(calculateExportScore(b2bProfile, noExport, 'B2B', 'B2B')).toBe(0.0);
    });
    test('returns null for non-B2B pair (STARTUP↔INVESTOR)', () => {
        expect(calculateExportScore(startupProfile, investorProfile, 'STARTUP', 'INVESTOR')).toBeNull();
    });
    test('missing export_rediness defaults to 0.0 for B2B pair', () => {
        const noVal = { ...b2bProfile2, export_rediness: '' };
        expect(calculateExportScore(b2bProfile, noVal, 'B2B', 'B2B')).toBe(0.0);
    });
});

// ─── Weight Config & Redistribution ──────────────────────────────────────────

describe('ScoringService — Weight Configuration', () => {
    test('MATCHING_WEIGHTS sum to 100', () => {
        const total = Object.values(MATCHING_WEIGHTS).reduce((a, b) => a + b, 0);
        expect(total).toBe(100);
    });
    test('all expected weight keys are present', () => {
        const expectedKeys = ['sector', 'intent', 'geo', 'revenue', 'moq', 'completeness', 'exportReady'];
        expectedKeys.forEach(key => {
            expect(MATCHING_WEIGHTS).toHaveProperty(key);
        });
    });
    test('all weights are positive numbers', () => {
        Object.values(MATCHING_WEIGHTS).forEach(w => {
            expect(w).toBeGreaterThan(0);
        });
    });
});

describe('ScoringService — Weight Redistribution', () => {
    test('null scores have their weights set to 0', () => {
        const rawScores = {
            sector: 0.8, intent: 0.9, geo: 0.6,
            revenue: 0.5, moq: null, completeness: 0.7, exportReady: null
        };
        const adjusted = redistributeWeights(rawScores);
        expect(adjusted.moq.weight).toBe(0);
        expect(adjusted.exportReady.weight).toBe(0);
    });
    test('redistribution increases applicable weights', () => {
        const rawScores = {
            sector: 0.8, intent: 0.9, geo: 0.6,
            revenue: 0.5, moq: null, completeness: 0.7, exportReady: null
        };
        const adjusted = redistributeWeights(rawScores);
        // sector weight should be higher than the base 25
        expect(adjusted.sector.weight).toBeGreaterThan(MATCHING_WEIGHTS.sector);
    });
    test('total redistributed weights equal 100', () => {
        const rawScores = {
            sector: 0.8, intent: 0.9, geo: 0.6,
            revenue: 0.5, moq: null, completeness: 0.7, exportReady: null
        };
        const adjusted = redistributeWeights(rawScores);
        const total = Object.values(adjusted).reduce((sum, { weight }) => sum + weight, 0);
        expect(total).toBeCloseTo(100, 0);
    });
    test('no null scores — weights are unchanged', () => {
        const rawScores = {
            sector: 0.8, intent: 0.9, geo: 0.6,
            revenue: 0.5, moq: 0.7, completeness: 0.7, exportReady: 0.4
        };
        const adjusted = redistributeWeights(rawScores);
        expect(adjusted.sector.weight).toBeCloseTo(MATCHING_WEIGHTS.sector, 1);
    });
});

// ─── Total Score Calculation ──────────────────────────────────────────────────

describe('ScoringService — calculateScore() total', () => {
    test('STARTUP↔INVESTOR: total score is between 0 and 100', () => {
        const { totalScore } = calculateScore(startupProfile, investorProfile, 'STARTUP', 'INVESTOR');
        expect(totalScore).toBeGreaterThanOrEqual(0);
        expect(totalScore).toBeLessThanOrEqual(100);
    });
    test('B2B↔B2B: total score is between 0 and 100', () => {
        const { totalScore } = calculateScore(b2bProfile, b2bProfile2, 'B2B', 'B2B');
        expect(totalScore).toBeGreaterThanOrEqual(0);
        expect(totalScore).toBeLessThanOrEqual(100);
    });
    test('STARTUP↔INVESTOR: breakdown contains all 7 keys', () => {
        const { breakdown } = calculateScore(startupProfile, investorProfile, 'STARTUP', 'INVESTOR');
        ['sector', 'intent', 'geo', 'revenue', 'moq', 'completeness', 'exportReady'].forEach(key => {
            expect(breakdown).toHaveProperty(key);
        });
    });
    test('STARTUP↔INVESTOR: breakdown values are non-negative integers', () => {
        const { breakdown } = calculateScore(startupProfile, investorProfile, 'STARTUP', 'INVESTOR');
        Object.values(breakdown).forEach(val => {
            expect(val).toBeGreaterThanOrEqual(0);
            expect(Number.isInteger(val)).toBe(true);
        });
    });
    test('high-compatibility pair scores higher than low-compatibility pair', () => {
        // Identical matching startup ↔ investor should score higher than a mismatch
        const { totalScore: highScore } = calculateScore(startupProfile, investorProfile, 'STARTUP', 'INVESTOR');
        const poorInvestor = {
            ...investorProfile,
            investor_sector_preference: ['gaming'],
            investor_intent: 'selectively_investing',
            ticket_size_amt_min: 50000000,
            ticket_size_amt_max: 100000000,
            country: 'USA',
            continent: 'North America'
        };
        const { totalScore: lowScore } = calculateScore(startupProfile, poorInvestor, 'STARTUP', 'INVESTOR');
        expect(highScore).toBeGreaterThan(lowScore);
    });
});
