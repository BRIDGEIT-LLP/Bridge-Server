'use strict';

const mockTransaction = { commit: jest.fn(), rollback: jest.fn() };

jest.mock('../../models', () => ({
    sequelize: {
        query: jest.fn(),
        transaction: jest.fn(),
        authenticate: jest.fn().mockResolvedValue(true)
    },
    Sequelize: {}
}));

jest.mock('../../configs/logger', () => ({
    errorLogger: { error: jest.fn(), info: jest.fn() },
    accessLogger: { info: jest.fn() }
}));

jest.mock('../../repositories/connectionRepository', () => ({
    countRequestsInWindow: jest.fn(),
    findExistingConnection: jest.fn(),
    softDeleteReopenableConnections: jest.fn(),
    findRecipientCompanyUserRole: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    updateStatus: jest.fn(),
    findSentByUser: jest.fn(),
    findReceivedByUser: jest.fn()
}));

jest.mock('../../repositories/connectionStatusLogRepository', () => ({
    create: jest.fn()
}));

jest.mock('../../repositories/userRepository', () => ({
    getUserById: jest.fn()
}));

jest.mock('../../repositories/userLimitConfigRepository', () => ({
    findByUserId: jest.fn()
}));

jest.mock('../../services/dealRoomService', () => ({
    createDealRoom: jest.fn()
}));

jest.mock('../../services/adminConfigService', () => ({
    getTrialConfigValue: jest.fn()
}));

const { sequelize } = require('../../models');
const userRepository = require('../../repositories/userRepository');
const connectionRepository = require('../../repositories/connectionRepository');
const connectionStatusLogRepository = require('../../repositories/connectionStatusLogRepository');
const { sendRequest } = require('../../services/connectionService');
const { CONNECTION_MESSAGES, CONNECTION_STATUS } = require('../../utils/constant');

const requestPayload = {
    requesterUserId: 'user-a',
    requesterRoleId: 1,
    requesterCompanyId: 'company-a',
    requesterRoleCode: 'STARTUP',
    recipientUserId: 'user-b',
    recipientRoleId: 2,
    recipientCompanyId: 'company-b',
    personalMessage: 'Hello',
    bussinessIntent: ['SaaS'],
    expectedDealSize: '₹50L',
    productServiceDetails: null
};

describe('connectionService.sendRequest', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        sequelize.transaction.mockResolvedValue(mockTransaction);
        userRepository.getUserById.mockResolvedValue({ id: 'user-b' });
        connectionRepository.findRecipientCompanyUserRole.mockResolvedValue({
            company_id: 'company-b',
            role: { role_code: 'INVESTOR' }
        });
        connectionRepository.softDeleteReopenableConnections.mockResolvedValue([0]);
        connectionRepository.create.mockResolvedValue({ id: 99, status: CONNECTION_STATUS.PENDING });
        connectionStatusLogRepository.create.mockResolvedValue({});
    });

    test('returns 409 when a blocking connection already exists', async () => {
        connectionRepository.findExistingConnection.mockResolvedValue({ id: 1, status: CONNECTION_STATUS.PENDING });

        const result = await sendRequest(requestPayload);

        expect(result.success).toBe(false);
        expect(result.statusCode).toBe(409);
        expect(result.message).toBe(CONNECTION_MESSAGES.ALREADY_EXISTS);
        expect(connectionRepository.create).not.toHaveBeenCalled();
        expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    test('creates a new request after a prior Declined or Withdrawn connection', async () => {
        connectionRepository.findExistingConnection.mockResolvedValue(null);

        const result = await sendRequest(requestPayload);

        expect(result.success).toBe(true);
        expect(result.statusCode).toBe(201);
        expect(connectionRepository.softDeleteReopenableConnections).toHaveBeenCalledWith(
            'user-a', 1, 'user-b', 2, 'user-a', { transaction: mockTransaction }
        );
        expect(connectionRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({
                requester_user_id: 'user-a',
                recipient_user_id: 'user-b',
                status: CONNECTION_STATUS.PENDING
            }),
            { transaction: mockTransaction }
        );
        expect(mockTransaction.commit).toHaveBeenCalled();
    });

    test('returns 400 when the requester and recipient roles cannot connect', async () => {
        connectionRepository.findExistingConnection.mockResolvedValue(null);
        connectionRepository.findRecipientCompanyUserRole.mockResolvedValue({
            company_id: 'company-b',
            role: { role_code: 'STARTUP' }
        });

        const result = await sendRequest({ ...requestPayload, requesterRoleCode: 'STARTUP' });

        expect(result.success).toBe(false);
        expect(result.statusCode).toBe(400);
        expect(result.message).toBe(CONNECTION_MESSAGES.INVALID_ROLE_PAIR);
        expect(connectionRepository.create).not.toHaveBeenCalled();
        expect(mockTransaction.rollback).toHaveBeenCalled();
        expect(mockTransaction.commit).not.toHaveBeenCalled();
    });

    test('allows B2B → B2B', async () => {
        connectionRepository.findExistingConnection.mockResolvedValue(null);
        connectionRepository.findRecipientCompanyUserRole.mockResolvedValue({
            company_id: 'company-b',
            role: { role_code: 'B2B' }
        });

        const result = await sendRequest({ ...requestPayload, requesterRoleCode: 'B2B' });

        expect(result.success).toBe(true);
        expect(result.statusCode).toBe(201);
        expect(connectionRepository.create).toHaveBeenCalled();
        expect(mockTransaction.commit).toHaveBeenCalled();
    });

    test('allows STARTUP → B2B (same pair search can find)', async () => {
        connectionRepository.findExistingConnection.mockResolvedValue(null);
        connectionRepository.findRecipientCompanyUserRole.mockResolvedValue({
            company_id: 'company-b',
            role: { role_code: 'B2B' }
        });

        const result = await sendRequest({ ...requestPayload, requesterRoleCode: 'STARTUP' });

        expect(result.success).toBe(true);
        expect(result.statusCode).toBe(201);
        expect(connectionRepository.create).toHaveBeenCalled();
    });
});
