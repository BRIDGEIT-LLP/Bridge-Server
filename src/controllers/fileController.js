const { errorLogger } = require("../configs/logger");
const { uploadToBucket, getFileBuffer, getFileUrl } = require("../services/s3.service");
const { scanUploadedFile } = require("../services/scan.service");
const { addPdfWatermark, addImageWatermark, docxToWatermarkedHtml, excelToWatermarkedHtml, pptToWatermarkedHtml } = require("../services/watermark.service");
const kycService = require('../services/kycService');
const { S3_FILE_TYPE, KYC_DOC_TYPES, DEFAULT_KYC_VERIFICATION_APPROVAL_TIME, KYC_STATUS } = require("../utils/constant");
const { waterMarkFunction } = require("../utils/Helper");
const HttpResponse = require("../utils/HttpResponse");
const { encrypt, decrypt } = require("../utils/encryption");
const userRepository = require("../repositories/userRepository");
const { canConnect } = require("../matching/eligibilityService");
const { isValidUUID } = require("../utils/Helper");

// Container signatures for the accepted intro-video formats. The multipart mimetype
// is client-supplied, so confirm the bytes really are mp4/mov (ISO BMFF "ftyp") or webm (EBML).
const isVideoBuffer = (buffer) => {
    if (!buffer || buffer.length < 12) return false;
    const isIsoBmff = buffer.slice(4, 8).toString("ascii") === "ftyp";
    const isWebm = buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
    return isIsoBmff || isWebm;
};

// POST /api/v1/file/scan-img & /scan-document
const scanFile = async (req, res, next) => {
    try {
        const userId = req.userId;
        const companyId = req.companyId;
        const companyName = req.companyName;
        const roleId = req.roleId;

        const payload = req.body;
        const docType = payload.docType;
        let side = payload.side || "front";

        if (!req.file) {
            return HttpResponse.error(res, {
                message: "File is required",
                statusCode: 400
            });
        }

        // req.file.buffer
        const fileBuffer = req.file.buffer;

        const isVideo = req.file.mimetype.startsWith("video/");
        if (isVideo && !isVideoBuffer(fileBuffer)) {
            return HttpResponse.error(res, {
                message: "File is not a valid video",
                statusCode: 400
            });
        }
        // Virus Scan
        const scanResult = await scanUploadedFile(fileBuffer);
        if (!scanResult.success) {
            return HttpResponse.error(res, {
                message: scanResult.message,
                statusCode: 400
            });
        }

        let s3_file_type = S3_FILE_TYPE.PROFILE
        if (isVideo) {
            // The folder comes from the file itself, not the client-supplied docType.
            s3_file_type = S3_FILE_TYPE.INTRO_VIDEO
        } else if (KYC_DOC_TYPES.includes(docType)) {
            s3_file_type = S3_FILE_TYPE.KYC
        }

        // Upload to Bucket
        const s3KeyToUpload = `company/${companyId}/${userId}/${s3_file_type}/${Date.now()}-${req.file.originalname}`;
        const s3Key = await uploadToBucket(
            s3_file_type,
            fileBuffer,
            req.file.originalname,
            req.file.mimetype,
            companyName,
            userId,
            s3KeyToUpload
        )
        // console.log("s3Key", s3Key)

        return HttpResponse.success(res, {
            message: "File uploaded successfully",
            data: { 
                fileName: req.file.originalname,
                fileSize: req.file.size,
                mimeType: req.file.mimetype,
                s3Key: s3Key,
                side: side,
                docType: docType
            },
            statusCode: 200
        });

    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: "File upload failed",
            statusCode: 500
        });
    }
}

