'use strict';

const archiver = require('archiver');
const { errorLogger } = require('../configs/logger');
const dealRoomExportService = require('../services/dealRoomExportService');
const { CHAT_MESSAGES } = require('../utils/constant');
const HttpResponse = require('../utils/HttpResponse');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const parseDealRoomId = (req, res) => {
    const { dealRoomId } = req.params;
    if (!UUID_REGEX.test(dealRoomId)) {
        HttpResponse.error(res, { message: 'dealRoomId must be a valid UUID', statusCode: 400 });
        return null;
    }
    return dealRoomId;
};

const exportDealRoom = async (req, res) => {
    try {
        const dealRoomId = parseDealRoomId(req, res);
        if (!dealRoomId) return;

        const { userId } = req;

        const authResult = await dealRoomExportService.authorizeExport(dealRoomId, userId);
        if (!authResult.success) {
            return HttpResponse.error(res, { message: authResult.message, statusCode: authResult.statusCode });
        }

        const zipName = `deal-room-${dealRoomId}-export-${Date.now()}.zip`;
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.on('error', (error) => {
            errorLogger.error(error);
            res.destroy(error);
        });
        archive.pipe(res);

        await dealRoomExportService.streamExport(authResult.data.dealRoom, archive);
    } catch (error) {
        errorLogger.error(error);
        console.log(error)
        if (!res.headersSent) {
            return HttpResponse.error(res, { message: CHAT_MESSAGES.EXPORT_FAILED, statusCode: 500 });
        }
        res.destroy(error);
    }
};

module.exports = { exportDealRoom };
