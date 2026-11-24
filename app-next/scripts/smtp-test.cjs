// Quick Zoho SMTP connectivity test. Run: node scripts/smtp-test.cjs
const nodemailer = require("nodemailer");
require("dotenv").config();

const hosts = [
  { host: "smtp.zoho.eu", port: 587, secure: false },
  { host: "smtp.zoho.com", port: 587, secure: false },
  { host: "smtppro.zoho.eu", port: 587, secure: false },
  { host: "smtp.zoho.eu", port: 465, secure: true },
  { host: "smtp.zoho.com", port: 465, secure: true },
];

(async () => {
  for (const cfg of hosts) {
    const label = `${cfg.host}:${cfg.port}${cfg.secure ? " (SSL)" : " (STARTTLS)"}`;
    process.stdout.write(`${label} … `);
    const t = nodemailer.createTransport({
      ...cfg,
      auth: { user: process.env.WUCO_SMTP_USER, pass: process.env.WUCO_SMTP_PASS },
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 8000,
    });
    try {
      await t.verify();
      console.log("OK");
    } catch (e) {
      console.log("FAIL:", e.code || e.message);
    }
  }
})();
