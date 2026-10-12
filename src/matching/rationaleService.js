'use strict';

const { MATCHING_WEIGHTS } = require('./matchingConfig');

/**
 * Human-readable labels for each scoring factor.
 */
const FACTOR_LABELS = {
    sector:      'Sector Match',
    intent:      'Intent Match',
    geo:         'Geography Match',
    revenue:     'Revenue Compatibility',
    moq:         'MOQ Compatibility',
    completeness:'Profile Completeness',
    exportReady: 'Export Readiness'
};

/**
 * Generates per-factor rationale sentences based on actual profile data.
 */
const buildFactorSentence = (factor, score, maxWeight, sourceProfile, candidateProfile) => {
    const earned = score;
    const pct = maxWeight > 0 ? earned / maxWeight : 0;

    if (pct === 0) return null;

    switch (factor) {
        case 'sector': {
            const sector = candidateProfile.b2b_sector
                || (candidateProfile.startup_industry_sector || [])[0]
                || (candidateProfile.investor_sector_preference || [])[0]
                || candidateProfile.primary_sector?.[0];
            if (sector && pct >= 0.8) return `Strong ${sector} sector alignment.`;
            if (sector && pct >= 0.4) return `Partial ${sector} sector overlap.`;
            return 'Related industry sectors identified.';
        }
        case 'intent': {
            const intent = candidateProfile.b2b_intent
                || candidateProfile.startup_intent
                || candidateProfile.investor_intent;
            const readableIntent = intent ? intent.replace(/_/g, ' ') : 'business';
            if (pct >= 0.8) return `Intent alignment: ${readableIntent}.`;
            if (pct >= 0.4) return `Partially compatible ${readableIntent} intent.`;
            return null;
        }
        case 'geo': {
            const srcCountry  = sourceProfile.country;
            const candCountry = candidateProfile.country;
            if (srcCountry && candCountry && srcCountry === candCountry)
                return `Both operate within ${srcCountry}.`;
            const srcCont = sourceProfile.continent;
            const candCont = candidateProfile.continent;
            if (srcCont && candCont && srcCont === candCont)
                return `Both based in ${srcCont}.`;
            return 'International reach potential.';
        }
        case 'revenue': {
            if (pct >= 0.8) return 'Compatible revenue scale.';
            if (pct >= 0.5) return 'Broadly similar revenue band.';
            return null;
        }
        case 'moq': {
            if (pct >= 0.8) return 'Well-matched order quantities.';
            if (pct >= 0.5) return 'Reasonable MOQ compatibility.';
            return null;
        }
        case 'completeness': {
            if (pct >= 0.8) return 'Highly complete profile increases confidence.';
            return null;
        }
        case 'exportReady': {
            const exportVal = candidateProfile.export_rediness;
            if (exportVal === 'yes') return 'Export-ready business.';
            if (exportVal === 'in_progress') return 'Export readiness in progress.';
            return null;
        }
        default:
            return null;
    }
};

/**
 * Generates the rationale string and top factors list from the score breakdown.
 *
 * @param {Object} breakdown - Score breakdown keyed by factor
 * @param {Object} sourceProfile
 * @param {Object} candidateProfile
 * @returns {{ rationale: string, topFactors: string[] }}
 */
const generateRationale = (breakdown, sourceProfile, candidateProfile) => {
    // Sort factors by earned score (descending) and pick top 3
    const sorted = Object.entries(breakdown)
        .filter(([, score]) => score > 0)
        .sort(([, a], [, b]) => b - a);

    const topFactors = sorted
        .slice(0, 3)
        .map(([key]) => FACTOR_LABELS[key])
        .filter(Boolean);

    // Build rationale sentences for top factors
    const sentences = sorted
        .slice(0, 3)
        .map(([key, score]) => {
            const maxWeight = MATCHING_WEIGHTS[key] || 0;
            return buildFactorSentence(key, score, maxWeight, sourceProfile, candidateProfile);
        })
        .filter(Boolean);

    const rationale = sentences.length > 0
        ? sentences.join(' ')
        : 'Some compatibility found between profiles.';

    return { rationale, topFactors };
};

module.exports = {
    generateRationale,
    FACTOR_LABELS
};
