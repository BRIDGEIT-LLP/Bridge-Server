'use strict';

const { ELIGIBLE_ROLE_PAIRS, CONNECTABLE_ROLE_PAIRS } = require('./matchingConfig');

const pairExists = (pairs, sourceRole, targetRole) => {
    if (!sourceRole || !targetRole) return false;
    const src = sourceRole.toUpperCase();
    const tgt = targetRole.toUpperCase();
    return pairs.some((pair) => pair.source === src && pair.target === tgt);
};

/**
 * Checks whether a source→target role pair is eligible for matching.
 */
const isEligible = (sourceRole, targetRole) => pairExists(ELIGIBLE_ROLE_PAIRS, sourceRole, targetRole);

/**
 * Roles the source may search for and send a connection request to.
 * Same list for GET /users/search and POST /connections.
 */
const getConnectableRoles = (sourceRole) => {
    if (!sourceRole) return [];
    const src = sourceRole.toUpperCase();
    return CONNECTABLE_ROLE_PAIRS.filter((pair) => pair.source === src).map((pair) => pair.target);
};

/** True when POST /connections may create a row for this role pair. */
const canConnect = (sourceRole, targetRole) => pairExists(CONNECTABLE_ROLE_PAIRS, sourceRole, targetRole);

/**
 * Filters a list of candidate profiles to only those with eligible roles
 * relative to the source role.
 */
const filterEligibleCandidates = (sourceRole, candidates) => {
    if (!sourceRole || !Array.isArray(candidates)) return [];
    return candidates.filter(candidate => isEligible(sourceRole, candidate.role_code));
};

module.exports = {
    isEligible,
    canConnect,
    getConnectableRoles,
    filterEligibleCandidates
};
