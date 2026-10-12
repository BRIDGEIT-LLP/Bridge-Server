'use strict';

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

const userRepository = require('../../repositories/userRepository');
const { getConnectionBillingWindow } = require('../../services/connectionService');

describe('getConnectionBillingWindow', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('anchors the window to user.created_at when there is no subscription start date', async () => {
        userRepository.getUserById.mockResolvedValue({
            created_at: new Date('2026-03-11T08:00:00Z')
        });

        const result = await getConnectionBillingWindow('user-1', null);

        expect(result.success).toBe(true);
        expect(userRepository.getUserById).toHaveBeenCalledWith('user-1');
        expect(result.data.windowStart.getDate()).toBe(11);
        const expectedEnd = new Date(result.data.windowStart);
        expectedEnd.setMonth(expectedEnd.getMonth() + 1);
        expect(result.data.windowEnd.getTime()).toBe(expectedEnd.getTime());
    });

    test('anchors the window to subscription start_date and does not load the user', async () => {
        const result = await getConnectionBillingWindow('user-1', new Date('2026-09-11T00:00:00'));

        expect(result.success).toBe(true);
        expect(userRepository.getUserById).not.toHaveBeenCalled();
        expect(result.data.windowStart.getDate()).toBe(11);
        expect(result.data.windowStart.getMonth()).toBe(8);
        const expectedEnd = new Date(result.data.windowStart);
        expectedEnd.setMonth(expectedEnd.getMonth() + 1);
        expect(result.data.windowEnd.getTime()).toBe(expectedEnd.getTime());
    });

    test('falls back to user.created_at when subscription start_date is invalid', async () => {
        userRepository.getUserById.mockResolvedValue({
            created_at: new Date('2026-03-11T08:00:00Z')
        });

        const result = await getConnectionBillingWindow('user-1', 'not-a-date');

        expect(result.success).toBe(true);
        expect(userRepository.getUserById).toHaveBeenCalledWith('user-1');
    });
});
