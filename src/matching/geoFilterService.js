'use strict';

const { GEO_SCORES } = require('./matchingConfig');

/**
 * Calculates a geographic proximity score (0.0 – 1.0) between two profiles.
 * Uses country and continent fields (no city/state available in current schema).
 *
 * Scoring tiers:
 *   Same country   → 1.0
 *   Same continent → 0.6
 *   International  → 0.3
 *   Export-ready + international → 0.5 (B2B bonus)
 */
const calculateGeoScore = (sourceProfile, candidateProfile) => {
    const srcCountry   = (sourceProfile.country || '').trim().toLowerCase();
    const candCountry  = (candidateProfile.country || '').trim().toLowerCase();
    const srcContinent = (sourceProfile.continent || '').trim().toLowerCase();
    const candContinent = (candidateProfile.continent || '').trim().toLowerCase();

    // If either profile has no geo data, return a neutral mid-score
    if (!srcCountry && !srcContinent) return 0.5;
    if (!candCountry && !candContinent) return 0.5;

    // Same country
    if (srcCountry && candCountry && srcCountry === candCountry) {
        return GEO_SCORES.sameCountry;
    }

    // Same continent
    if (srcContinent && candContinent && srcContinent === candContinent) {
        return GEO_SCORES.sameContinent;
    }

    // International — check for export readiness bonus (B2B)
    const candidateExportReady = (candidateProfile.export_rediness || '').toLowerCase();
    const sourceExportReady    = (sourceProfile.export_rediness || '').toLowerCase();

    if (candidateExportReady === 'yes' || sourceExportReady === 'yes') {
        return 0.5; // Export-ready bonus for international
    }

    return GEO_SCORES.international;
};

module.exports = {
    calculateGeoScore
};
