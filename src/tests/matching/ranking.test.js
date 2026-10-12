'use strict';

const { calculateScore } = require('../../matching/scoringService');

// ─── Mock profiles ────────────────────────────────────────────────────────────

const startupProfile = {
    id: 1,
    startup_industry_sector: ['fintech', 'saas'],
    primary_sector: ['ai_ml'],
    startup_intent: 'seed_investment',
    funding_ask_amt_min: 500000,
    funding_ask_amt_max: 2000000,
    funding_stage: 'seed',
    country: 'India', continent: 'Asia',
    profile_photo: 'photo.jpg', short_bio: 'A fintech startup',
    first_name: 'Alice', last_name: 'Smith', organization_name: 'FinCo',
    linkedin_profile_url: 'https://linkedin.com/in/alice',
    business_description: 'We build fintech tools'
};

// High-match investor — same country, compatible intent, overlapping sectors & funding
const highMatchInvestor = {
    id: 2,
    investor_sector_preference: ['fintech', 'saas', 'ai_ml'],
    investor_intent: 'actively_deploying',
    ticket_size_amt_min: 500000,
    ticket_size_amt_max: 3000000,
    prefrerred_investment_stage: ['seed'],
    investor_type: 'vc',
    country: 'India', continent: 'Asia',
    profile_photo: 'photo.jpg', short_bio: 'Active VC',
    first_name: 'Bob', last_name: 'Jones', organization_name: 'VC Fund',
    linkedin_profile_url: 'https://linkedin.com/in/bob'
};

// Medium-match investor — same continent, partial sector overlap, compatible intent
const medMatchInvestor = {
    id: 3,
    investor_sector_preference: ['fintech', 'gaming'],
    investor_intent: 'selectively_investing',
    ticket_size_amt_min: 2000000,
    ticket_size_amt_max: 8000000,
    prefrerred_investment_stage: ['series_a'],
    investor_type: 'angel',
    country: 'Singapore', continent: 'Asia',
    profile_photo: null, short_bio: null,
    first_name: 'Carol', last_name: 'Lee', organization_name: 'Angel Fund',
    linkedin_profile_url: null
};

// Low-match investor — different continent, incompatible intent, no sector overlap
const lowMatchInvestor = {
    id: 4,
    investor_sector_preference: ['gaming', 'consumer'],
    investor_intent: 'open_to_co_investment',
    ticket_size_amt_min: 10000000,
    ticket_size_amt_max: 50000000,
    prefrerred_investment_stage: ['series_b', 'growth'],
    investor_type: 'corporate',
    country: 'USA', continent: 'North America',
    profile_photo: null, short_bio: null,
    first_name: 'Dave', last_name: 'Kim', organization_name: 'Corp Fund',
    linkedin_profile_url: null
};

// ─── Ranking Tests ────────────────────────────────────────────────────────────

describe('Ranking — Score ordering', () => {

    const scoreCandidates = (source, candidates, sourceRole, candidateRole) =>
        candidates
            .map(c => ({
                ...c,
                compatibility: calculateScore(source, c, sourceRole, candidateRole).totalScore
            }))
            .sort((a, b) => b.compatibility - a.compatibility);

    test('highest scoring match is ranked first', () => {
        const ranked = scoreCandidates(
            startupProfile,
            [highMatchInvestor, medMatchInvestor, lowMatchInvestor],
            'STARTUP', 'INVESTOR'
        );
        expect(ranked[0].id).toBe(highMatchInvestor.id);
    });

    test('lowest scoring match is ranked last', () => {
        const ranked = scoreCandidates(
            startupProfile,
            [highMatchInvestor, medMatchInvestor, lowMatchInvestor],
            'STARTUP', 'INVESTOR'
        );
        expect(ranked[ranked.length - 1].id).toBe(lowMatchInvestor.id);
    });

    test('results are in strictly descending order of compatibility', () => {
        const ranked = scoreCandidates(
            startupProfile,
            [highMatchInvestor, medMatchInvestor, lowMatchInvestor],
            'STARTUP', 'INVESTOR'
        );
        for (let i = 0; i < ranked.length - 1; i++) {
            expect(ranked[i].compatibility).toBeGreaterThanOrEqual(ranked[i + 1].compatibility);
        }
    });

    test('medium match ranks between high and low', () => {
        const ranked = scoreCandidates(
            startupProfile,
            [highMatchInvestor, medMatchInvestor, lowMatchInvestor],
            'STARTUP', 'INVESTOR'
        );
        expect(ranked[1].id).toBe(medMatchInvestor.id);
    });

    test('all 3 candidates are present in the ranked result', () => {
        const ranked = scoreCandidates(
            startupProfile,
            [highMatchInvestor, medMatchInvestor, lowMatchInvestor],
            'STARTUP', 'INVESTOR'
        );
        expect(ranked).toHaveLength(3);
    });

    test('empty candidates array returns empty result', () => {
        const ranked = scoreCandidates(startupProfile, [], 'STARTUP', 'INVESTOR');
        expect(ranked).toHaveLength(0);
    });

    test('single candidate array returns that candidate ranked first', () => {
        const ranked = scoreCandidates(
            startupProfile,
            [highMatchInvestor],
            'STARTUP', 'INVESTOR'
        );
        expect(ranked).toHaveLength(1);
        expect(ranked[0].id).toBe(highMatchInvestor.id);
    });

    test('scores are integers (Math.round applied)', () => {
        const ranked = scoreCandidates(
            startupProfile,
            [highMatchInvestor, medMatchInvestor],
            'STARTUP', 'INVESTOR'
        );
        ranked.forEach(r => {
            expect(Number.isInteger(r.compatibility)).toBe(true);
        });
    });

    test('all scores are between 0 and 100', () => {
        const ranked = scoreCandidates(
            startupProfile,
            [highMatchInvestor, medMatchInvestor, lowMatchInvestor],
            'STARTUP', 'INVESTOR'
        );
        ranked.forEach(r => {
            expect(r.compatibility).toBeGreaterThanOrEqual(0);
            expect(r.compatibility).toBeLessThanOrEqual(100);
        });
    });

    test('reordering input array does not change final ranking', () => {
        const order1 = scoreCandidates(
            startupProfile,
            [lowMatchInvestor, highMatchInvestor, medMatchInvestor],
            'STARTUP', 'INVESTOR'
        );
        const order2 = scoreCandidates(
            startupProfile,
            [highMatchInvestor, lowMatchInvestor, medMatchInvestor],
            'STARTUP', 'INVESTOR'
        );
        expect(order1.map(r => r.id)).toEqual(order2.map(r => r.id));
    });
});
