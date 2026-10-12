// Azure Blob storage is no longer used (S3 is the storage backend). Retained as comments.
// Uncomment this file (and the matching lines in services/s3.service.js) to use Blob again.
// scripts/migrate-blob-to-s3.js also depends on this file.

// const { BlobServiceClient } = require("@azure/storage-blob");
//
// const blobServiceClient = BlobServiceClient.fromConnectionString(
//     process.env.AZURE_STORAGE_CONNECTION_STRING
// );
//
// const containerName = process.env.AZURE_CONTAINER_NAME;
// const blobClient = blobServiceClient.getContainerClient(containerName);
//
//
// module.exports = { blobClient };
