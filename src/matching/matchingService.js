'use strict';

const matchingRepository = require('./matchingRepository');
const eligibilityService = require('./eligibilityService');
const scoringService = require('./scoringService');
const rationaleService = require('./rationaleService');
const connectionService = require('../services/connectionService');
const subscriptionService = require('../services/subscriptionService');
const ServiceResponse = require('../utils/ServiceResponse');
const { MATCHING_MESSAGES } = require('../utils/constant');
const { MATCHES_LIMIT } = require('./matchingConfig');
const { errorLogger } = require('../configs/logger');
const { isValidUUID } = require('../utils/Helper');

/**
 * Main matching orchestrator.
 * Executes the full pipeline: fetch → filter → score → rank → respond.
 *
 * @param {number|string} profileId - The user ID to find matches for
 * @returns {ServiceResponse}
 */
const getMatches = async (profileId, userRole) => {
    try {
        const userId = profileId;
        if (!userId || !isValidUUID(userId)) {
            return ServiceResponse.error({
                message: MATCHING_MESSAGES.PROFILE_NOT_FOUND,
                statusCode: 404
            });
        }

        // Step 1: Fetch source profile with role
        const sourceProfile = await matchingRepository.getProfileWithRole(userId);
        if (!sourceProfile) {
            return ServiceResponse.error({
                message: MATCHING_MESSAGES.PROFILE_NOT_FOUND,
                statusCode: 404
            });
        }

        const sourceRole = userRole;

        // Step 2: Subscription first so a paid plan can reset the billing-window epoch
        const subscriptionResult = await subscriptionService.findActivePrememiumSubscription(sourceProfile.company_id, userId);
        if (!subscriptionResult.success) {
            return ServiceResponse.error({ message: subscriptionResult.message, statusCode: subscriptionResult.statusCode });
        }
        const hasActiveSubscription = subscriptionResult.data ? true : false;
        const subscriptionStartDate = subscriptionResult.data?.start_date ?? null;

        // Step 3: Window + used count. Epoch is subscription start_date when subscribed,
        // otherwise user.created_at (resolved inside getConnectionBillingWindow).
        const windowResult = await connectionService.getConnectionBillingWindow(userId, subscriptionStartDate);
        if (!windowResult.success) {
            return ServiceResponse.error({ message: windowResult.message, statusCode: windowResult.statusCode });
        }
        const { windowStart, windowEnd } = windowResult.data;

        const requestCountResult = await connectionService.getConnectionRequestsInWindow(userId, windowStart, windowEnd);
        if (!requestCountResult.success) {
            return ServiceResponse.error({ message: requestCountResult.message, statusCode: requestCountResult.statusCode });
        }
        const requestsSentInWindow = requestCountResult.data.count;

        // Step 4: Determine the request limit (premium vs free) and requests remaining
        const requestLimit = await connectionService.getConnectionRequestLimit(userId, hasActiveSubscription);
        const requestsRemaining = Math.max(requestLimit - requestsSentInWindow, 0);

        // Step 5: Fetch all candidate profiles (excluding user+role combos already connected)
        const allCandidates = await matchingRepository.getCandidateProfiles(userId);

        // Step 6: Apply eligibility filter
        const eligibleCandidates = eligibilityService.filterEligibleCandidates(
            sourceRole,
            allCandidates
        );

        if (eligibleCandidates.length === 0) {
            return ServiceResponse.success({
                message: MATCHING_MESSAGES.NO_MATCHES_FOUND,
                data: { profileId: userId, matches: [], requestsSentInWindow, requestLimit, requestsRemaining },
                statusCode: 200
            });
        }

        // Step 7: Score each eligible candidate
        const scored = eligibleCandidates.map(candidate => {
            const candidateRole = candidate.role_code;

            // Calculate weighted score and breakdown
            const { totalScore, breakdown } = scoringService.calculateScore(
                sourceProfile,
                candidate,
                sourceRole,
                candidateRole
            );

            // Generate rationale and top factors
            const { rationale, topFactors } = rationaleService.generateRationale(
                breakdown,
                sourceProfile,
                candidate
            );

            const matchResponse = {
                profileId: candidate.id,
                companyId: candidate.company_id,
                companyName: candidate.company_name || candidate.organization_name || 'Unknown',
                role: candidateRole,
                roleId: candidate.role_id,
                compatibility: totalScore,
                breakdown,
                topFactors,
                rationale,

                // General user profile fields (from database model)
                first_name: candidate.first_name,
                last_name: candidate.last_name,
                profile_photo: candidate.profile_photo,
                organization_name: candidate.organization_name,
                short_bio: candidate.short_bio,
                country: candidate.country,
                continent: candidate.continent,
                primary_sector: candidate.primary_sector,
                linkedin_profile_url: candidate.linkedin_profile_url,
                linkedin_url: candidate.linkedin_profile_url, // alias for convenience
                company_website_url: candidate.company_website_url,
                company_email: candidate.company_email,
                country_code: candidate.country_code,
                mobile_number: candidate.mobile_number
            };

            // Role-specific fields (from database model)
            if (candidateRole === 'STARTUP') {
                matchResponse.startup_industry_sector = candidate.startup_industry_sector;
                matchResponse.funding_stage = candidate.funding_stage;
                matchResponse.funding_currency = candidate.funding_currency;
                matchResponse.funding_ask_amt_min = candidate.funding_ask_amt_min;
                matchResponse.funding_ask_amt_max = candidate.funding_ask_amt_max;
                matchResponse.use_of_funds = candidate.use_of_funds;
                matchResponse.team_size_min = candidate.team_size_min;
                matchResponse.team_size_max = candidate.team_size_max;
                matchResponse.incorporation_certificate = candidate.incorporation_certificate;
                matchResponse.pitch_deck_certificate = candidate.pitch_deck_certificate;
                matchResponse.business_description = candidate.business_description;
                matchResponse.startup_intent = candidate.startup_intent;
            } else if (candidateRole === 'INVESTOR') {
                matchResponse.ticket_size_amt_min = candidate.ticket_size_amt_min;
                matchResponse.ticket_size_amt_max = candidate.ticket_size_amt_max;
                matchResponse.prefrerred_investment_stage = candidate.prefrerred_investment_stage;
                matchResponse.stage_focus = candidate.stage_focus;
                matchResponse.investor_sector_preference = candidate.investor_sector_preference;
                matchResponse.geographic_investment_preference = candidate.geographic_investment_preference;
                matchResponse.investor_type = candidate.investor_type;
                matchResponse.investor_portfolio_overview = candidate.investor_portfolio_overview;
                matchResponse.number_of_investments_to_date = candidate.number_of_investments_to_date;
                matchResponse.investor_intent = candidate.investor_intent;
            } else if (candidateRole === 'B2B') {
                matchResponse.b2b_sector = candidate.b2b_sector;
                matchResponse.b2b_sub_sector = candidate.b2b_sub_sector;
                matchResponse.revenue_band = candidate.revenue_band;
                matchResponse.min_order_quantity = candidate.min_order_quantity;
                matchResponse.export_rediness = candidate.export_rediness;
                matchResponse.industry_vertical = candidate.industry_vertical;
                matchResponse.years_in_operation = candidate.years_in_operation;
                matchResponse.operational_capacity_description = candidate.operational_capacity_description;
                matchResponse.products_ervice_Offered = candidate.products_ervice_Offered;
                matchResponse.business_requirements = candidate.business_requirements;
                matchResponse.b2b_intent = candidate.b2b_intent;
            }

            return matchResponse;
        });

        // Step 8: Rank by compatibility score (descending)
        scored.sort((a, b) => b.compatibility - a.compatibility);

        // Limit matches to configuration limit if set
        const limitedMatches = MATCHES_LIMIT ? scored.slice(0, MATCHES_LIMIT) : scored;

        return ServiceResponse.success({
            message: MATCHING_MESSAGES.MATCH_SUCCESS,
            data: { profileId: userId, matches: limitedMatches, requestsSentInWindow, requestLimit, requestsRemaining },
            statusCode: 200
        });

    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({
            message: MATCHING_MESSAGES.MATCH_FAILED,
            statusCode: 500
        });
    }
};

module.exports = { getMatches };
