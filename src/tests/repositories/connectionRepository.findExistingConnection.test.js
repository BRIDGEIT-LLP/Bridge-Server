'use strict';

const { Op } = require('sequelize');

jest.mock('../../models', () => ({
    UserConnection: { findOne: jest.fn(), update: jest.fn(), create: jest.fn() },
    CompanyUserRole: {},
    CompanyRoleMaster: {},
    sequelize: { query: jest.fn() }
}));

const { UserConnection } = require('../../models');
const connectionRepository = require('../../repositories/connectionRepository');
const { CONNECTION_BLOCKING_STATUSES, CONNECTION_REOPENABLE_STATUSES } = require('../../utils/constant');

describe('connectionRepository.findExistingConnection', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        UserConnection.findOne.mockResolvedValue(null);
    });

    test('only matches live connections in blocking statuses', async () => {
        await connectionRepository.findExistingConnection('user-a', 1, 'user-b', 2);

        expect(UserConnection.findOne).toHaveBeenCalledWith({
            where: expect.objectContaining({
                is_deleted: false,
                status: { [Op.in]: CONNECTION_BLOCKING_STATUSES }
            })
        });
        expect(CONNECTION_BLOCKING_STATUSES).toEqual(['Pending', 'Viewed', 'Accepted', 'Deferred']);
        expect(CONNECTION_BLOCKING_STATUSES).not.toEqual(expect.arrayContaining(['Declined', 'Withdrawn']));
    });
});

describe('connectionRepository.softDeleteReopenableConnections', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        UserConnection.update.mockResolvedValue([1]);
    });

    test('soft-deletes only Declined, Withdrawn, and Expired rows for the same pair', async () => {
        const transaction = { id: 'txn-1' };

        await connectionRepository.softDeleteReopenableConnections(
            'user-a', 1, 'user-b', 2, 'user-a', { transaction }
        );

        expect(UserConnection.update).toHaveBeenCalledWith(
            expect.objectContaining({
                is_deleted: true,
                deleted_by: 'user-a'
            }),
            expect.objectContaining({
                transaction,
                where: expect.objectContaining({
                    is_deleted: false,
                    status: { [Op.in]: CONNECTION_REOPENABLE_STATUSES },
                    requester_user_id: 'user-a',
                    requester_role_id: 1,
                    recipient_user_id: 'user-b',
                    recipient_role_id: 2
                })
            })
        );
        expect(CONNECTION_REOPENABLE_STATUSES).toEqual(['Declined', 'Withdrawn', 'Expired']);
    });
});
