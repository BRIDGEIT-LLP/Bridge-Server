const twilio = require("twilio");
const sgMail = require("@sendgrid/mail");

const smsClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

const sgMailClient = sgMail.setApiKey(process.env.TWILIO_EMAIL_API_KEY);

module.exports = { smsClient, sgMailClient };