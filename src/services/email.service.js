const { SendEmailCommand } = require('@aws-sdk/client-ses');
const { sesClient } = require('../configs/ses.js');

const { EMAIL_PROVIDERS, DEFAULT_EMAIL_PROVIDER, DEFAULT_EMAIL_FROM_NAME } = require('../utils/constant.js');

const sendViaSes = async ({ from, to, subject, text, html, fromName }) => {
    const source = from;

    const command = new SendEmailCommand({
        Source: source,
        Destination: { ToAddresses: to },
        Message: {
            Subject: { Data: subject, Charset: 'UTF-8' },
            Body: {
                ...(text && { Text: { Data: text, Charset: 'UTF-8' } }),
                ...(html && { Html: { Data: html, Charset: 'UTF-8' } })
            }
        }
    });

    const result = await sesClient.send(command);
    return result.MessageId;
};

const sendViaTwilio = async ({ from, to, subject, text, html, fromName }) => {
    const { sgMailClient } = require('../configs/twilio.js');

    await sgMailClient.send({
        to,
        from: { name: fromName, email: from },
        subject,
        ...(text && { text }),
        ...(html && { html })
    });
};

const PROVIDER_HANDLERS = {
    [EMAIL_PROVIDERS.SES]: sendViaSes,
    [EMAIL_PROVIDERS.TWILIO]: sendViaTwilio
};


const sendEmail = async ({ from, to, subject, text, html, fromName = DEFAULT_EMAIL_FROM_NAME, provider }) => {
    const providerName = (provider || process.env.EMAIL_PROVIDER || DEFAULT_EMAIL_PROVIDER).toLowerCase();
    const handler = PROVIDER_HANDLERS[providerName];

    if (!handler) {
        throw new Error(`Unsupported email provider: ${providerName}`);
    }
    if (!to || (Array.isArray(to) && !to.length)) {
        throw new Error('Email recipient is required');
    }
    if (!subject || (!text && !html)) {
        throw new Error('Email subject and a body (text or html) are required');
    }

    const recipients = Array.isArray(to) ? to : [to];
    return handler({ from, to: recipients, subject, text, html, fromName });
};

module.exports = { sendEmail, EMAIL_PROVIDERS };
