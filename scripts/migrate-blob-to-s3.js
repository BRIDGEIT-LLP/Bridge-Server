'use strict';

/**
 * One-off migration: copies every blob in the Azure container to the S3 bucket,
 * keeping the object key identical to the blob name (the DB stores only the key).
 *
 * Usage (from Bridge-Server/):
 *   node scripts/migrate-blob-to-s3.js [--dry-run] [--prefix=company/] [--overwrite] [--concurrency=5]
 *
 * - Read-only on Azure; never deletes anything.
 * - Idempotent: objects already in S3 with the same size are skipped (unless --overwrite).
 * - Needs AZURE_STORAGE_CONNECTION_STRING, AZURE_CONTAINER_NAME, AWS_REGION,
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET in .env.
 */

require('dotenv').config();

const { PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { s3 } = require('../src/configs/aws');
const { blobClient } = require('../src/configs/azureBlob');

const args = process.argv.slice(2);
const getArg = (name) => {
    const hit = args.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.split('=').slice(1).join('=') : undefined;
};

const DRY_RUN = args.includes('--dry-run');
const OVERWRITE = args.includes('--overwrite');
const PREFIX = getArg('prefix') || '';
const CONCURRENCY = Math.max(1, parseInt(getArg('concurrency'), 10) || 5);
const BUCKET = process.env.AWS_S3_BUCKET;

const stats = { scanned: 0, copied: 0, skipped: 0, failed: 0, bytes: 0 };
const failures = [];

async function existsInS3(key, size) {
    try {
        const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
        return head.ContentLength === size;
    } catch (error) {
        if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
            return false;
        }
        throw error;
    }
}

async function migrateBlob(blob) {
    const key = blob.name;
    const size = blob.properties.contentLength;

    if (!OVERWRITE && await existsInS3(key, size)) {
        stats.skipped++;
        return;
    }

    if (DRY_RUN) {
        console.info(`[dry-run] would copy ${key} (${size} bytes)`);
        stats.copied++;
        stats.bytes += size;
        return;
    }

    const buffer = await blobClient.getBlockBlobClient(key).downloadToBuffer();

    await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: blob.properties.contentType || 'application/octet-stream'
    }));

    stats.copied++;
    stats.bytes += size;
    console.info(`copied ${key} (${size} bytes)`);
}

async function run() {
    const missing = ['AZURE_STORAGE_CONNECTION_STRING', 'AZURE_CONTAINER_NAME', 'AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_S3_BUCKET']
        .filter((name) => !process.env[name]);
    if (missing.length) {
        console.error(`Missing env vars: ${missing.join(', ')}`);
        process.exit(1);
    }

    console.info(`Migrating Azure container "${process.env.AZURE_CONTAINER_NAME}" -> s3://${BUCKET}/${PREFIX}`);
    console.info(`dry-run=${DRY_RUN} overwrite=${OVERWRITE} concurrency=${CONCURRENCY}`);

    const inFlight = new Set();

    for await (const blob of blobClient.listBlobsFlat({ prefix: PREFIX })) {
        stats.scanned++;

        const task = migrateBlob(blob)
            .catch((error) => {
                stats.failed++;
                failures.push({ key: blob.name, error: error.message });
                console.error(`FAILED ${blob.name}: ${error.message}`);
            })
            .finally(() => inFlight.delete(task));
        inFlight.add(task);

        if (inFlight.size >= CONCURRENCY) {
            await Promise.race(inFlight);
        }
    }

    await Promise.all(inFlight);

    console.info('---- Summary ----');
    console.info(`scanned: ${stats.scanned}`);
    console.info(`${DRY_RUN ? 'would copy' : 'copied'}: ${stats.copied} (${(stats.bytes / 1024 / 1024).toFixed(2)} MB)`);
    console.info(`skipped (already in S3): ${stats.skipped}`);
    console.info(`failed: ${stats.failed}`);
    if (failures.length) {
        console.error('Failed keys:');
        failures.forEach((f) => console.error(`  ${f.key} -> ${f.error}`));
        process.exit(1);
    }
}

run().catch((error) => {
    console.error('Migration aborted:', error.message);
    process.exit(1);
});
