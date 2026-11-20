'use strict';

const {
    MATCHING_WEIGHTS,
    INTENT_COMPATIBILITY,
    REVENUE_BAND_ORDER,
    COMPLETENESS_FIELDS
} = require('./matchingConfig');
const { calculateGeoScore } = require('./geoFilterService');

/**
 * Returns the sector array for a profile. Every role stores its sectors in the
 * shared `primary_sector` column (one common sector list for all roles).
 */
const getSectorValues = (profile, roleCode) => {
    if (!['STARTUP', 'INVESTOR', 'B2B'].includes(roleCode)) return [];
    return (profile.primary_sector || []).filter(Boolean);
};

/**
 * Returns the intent value for a profile based on its role.
 */
const getIntentValue = (profile, roleCode) => {
    switch (roleCode) {
        case 'STARTUP':  return profile.startup_intent;
        case 'INVESTOR': return profile.investor_intent;
        case 'B2B':      return profile.b2b_intent;
        default:         return null;
    }
};

/**
 * Calculates Jaccard similarity between two arrays.
 * Returns 0.0 – 1.0.
 */
const jaccardSimilarity = (arrA, arrB) => {
    if (!arrA.length || !arrB.length) return 0;
    const setA = new Set(arrA.map(s => (s || '').toLowerCase()));
    const setB = new Set(arrB.map(s => (s || '').toLowerCase()));
    const intersection = [...setA].filter(x => setB.has(x));
    const union = new Set([...setA, ...setB]);
    return union.size > 0 ? intersection.length / union.size : 0;
};

/**
 * SECTOR MATCH (0.0 – 1.0)
 * 
 * All roles share one sector list stored in `primary_sector`, so every pair is
 * scored with Jaccard similarity on those arrays.
 * B2B↔B2B: a matching (free-text) sub-sector adds a bonus when sectors overlap.
 */
const SUB_SECTOR_BONUS = 0.3;

const normalizeText = (v) => (v || '').toString().trim().toLowerCase();

const calculateSectorScore = (source, candidate, sourceRole, candidateRole) => {
    const sourceSectors    = getSectorValues(source, sourceRole);
    const candidateSectors = getSectorValues(candidate, candidateRole);

    const score = jaccardSimilarity(sourceSectors, candidateSectors);

    if (score > 0 && sourceRole === 'B2B' && candidateRole === 'B2B') {
        const srcSub  = normalizeText(source.b2b_sub_sector);
        const candSub = normalizeText(candidate.b2b_sub_sector);
        if (srcSub && srcSub === candSub) {
            return Math.min(score + SUB_SECTOR_BONUS, 1.0);
        }
    }
    return score;
};

/**
 * INTENT MATCH (0.0 – 1.0)
 * 
 * Enum-based compatibility using INTENT_COMPATIBILITY matrix.
 * Full score (1.0) if compatible, 0.0 if not.
 */
const calculateIntentScore = (source, candidate, sourceRole, candidateRole) => {
    const sourceIntent    = getIntentValue(source, sourceRole);
    const candidateIntent = getIntentValue(candidate, candidateRole);

    if (!sourceIntent || !candidateIntent) return 0;

    const compatible = INTENT_COMPATIBILITY[sourceIntent] || [];
    if (compatible.includes(candidateIntent)) return 1.0;

    // Check reverse — is the candidate's intent compatible with the source?
    const reverseCompatible = INTENT_COMPATIBILITY[candidateIntent] || [];
    if (reverseCompatible.includes(sourceIntent)) return 0.8;

    return 0;
};

/**
 * REVENUE COMPATIBILITY (0.0 – 1.0)
 * 
 * B2B↔B2B: Ordinal proximity on REVENUE_BAND_ORDER.
 * Startup↔Investor: Overlap ratio of funding ask range vs ticket size range.
 */
const calculateRevenueScore = (source, candidate, sourceRole, candidateRole) => {
    // B2B↔B2B: revenue band proximity
    if (sourceRole === 'B2B' && candidateRole === 'B2B') {
        const srcBand  = source.revenue_band;
        const candBand = candidate.revenue_band;
        if (!srcBand || !candBand) return 0;

        const srcIdx  = REVENUE_BAND_ORDER.indexOf(srcBand);
        const candIdx = REVENUE_BAND_ORDER.indexOf(candBand);
        if (srcIdx === -1 || candIdx === -1) return 0;

        const distance = Math.abs(srcIdx - candIdx);
        const maxDist  = REVENUE_BAND_ORDER.length - 1;
        return Math.max(0, 1 - (distance / maxDist));
    }

    // Startup↔Investor: funding range overlap
    let startup, investor;
    if (sourceRole === 'STARTUP' && candidateRole === 'INVESTOR') {
        startup  = source;
        investor = candidate;
    } else if (sourceRole === 'INVESTOR' && candidateRole === 'STARTUP') {
        startup  = candidate;
        investor = source;
    } else {
        return 0; // Not applicable for this pair
    }

    const askMin    = startup.funding_ask_amt_min;
    const askMax    = startup.funding_ask_amt_max;
    const ticketMin = investor.ticket_size_amt_min;
    const ticketMax = investor.ticket_size_amt_max;

    if (!askMin || !askMax || !ticketMin || !ticketMax) return 0;

    // Calculate overlap of ranges
    const overlapStart = Math.max(askMin, ticketMin);
    const overlapEnd   = Math.min(askMax, ticketMax);

    if (overlapStart >= overlapEnd) return 0;

    const overlapSize   = overlapEnd - overlapStart;
    const smallerRange  = Math.min(askMax - askMin, ticketMax - ticketMin);

    return smallerRange > 0 ? Math.min(overlapSize / smallerRange, 1.0) : 0;
};