//  /api/v1/file/file-preview
const filePreview = async (req, res) => {
    try {
        // get key from query
        const { key: s3Key, download } = req.query;
        const userId = req.userId;
        const companyId = req.companyId;
        const companyName = req.companyName;

        if (!s3Key) {
            return HttpResponse.error(res, {
                message: "File key is required",
                statusCode: 400
            });
        }

        // Intro videos are served only through GET /file/video-url (viewer-eligibility checked).
        if (s3Key.includes(`/${S3_FILE_TYPE.INTRO_VIDEO}/`)) {
            return HttpResponse.error(res, {
                message: "Use the video endpoint to view this file",
                statusCode: 403
            });
        }

        const isProfileImage = s3Key.includes(`/${S3_FILE_TYPE.PROFILE}/`);

        let fileBuffer;
        try {
            fileBuffer = await getFileBuffer(s3Key);
        } catch (error) {
            if (!isProfileImage) throw error;
            return res.status(204).end();
        }

        const ext = s3Key.split('.').pop().toLowerCase();

        const mimeTypes = {
            'pdf': 'application/pdf',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'svg': 'image/svg+xml',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'doc': 'application/msword',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'xls': 'application/vnd.ms-excel',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'ppt': 'application/vnd.ms-powerpoint'
        };

        const wantOriginal = String(download) === "1" || String(download).toLowerCase() === "true";
        const officeExts = ["docx", "doc", "xlsx", "xls", "pptx", "ppt"];
        const originalName = (String(s3Key).split("/").pop() || "download").replace(/^\d+-/, "");

        let contentType = mimeTypes[ext] || 'application/octet-stream';

        // Stamping the viewer's company/user across an avatar would make it unreadable.
        if (isProfileImage) {
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', 'inline');
            return res.send(fileBuffer);
        }

        const safeName = originalName.replace(/["\r\n]/g, "_");

        // Preview converts Office files to HTML; download must return the stored
        // .docx / .xlsx bytes (same idea as downloading a PDF/image as that format).
        if (wantOriginal && officeExts.includes(ext)) {
            res.setHeader("Content-Type", contentType);
            res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
            return res.send(fileBuffer);
        }

        const watermarkText = await waterMarkFunction(companyName, userId);

        let processedBuffer;
        if (ext === 'pdf') {
            processedBuffer = await addPdfWatermark(fileBuffer, watermarkText);
        } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
            processedBuffer = await addImageWatermark(
                fileBuffer,
                watermarkText
            );
        } else if (ext === 'docx') {
            // Browsers cannot render .docx bytes. Convert to watermarked HTML so the
            // deal-room preview modal can iframe it the same way it does PDFs.
            try {
                processedBuffer = await docxToWatermarkedHtml(fileBuffer, watermarkText);
                contentType = 'text/html; charset=utf-8';
            } catch {
                processedBuffer = fileBuffer;
            }
        } else if (ext === 'xlsx' || ext === 'xls') {
            try {
                processedBuffer = await excelToWatermarkedHtml(fileBuffer, watermarkText);
                contentType = 'text/html; charset=utf-8';
            } catch {
                processedBuffer = fileBuffer;
            }
        } else if (ext === 'pptx' || ext === 'ppt') {
            try {
                processedBuffer = await pptToWatermarkedHtml(fileBuffer, watermarkText);
                contentType = 'text/html; charset=utf-8';
            } catch {
                processedBuffer = fileBuffer;
            }
        } else {
            processedBuffer = fileBuffer;
        }

        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Disposition", "inline");

        return res.send(processedBuffer)
 
    } catch (error) {
        return HttpResponse.error(res, error);
    }
};

// GET /api/v1/file/video-url[?userId=&companyId=&roleId=]
// Signed, short-lived URL for a user's intro video. Allowed for the owner, or for a viewer
// whose role may connect with the owner's role (same rule as search / connection requests).
const getIntroVideoUrl = async (req, res) => {
    try {
        // No ids in the query = the caller's own video.
        const targetUserId = req.query.userId || req.userId;
        const targetCompanyId = req.query.companyId || req.companyId;
        const targetRoleId = parseInt(req.query.roleId || req.roleId, 10);

        if (!isValidUUID(targetUserId) || !isValidUUID(targetCompanyId) || isNaN(targetRoleId) || targetRoleId <= 0) {
            return HttpResponse.error(res, { message: "userId, companyId and roleId are required", statusCode: 400 });
        }

        const target = await userRepository.getUserById(targetUserId);
        const key = target && target.intro_video;
        if (!key) {
            return HttpResponse.error(res, { message: "No intro video found", statusCode: 404 });
        }

        // The key must live in the owner's own folder.
        const expectedPrefix = `company/${targetCompanyId}/${targetUserId}/${S3_FILE_TYPE.INTRO_VIDEO}/`;
        if (!key.startsWith(expectedPrefix)) {
            return HttpResponse.error(res, { message: "No intro video found", statusCode: 404 });
        }

        if (req.userId !== targetUserId) {
            const roleInfo = await userRepository.getUserCompanyRole(targetUserId, targetCompanyId, targetRoleId);
            if (!roleInfo || !canConnect(req.role, roleInfo.role_code)) {
                return HttpResponse.error(res, { message: "You are not allowed to view this video", statusCode: 403 });
            }
        }

        const url = await getFileUrl(key);
        return HttpResponse.success(res, {
            message: "Video URL generated",
            data: { url, expiresIn: 180 },
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, { message: "Failed to load video", statusCode: 500 });
    }
};

const saveKycInfo = async (req, res) => {
    try {
        const userId = req.userId;
        const companyId = req.companyId;
        const roleId = req.roleId;
        const payload = req.body;

        let data = []
        for(let documentKey in payload) {
            const docData = payload[documentKey]
            const number = docData.number
            const {encryptedData, iv, authTag} = encrypt(number)
            const frontData = docData.front
            const frontS3Key = frontData.s3_key
            const frontMimeType = frontData.mimetype
            const frontFile_name = frontData.file_name
            const frontFileSize = frontData.file_size
            let docDataToStore = {
                user_id: userId,
                company_id: companyId,
                role_id: roleId,
                document_type: documentKey,
                document_number: encryptedData,
                document_number_iv: iv,
                document_number_auth_tag: authTag,
                status: KYC_STATUS.PENDING,
                front_s3_key: frontS3Key,
                front_file_name: frontFile_name,
                front_file_size: frontFileSize,
                front_mime_type: frontMimeType
            }
            if ('back' in docData) {
                const backData = docData.back
                const backS3Key = backData.s3_key
                const backMimeType = backData.mimetype
                const backtFile_name = backData.file_name
                const backFileSize = backData.file_size
                docDataToStore = {
                    ...docDataToStore,
                    back_s3_key: backS3Key,
                    back_file_name: backtFile_name,
                    back_file_size: backFileSize,
                    back_mime_type: backMimeType
                }
            } 
            data.push(docDataToStore)
        }

        const result = await kycService.createKycInfo(data);
        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        const s3Key = result.data.records[0].front_s3_key;

        return HttpResponse.success(res, {
            message: "File uploaded successfully",
            statusCode: 200
        });

    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: "File upload failed",
            statusCode: 500
        });
    }
}

