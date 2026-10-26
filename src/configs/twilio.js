const twilio = require("twilio");
const sgMail = require("@sendgrid/mail");

const smsClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// setApiKey() returns undefined, so export the configured sgMail instance itself
sgMail.setApiKey(process.env.TWILIO_EMAIL_API_KEY);
const sgMailClient = sgMail;

module.exports = { smsClient, sgMailClient };