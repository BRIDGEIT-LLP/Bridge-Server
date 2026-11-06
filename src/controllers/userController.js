'use strict';
const { errorLogger } = require('../configs/logger');
const fieldMetadataService = require('../services/fieldMetadataService');
const userService = require('../services/userService');
const { USER_MESSAGES, DRAFT_STEPS, DRAFT_MESSAGES } = require('../utils/constant');
const userRepository = require('../repositories/userRepository');
const { encrypt } = require('../utils/encryption');
const { isValidUUID } = require('../utils/Helper');
const HttpResponse = require('../utils/HttpResponse');



const isEmptyValue = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
const withoutEmpty = (obj) => Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => !isEmptyValue(v)));

const createUserProfile = async (req, res, next) => {
    try {
        const { companyId, email, role } = req;
        const userId = req.userId;
        const roleId = req.roleId;
        const requestPayload = req.body;
        // ?draft=true&step=profile|intent keeps what is filled in and does not complete the profile.
        const draft = req.query.draft === 'true';
        const step = req.query.step;
        if (draft && !DRAFT_STEPS.includes(step)) {
            return HttpResponse.error(res, { message: DRAFT_MESSAGES.INVALID_STEP, statusCode: 400 });
        }
        // Completing the profile checks the payload together with what an earlier draft already saved, so the
        // user does not have to send every field again (a draft keeps its fields in the database).
        let payloadToValidate = requestPayload;
        if (!draft) {
            const existing = await userRepository.getUserById(userId);
            const saved = existing ? existing.get({ plain: true }) : {};
            payloadToValidate = { ...withoutEmpty(saved), ...withoutEmpty(requestPayload) };
        }
        const validationResult = await fieldMetadataService.validateUserPayload(role, payloadToValidate, { draft });
        if (!validationResult.success) {
            return HttpResponse.error(res, {
                message: validationResult.message,
                data: validationResult.data,
                statusCode: validationResult.statusCode
            });
        }
        const userData = { ...requestPayload };

        const userProfileResponse = await userService.createUserProfile({ userData, companyId, userId, roleId, draft, step });
        if (!userProfileResponse.success) {
            return HttpResponse.error(res, {
                message: userProfileResponse.message,
                data: userProfileResponse.data,
                statusCode: userProfileResponse.statusCode
            });
        }

        return HttpResponse.success(res, {
            message: userProfileResponse.message,
            data: userProfileResponse.data,
            statusCode: userProfileResponse.statusCode
        });
    } catch (error) {
        console.error(error);
        errorLogger.error(error);
        return HttpResponse.error(res, { message: USER_MESSAGES.CREATE_FAILED, statusCode: 500 });
    }
};

const getUserProfile = async (req, res, next) => {
    try {
        const { companyId } = req;
        const userId = req.userId;
        const roleId = req.roleId;

        const profileResponse = await userService.getUserProfile({ companyId, userId, roleId });
        if (!profileResponse.success) {
            return HttpResponse.error(res, {
                message: profileResponse.message,
                data: profileResponse.data,
                statusCode: profileResponse.statusCode
            });
        }

        return HttpResponse.success(res, {
            message: profileResponse.message,
            data: profileResponse.data,
            statusCode: profileResponse.statusCode
        });
    } catch (error) {
        console.error(error);
        errorLogger.error(error);
        return HttpResponse.error(res, { message: 'Failed to retrieve profile details.', statusCode: 500 });
    }
};

const updateUserProfile = async (req, res, next) => {
    try {

        const companyId = req.companyId; ;
        const userId = req.userId;
        const roleId = req.roleId;
    
        const requstPayload = req.body;
    
        const updateUserRes = await userService.updateUserProfile(requstPayload, userId, companyId);
        if (!updateUserRes.success) {
            return HttpResponse.error(res, {
                message: updateUserRes.message,
                data: updateUserRes.data,
                statusCode: updateUserRes.statusCode
            });
    
        }
        return HttpResponse.success(res, {
            message: updateUserRes.message,
            data: updateUserRes.data,
            statusCode: updateUserRes.statusCode
        });
    }
    catch (error) {
        console.error(error);
        errorLogger.error(error);
        return HttpResponse.error(res, { message: USER_MESSAGES.UPDATE_FAILED, statusCode: 500 });
    }
};

const searchUsers = async (req, res, next) => {
    try {
        const searchQuery = req.query.q;
        const roleCode = req.role;
        const userId = req.userId;

        if (!searchQuery || typeof searchQuery !== 'string' || !searchQuery.trim()) {
            return HttpResponse.error(res, {
                message: USER_MESSAGES.SEARCH_QUERY_REQUIRED,
                statusCode: 400
            });
        }

        const searchResponse = await userService.searchUsers(searchQuery.trim(), roleCode, userId, req.roleId);
        if (!searchResponse.success) {
            return HttpResponse.error(res, {
                message: searchResponse.message,
                data: searchResponse.data,
                statusCode: searchResponse.statusCode
            });
        }

        return HttpResponse.success(res, {
            message: searchResponse.message,
            data: searchResponse.data,
            statusCode: searchResponse.statusCode
        });
    } catch (error) {
        console.error(error);
        errorLogger.error(error);
        return HttpResponse.error(res, { message: USER_MESSAGES.SEARCH_FAILED, statusCode: 500 });
    }
};

const getUserRoleDetails = async (req, res, next) => {
    try {
        const userId = req.query.userId;
        const companyId = req.query.companyId;
        const roleId = parseInt(req.query.roleId, 10);

        if (!req.query.userId || !isValidUUID(userId)) {
            return HttpResponse.error(res, {
                message: USER_MESSAGES.USER_ID_REQUIRED,
                statusCode: 400
            });
        }

        if (!req.query.companyId || !isValidUUID(companyId)) {
            return HttpResponse.error(res, {
                message: USER_MESSAGES.COMPANY_ID_REQUIRED,
                statusCode: 400
            });
        }

        if (!req.query.roleId || isNaN(roleId) || roleId <= 0) {
            return HttpResponse.error(res, {
                message: USER_MESSAGES.ROLE_ID_REQUIRED,
                statusCode: 400
            });
        }

        const roleDetailsResponse = await userService.getViewedUserProfile({
            companyId,
            userId,
            roleId,
            viewerUserId: req.userId,
            viewerRoleId: req.roleId
        });
        if (!roleDetailsResponse.success) {
            return HttpResponse.error(res, {
                message: roleDetailsResponse.message,
                data: roleDetailsResponse.data,
                statusCode: roleDetailsResponse.statusCode
            });
        }

        return HttpResponse.success(res, {
            message: roleDetailsResponse.message,
            data: roleDetailsResponse.data,
            statusCode: roleDetailsResponse.statusCode
        });
    } catch (error) {
        console.error(error);
        errorLogger.error(error);
        return HttpResponse.error(res, { message: USER_MESSAGES.ROLE_DETAILS_FAILED, statusCode: 500 });
    }
};

module.exports = { createUserProfile, getUserProfile, updateUserProfile, searchUsers, getUserRoleDetails };
