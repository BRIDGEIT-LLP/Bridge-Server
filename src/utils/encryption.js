const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";

const KEY = Buffer.from(
	process.env.ENCRYPTION_KEY,
	"hex"
);

function encrypt(text) {
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv(
		ALGORITHM,
		KEY,
		iv
	);

	let encrypted = cipher.update(
		text,
		"utf8",
		"hex"
	);

	encrypted += cipher.final("hex");
	const authTag = cipher.getAuthTag();

	return {
		encryptedData: encrypted,
		iv: iv.toString("hex"),
		authTag: authTag.toString("hex")
	};
}

function decrypt(encryptedData, iv, authTag) {
	const decipher = crypto.createDecipheriv(
		ALGORITHM,
		KEY,
		Buffer.from(iv, "hex")
	);

	decipher.setAuthTag(
		Buffer.from(authTag, "hex")
	);

	let decrypted = decipher.update(
		encryptedData,
		"hex",
		"utf8"
	);

	decrypted += decipher.final("utf8");
	return decrypted;
}


module.exports = { encrypt, decrypt };