/**
 * MOQ COMPATIBILITY (0.0 – 1.0)
 * 
 * B2B↔B2B only: ratio-based — min(a,b)/max(a,b).
 * Returns null if not applicable (signals weight redistribution).
 */
const calculateMoqScore = (source, candidate, sourceRole, candidateRole) => {
    if (sourceRole !== 'B2B' || candidateRole !== 'B2B') return null;

    const srcMoq  = source.min_order_quantity;
    const candMoq = candidate.min_order_quantity;

    if (!srcMoq || !candMoq) return 0.5; // Neutral if either is missing

    const minVal = Math.min(srcMoq, candMoq);
    const maxVal = Math.max(srcMoq, candMoq);
    return maxVal > 0 ? minVal / maxVal : 0;
};

/**
 * PROFILE COMPLETENESS (0.0 – 1.0)
 * 
 * Counts non-empty fields from the role-specific completeness field list.
 */
const calculateCompletenessScore = (profile, roleCode) => {
    const fields = COMPLETENESS_FIELDS[roleCode] || [];
    if (fields.length === 0) return 0;

    let filled = 0;
    for (const field of fields) {
        const value = profile[field];
        if (value !== null && value !== undefined && value !== '') {
            if (Array.isArray(value) && value.length === 0) continue;
            filled++;
        }
    }
    return filled / fields.length;
};

/**
 * EXPORT READINESS (0.0 – 1.0)
 * 
 * B2B only: yes = 1.0, in_progress = 0.5, no = 0.0.
 * Returns null if not applicable (signals weight redistribution).
 */
const calculateExportScore = (source, candidate, sourceRole, candidateRole) => {
    if (sourceRole !== 'B2B' && candidateRole !== 'B2B') return null;

    // Score the candidate's export readiness
    const exportValue = (candidate.export_rediness || '').toLowerCase();

    switch (exportValue) {
        case 'yes':         return 1.0;
        case 'in_progress': return 0.5;
        case 'no':          return 0.0;
        default:            return 0.0;
    }
};

/**
 * Redistributes weights when some factors return null (not applicable).
 * The inapplicable weight is spread proportionally across applicable factors.
 */
const redistributeWeights = (rawScores) => {
    const weights = { ...MATCHING_WEIGHTS };
    let nullWeight = 0;
    let applicableTotal = 0;

    // Identify null (inapplicable) factors
    for (const [key, score] of Object.entries(rawScores)) {
        if (score === null) {
            nullWeight += weights[key] || 0;
        } else {
            applicableTotal += weights[key] || 0;
        }
    }

    // Redistribute null weight proportionally
    const adjusted = {};
    for (const [key, score] of Object.entries(rawScores)) {
        if (score === null) {
            adjusted[key] = { weight: 0, score: 0 };
        } else {
            const baseWeight = weights[key] || 0;
            const redistributed = applicableTotal > 0
                ? baseWeight + (baseWeight / applicableTotal) * nullWeight
                : baseWeight;
            adjusted[key] = { weight: redistributed, score };
        }
    }

    return adjusted;
};

/**
 * Main scoring function.
 * Calculates all factor scores and returns a total + breakdown.
 */
const calculateScore = (sourceProfile, candidateProfile, sourceRole, candidateRole) => {
    // Calculate raw scores for each factor
    const rawScores = {
        sector:      calculateSectorScore(sourceProfile, candidateProfile, sourceRole, candidateRole),
        intent:      calculateIntentScore(sourceProfile, candidateProfile, sourceRole, candidateRole),
        geo:         calculateGeoScore(sourceProfile, candidateProfile),
        revenue:     calculateRevenueScore(sourceProfile, candidateProfile, sourceRole, candidateRole),
        moq:         calculateMoqScore(sourceProfile, candidateProfile, sourceRole, candidateRole),
        completeness: calculateCompletenessScore(candidateProfile, candidateRole),
        exportReady: calculateExportScore(sourceProfile, candidateProfile, sourceRole, candidateRole)
    };

    // Redistribute weights for non-applicable factors (null scores)
    const adjusted = redistributeWeights(rawScores);

    // Calculate weighted scores and total
    const breakdown = {};
    let totalScore = 0;

    for (const [key, { weight, score }] of Object.entries(adjusted)) {
        const weighted = Math.round(score * weight);
        breakdown[key] = weighted;
        totalScore += weighted;
    }

    return {
        totalScore: Math.min(totalScore, 100),
        breakdown
    };
};

module.exports = {
    calculateScore,
    // Export individual calculators for unit testing
    calculateSectorScore,
    calculateIntentScore,
    calculateRevenueScore,
    calculateMoqScore,
    calculateCompletenessScore,
    calculateExportScore,
    calculateGeoScore,
    redistributeWeights,
    jaccardSimilarity,
    getSectorValues,
    getIntentValue
};
