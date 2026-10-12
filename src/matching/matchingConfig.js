'use strict';

/**
 * Matching Engine Configuration
 * 
 * All weights, rules, and mappings are centralized here for easy maintenance.
 * Future goal: store in DB and configure from admin panel.
 */

// Scoring weights (must sum to 100)
const MATCHING_WEIGHTS = {
    sector: 25,
    intent: 20,
    geo: 15,
    revenue: 15,
    moq: 10,
    completeness: 10,
    exportReady: 5
};

// Limit of profiles to return in the API response (based on score)
const MATCHES_LIMIT = 10;


// Valid role-pair combinations for matching eligibility
const ELIGIBLE_ROLE_PAIRS = [
    { source: 'STARTUP', target: 'INVESTOR' },
    { source: 'INVESTOR', target: 'STARTUP' },
    { source: 'B2B', target: 'B2B' },
];

// Who search may show, and who POST /connections may create a row for.
// Broader than matching: a Startup can find/connect to a B2B even if the
// matching engine does not recommend that pair.
const CONNECTABLE_ROLE_PAIRS = [
    { source: 'STARTUP', target: 'INVESTOR' },
    { source: 'STARTUP', target: 'B2B' },
    { source: 'INVESTOR', target: 'STARTUP' },
    { source: 'B2B', target: 'STARTUP' },
    { source: 'B2B', target: 'B2B' },
];

// Revenue bands ordered by size for proximity comparison
const REVENUE_BAND_ORDER = ['lt_1cr', '1_10cr', '10_50cr', '50_250cr', 'gt_250cr'];

// Geographic proximity scoring tiers
const GEO_SCORES = {
    sameCountry: 1.0,
    sameContinent: 0.6,
    international: 0.3
};

// Explicit intent compatibility rules (enum-based matching)
const INTENT_COMPATIBILITY = {
    // Startup intents → compatible Investor/B2B intents
    seed_investment:     ['actively_deploying', 'selectively_investing'],
    angel_investor:      ['actively_deploying', 'open_to_co_investment'],
    strategic_partner:   ['open_to_alliance', 'open_to_co_investment'],
    open_to_acquisition: ['actively_deploying', 'selectively_investing', 'open_to_co_investment'],

    // Investor intents → compatible Startup intents
    actively_deploying:    ['seed_investment', 'angel_investor', 'open_to_acquisition'],
    selectively_investing: ['seed_investment', 'open_to_acquisition'],
    open_to_co_investment: ['angel_investor', 'strategic_partner', 'open_to_acquisition'],

    // B2B intents → compatible B2B/Startup intents
    seeking_distributor:           ['seeking_supplier', 'open_to_alliance', 'strategic_partner'],
    seeking_supplier:              ['seeking_distributor', 'open_to_alliance', 'seeking_manufacturing_partner'],
    seeking_export_buyer:          ['seeking_supplier', 'open_to_alliance'],
    seeking_manufacturing_partner: ['seeking_supplier', 'open_to_alliance', 'strategic_partner'],
    open_to_alliance:              ['strategic_partner', 'seeking_distributor', 'seeking_supplier',
                                    'seeking_export_buyer', 'seeking_manufacturing_partner']
};

// B2B sector → Startup/Investor sector mapping (cross-taxonomy bridge)
const CROSS_SECTOR_MAP = {
    'agriculture_food':  ['agritech', 'consumer'],
    'technology':        ['saas', 'ai_ml', 'deeptech', 'fintech'],
    'healthcare_pharma': ['healthtech'],
    'manufacturing':     ['deeptech', 'logistics'],
    'textiles_apparel':  ['consumer', 'ecommerce']
};

// Fields used to calculate profile completeness, per role
const COMPLETENESS_FIELDS = {
    STARTUP: [
        'first_name', 'last_name', 'organization_name', 'profile_photo',
        'short_bio', 'country', 'primary_sector', 'startup_industry_sector',
        'funding_stage', 'funding_ask_amt_min', 'funding_ask_amt_max',
        'business_description', 'startup_intent', 'linkedin_profile_url'
    ],
    INVESTOR: [
        'first_name', 'last_name', 'organization_name', 'profile_photo',
        'short_bio', 'country', 'investor_sector_preference',
        'prefrerred_investment_stage', 'ticket_size_amt_min', 'ticket_size_amt_max',
        'investor_type', 'investor_intent', 'linkedin_profile_url'
    ],
    B2B: [
        'first_name', 'last_name', 'organization_name', 'profile_photo',
        'short_bio', 'country', 'b2b_sector', 'b2b_sub_sector',
        'revenue_band', 'min_order_quantity', 'export_rediness',
        'b2b_intent', 'linkedin_profile_url', 'products_ervice_Offered'
    ]
};

module.exports = {
    MATCHING_WEIGHTS,
    MATCHES_LIMIT,
    ELIGIBLE_ROLE_PAIRS,
    CONNECTABLE_ROLE_PAIRS,
    REVENUE_BAND_ORDER,
    GEO_SCORES,
    INTENT_COMPATIBILITY,
    CROSS_SECTOR_MAP,
    COMPLETENESS_FIELDS
};
