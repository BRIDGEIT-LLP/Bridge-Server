const { scanBuffer } = require("../configs/scan");
const env_config = require("../configs/env_configs");
const ServiceResponse = require("../utils/ServiceResponse");
const { errorLogger } = require("../configs/logger");

const scanUploadedFile = async (buffer) => {
    // if (env_config.SKIP_VIRUS_SCAN) {
    //     return ServiceResponse.success({ success: true });
    // }

    try {
        // Virus Scan
        const result = await scanBuffer(buffer);
        if (result.isInfected) {
            return ServiceResponse.error({
                success: false,
                message: "File is infected with a virus",
                viruses: result.viruses || [],
            });
        }

        return ServiceResponse.success({
            success: true
        });
    } catch (err) {
        console.log(new Date().toISOString(), err);
        errorLogger.error(err);
        return ServiceResponse.error({
            success: false,
            message: "File scan failed",
        });
    }
};

module.exports = {
    scanUploadedFile
}