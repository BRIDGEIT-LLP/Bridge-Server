const multer = require("multer");
const NodeClam = require("clamscan");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");

let scanner;
async function initScanner() {
    if (scanner) {
        return scanner;
    }

    scanner = await new NodeClam().init({
        clamdscan: {
            host: process.env.CLAMAV_HOST,
            port: process.env.CLAMAV_PORT
        }
    });

    return scanner;
}

const picUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
            "image/png",
            "image/jpeg"
        ];

        if (allowedMimeTypes.includes(file.mimetype)) {
            return cb(null, true);
        }
        return cb(
            new Error("Only PNG and JPEG images are allowed"),
            false
        );
    }
});

const fileUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 20 * 1024 * 1024 // 20MB — the largest PDF we accept (pitch deck)
    },
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
            "application/pdf",
        ];

        if (allowedMimeTypes.includes(file.mimetype)) {
            return cb(null, true);
        }
        return cb(
            new Error("Only PDF files are allowed"),
            false
        );
    }
});

const INTRO_VIDEO_MAX_BYTES = 30 * 1024 * 1024; // 30MB

const videoUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: INTRO_VIDEO_MAX_BYTES
    },
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
            "video/mp4",
            "video/webm",
            "video/quicktime"
        ];

        if (allowedMimeTypes.includes(file.mimetype)) {
            return cb(null, true);
        }
        return cb(
            new Error("Only MP4, WebM and MOV videos are allowed"),
            false
        );
    }
});

// mimetype -> { messageType, maxSize } for the single chat media upload endpoint.
// multer enforces one blanket fileSize ceiling (the max across all types below);
// chatService re-checks the per-type max after upload so an image can't sneak in at video-sized limits.
const CHAT_MEDIA_RULES = {
    "image/png": { messageType: "IMAGE", maxSize: 10 * 1024 * 1024 },
    "image/jpeg": { messageType: "IMAGE", maxSize: 10 * 1024 * 1024 },
    "image/webp": { messageType: "IMAGE", maxSize: 10 * 1024 * 1024 },
    "image/gif": { messageType: "IMAGE", maxSize: 10 * 1024 * 1024 },
    "application/pdf": { messageType: "DOCUMENT", maxSize: 25 * 1024 * 1024 },
    "application/msword": { messageType: "DOCUMENT", maxSize: 25 * 1024 * 1024 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { messageType: "DOCUMENT", maxSize: 25 * 1024 * 1024 },
    "application/vnd.ms-excel": { messageType: "DOCUMENT", maxSize: 25 * 1024 * 1024 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { messageType: "DOCUMENT", maxSize: 25 * 1024 * 1024 },
    "application/vnd.ms-powerpoint": { messageType: "DOCUMENT", maxSize: 25 * 1024 * 1024 },
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": { messageType: "DOCUMENT", maxSize: 25 * 1024 * 1024 },
    "text/csv": { messageType: "DOCUMENT", maxSize: 25 * 1024 * 1024 },
    "text/plain": { messageType: "DOCUMENT", maxSize: 25 * 1024 * 1024 },
    "audio/mpeg": { messageType: "AUDIO", maxSize: 25 * 1024 * 1024 },
    "audio/mp4": { messageType: "AUDIO", maxSize: 25 * 1024 * 1024 },
    "audio/wav": { messageType: "AUDIO", maxSize: 25 * 1024 * 1024 },
    "audio/ogg": { messageType: "AUDIO", maxSize: 25 * 1024 * 1024 },
    "video/mp4": { messageType: "VIDEO", maxSize: 100 * 1024 * 1024 },
    "video/webm": { messageType: "VIDEO", maxSize: 100 * 1024 * 1024 },
    "video/quicktime": { messageType: "VIDEO", maxSize: 100 * 1024 * 1024 }
};

const chatMediaUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024 // blanket ceiling; per-type limits enforced in chatService via CHAT_MEDIA_RULES
    },
    fileFilter: (req, file, cb) => {
        if (CHAT_MEDIA_RULES[file.mimetype]) {
            return cb(null, true);
        }
        return cb(
            new Error("Unsupported media type"),
            false
        );
    }
});

async function scanBuffer(buffer) {
    const clam = await initScanner();
    const tempFilePath = path.join(
        os.tmpdir(),
        `scan-${Date.now()}`
    );

    try {
        await fs.writeFile(
            tempFilePath,
            buffer
        );
        const result = await clam.isInfected(tempFilePath);
        return result;
    } finally {
        await fs.unlink(
            tempFilePath
        ).catch(() => {});
    }
}

module.exports = {
    picUpload,
    fileUpload,
    videoUpload,
    INTRO_VIDEO_MAX_BYTES,
    chatMediaUpload,
    CHAT_MEDIA_RULES,
    scanBuffer
};