// GET /api/v1/file/get-kyc-docs
const getKycDocs = async (req, res) => {
    try {
        const userId = req.userId;
        const companyId = req.companyId;
        const roleId = req.roleId;

        const getKycInfoServiceRes = await kycService.getKycInfo({ userId, companyId, roleId });
        if (!getKycInfoServiceRes.success) {
            return HttpResponse.error(res, { message: getKycInfoServiceRes.message, statusCode: getKycInfoServiceRes.statusCode });
        }

        const { records: kycInfo, kycStatus, rejectionReason } = getKycInfoServiceRes.data;

        const decrypedRecords = kycInfo.map(record => {
            
            if (record.document_number && record.document_number_iv && record.document_number_auth_tag) {
                record.document_number = decrypt(record.document_number, record.document_number_iv, record.document_number_auth_tag);
            }
            delete record.document_number_iv;
            delete record.document_number_auth_tag;
            return record;
        });

        const prepareRes = kycService.prepareResponse(decrypedRecords);
        if (!prepareRes.success) {
            return HttpResponse.error(res, { message: prepareRes.message, statusCode: prepareRes.statusCode });
        }
        const preparedRes = prepareRes.data;

        let submissionTime = null;
        let expiryTime = null;

        if (decrypedRecords.length > 0) {
            const maxCreatedAt = decrypedRecords.reduce((max, r) => {
                const t = new Date(r.created_at);
                return t > max ? t : max;
            }, new Date(0));
            submissionTime = maxCreatedAt.toISOString();
            expiryTime = new Date(maxCreatedAt.getTime() + DEFAULT_KYC_VERIFICATION_APPROVAL_TIME * 60 * 60 * 1000).toISOString();
        }

        return HttpResponse.success(res, {
            message: getKycInfoServiceRes.message,
            data: { docDetails: preparedRes, submissionTime: submissionTime, expiryTime: expiryTime, kycStatus, rejectionReason },
            statusCode: 200
        });

    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: "Failed to fetch KYC documents",
            statusCode: 500
        });
    }
};

module.exports = { scanFile, filePreview, saveKycInfo, getKycDocs, getIntroVideoUrl }