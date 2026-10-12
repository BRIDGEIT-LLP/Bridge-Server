'use strict';

jest.mock('../../configs/logger', () => ({ errorLogger: { error: jest.fn() } }));
jest.mock('../../services/s3.service', () => ({
    uploadToBucket: jest.fn(),
    getFileBuffer: jest.fn(),
    getFileUrl: jest.fn()
}));
jest.mock('../../services/scan.service', () => ({ scanUploadedFile: jest.fn() }));
jest.mock('../../services/watermark.service', () => ({}));
jest.mock('../../services/kycService', () => ({}));
jest.mock('../../utils/encryption', () => ({ encrypt: jest.fn(), decrypt: jest.fn() }));
jest.mock('../../utils/Helper', () => ({
    waterMarkFunction: jest.fn(),
    isValidUUID: (v) => /^[0-9a-f-]{36}$/i.test(String(v))
}));
jest.mock('../../repositories/userRepository', () => ({
    getUserById: jest.fn(),
    getUserCompanyRole: jest.fn()
}));

const { getFileUrl, uploadToBucket } = require('../../services/s3.service');
const { scanUploadedFile } = require('../../services/scan.service');
const userRepository = require('../../repositories/userRepository');
const { getIntroVideoUrl, scanFile } = require('../../controllers/fileController');

const OWNER = '11111111-1111-1111-1111-111111111111';
const OWNER_CO = '22222222-2222-2222-2222-222222222222';
const VIEWER = '33333333-3333-3333-3333-333333333333';
const KEY = `company/${OWNER_CO}/${OWNER}/intro-video/1-a.mp4`;

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    return res;
};

describe('getIntroVideoUrl', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns a signed URL for the owner without any query ids', async () => {
        userRepository.getUserById.mockResolvedValue({ intro_video: KEY });
        getFileUrl.mockResolvedValue('https://signed');
        const res = mockRes();
        await getIntroVideoUrl({ query: {}, userId: OWNER, companyId: OWNER_CO, roleId: 1, role: 'STARTUP' }, res);
        expect(getFileUrl).toHaveBeenCalledWith(KEY);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('allows a connectable role pair', async () => {
        userRepository.getUserById.mockResolvedValue({ intro_video: KEY });
        userRepository.getUserCompanyRole.mockResolvedValue({ role_code: 'INVESTOR' });
        getFileUrl.mockResolvedValue('https://signed');
        const res = mockRes();
        await getIntroVideoUrl({
            query: { userId: OWNER, companyId: OWNER_CO, roleId: '2' },
            userId: VIEWER, companyId: 'x', roleId: 1, role: 'STARTUP'
        }, res);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('rejects a non-connectable role pair with 403', async () => {
        userRepository.getUserById.mockResolvedValue({ intro_video: KEY });
        userRepository.getUserCompanyRole.mockResolvedValue({ role_code: 'INVESTOR' });
        const res = mockRes();
        await getIntroVideoUrl({
            query: { userId: OWNER, companyId: OWNER_CO, roleId: '2' },
            userId: VIEWER, companyId: 'x', roleId: 3, role: 'INVESTOR'
        }, res);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(getFileUrl).not.toHaveBeenCalled();
    });

    it('returns 404 when the user has no video', async () => {
        userRepository.getUserById.mockResolvedValue({ intro_video: null });
        const res = mockRes();
        await getIntroVideoUrl({ query: {}, userId: OWNER, companyId: OWNER_CO, roleId: 1, role: 'STARTUP' }, res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 404 when the stored key is outside the owner folder', async () => {
        userRepository.getUserById.mockResolvedValue({ intro_video: 'company/other/other/intro-video/x.mp4' });
        const res = mockRes();
        await getIntroVideoUrl({ query: {}, userId: OWNER, companyId: OWNER_CO, roleId: 1, role: 'STARTUP' }, res);
        expect(res.status).toHaveBeenCalledWith(404);
    });
});

describe('scanFile for videos', () => {
    beforeEach(() => jest.clearAllMocks());

    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(16)]);

    it('stores a valid video under the user\'s intro-video folder', async () => {
        scanUploadedFile.mockResolvedValue({ success: true });
        uploadToBucket.mockImplementation(async (a, b, c, d, e, f, key) => key);
        const res = mockRes();
        await scanFile({
            userId: OWNER, companyId: OWNER_CO, companyName: 'Co', roleId: 1,
            body: { docType: 'INTRO_VIDEO' },
            file: { buffer: mp4, originalname: 'a.mp4', mimetype: 'video/mp4', size: mp4.length }
        }, res, jest.fn());
        const key = uploadToBucket.mock.calls[0][6];
        expect(key.startsWith(`company/${OWNER_CO}/${OWNER}/intro-video/`)).toBe(true);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it('rejects a file whose bytes are not a video, before scanning', async () => {
        const res = mockRes();
        await scanFile({
            userId: OWNER, companyId: OWNER_CO, companyName: 'Co', roleId: 1,
            body: { docType: 'INTRO_VIDEO' },
            file: { buffer: Buffer.from('not a video at all, just text'), originalname: 'a.mp4', mimetype: 'video/mp4', size: 30 }
        }, res, jest.fn());
        expect(res.status).toHaveBeenCalledWith(400);
        expect(scanUploadedFile).not.toHaveBeenCalled();
    });
});
