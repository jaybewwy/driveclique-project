const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const FROM = process.env.EMAIL_FROM || 'DriveClique <noreply@driveclique.app>';

/**
 * Returns a configured nodemailer transporter, or null if SMTP env vars are missing.
 * Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in your .env to enable emails.
 */
const getTransporter = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || '587', 10),
    secure: parseInt(SMTP_PORT || '587', 10) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
};

/**
 * Send an email via SMTP. Silently no-ops if SMTP is not configured.
 * @param {{ to: string, subject: string, html: string }} options
 */
const sendEmail = async ({ to, subject, html }) => {
  const transporter = getTransporter();
  if (!transporter) return;

  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
  } catch (err) {
    logger.error('Email send failed', { to, error: err.message });
  }
};

// ─── Template helpers ────────────────────────────────────────────────────────

const wrap = (body) => `
  <div style="font-family:sans-serif;max-width:560px;margin:auto;padding:24px;background:#1a1a1a;color:#e5e5e5;border-radius:12px">
    <h2 style="color:#e53e3e;margin-bottom:16px">DriveClique 🚗</h2>
    ${body}
    <hr style="border-color:#333;margin:24px 0"/>
    <p style="font-size:12px;color:#666">You're receiving this because you're a DriveClique member.</p>
  </div>`;

const emailTemplates = {
  driveScheduled: ({ driveName, clubName, date, location }) => ({
    subject: `New drive scheduled in ${clubName}`,
    html: wrap(`
      <p>A new drive has been scheduled in <strong>${clubName}</strong>:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px;color:#aaa">Drive</td><td style="padding:8px"><strong>${driveName}</strong></td></tr>
        <tr><td style="padding:8px;color:#aaa">Date</td><td style="padding:8px">${date}</td></tr>
        <tr><td style="padding:8px;color:#aaa">Location</td><td style="padding:8px">${location}</td></tr>
      </table>
      <p style="color:#aaa">Log in to RSVP!</p>`),
  }),

  driveCancelled: ({ driveName, clubName, reason }) => ({
    subject: `Drive cancelled in ${clubName}`,
    html: wrap(`
      <p>The drive <strong>${driveName}</strong> in <strong>${clubName}</strong> has been cancelled.</p>
      ${reason ? `<p style="color:#aaa">Reason: ${reason}</p>` : ''}`),
  }),

  joinRequestAccepted: ({ clubName }) => ({
    subject: `You've been accepted into ${clubName}!`,
    html: wrap(`<p>Your request to join <strong>${clubName}</strong> has been <span style="color:#48bb78">accepted</span>. Welcome!</p>`),
  }),

  joinRequestRejected: ({ clubName }) => ({
    subject: `Update on your request to join ${clubName}`,
    html: wrap(`<p>Your request to join <strong>${clubName}</strong> was not approved at this time.</p>`),
  }),

  joinRequestReceived: ({ username, clubName }) => ({
    subject: `New join request for ${clubName}`,
    html: wrap(`<p><strong>${username}</strong> has requested to join <strong>${clubName}</strong>. Log in to review the request.</p>`),
  }),

  emailVerification: ({ verifyUrl, username }) => ({
    subject: 'Verify your DriveClique email',
    html: wrap(`
      <p>Hi <strong>${username}</strong>,</p>
      <p>Welcome to DriveClique! Click the button below to verify your email address and unlock drive notifications.</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${verifyUrl}"
           style="background:#e53e3e;color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:600;font-size:16px;display:inline-block">
          Verify Email
        </a>
      </div>
      <p style="color:#aaa;font-size:13px">This link expires in <strong>24 hours</strong>. If you didn't create a DriveClique account, you can safely ignore this email.</p>
      <p style="color:#666;font-size:12px;word-break:break-all">Or paste this URL into your browser:<br/>${verifyUrl}</p>`),
  }),

  waitlistPromoted: ({ driveName, clubName, driveDate }) => ({
    subject: `You're in! A spot opened up for ${driveName}`,
    html: wrap(`
      <p>Good news — a spot just opened up and you've been automatically moved from the waitlist to <strong>confirmed going</strong>!</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px;color:#aaa">Drive</td><td style="padding:8px"><strong>${driveName}</strong></td></tr>
        <tr><td style="padding:8px;color:#aaa">Club</td><td style="padding:8px">${clubName}</td></tr>
        <tr><td style="padding:8px;color:#aaa">Date</td><td style="padding:8px">${driveDate}</td></tr>
      </table>
      <p style="color:#aaa">Log in to view the drive details and we'll see you there!</p>`),
  }),

  reportNotification: ({ reporterUsername, targetType, targetName, reason, details, clubName }) => ({
    subject: `New report in ${clubName}`,
    html: wrap(`
      <p>A member has submitted a content report in <strong>${clubName}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px;color:#aaa">Reported by</td><td style="padding:8px"><strong>@${reporterUsername}</strong></td></tr>
        <tr><td style="padding:8px;color:#aaa">Content type</td><td style="padding:8px">${targetType}</td></tr>
        <tr><td style="padding:8px;color:#aaa">Content</td><td style="padding:8px">${targetName}</td></tr>
        <tr><td style="padding:8px;color:#aaa">Reason</td><td style="padding:8px">${reason}</td></tr>
        ${details ? `<tr><td style="padding:8px;color:#aaa">Details</td><td style="padding:8px">${details}</td></tr>` : ''}
      </table>
      <p style="color:#aaa;font-size:13px">Log in to review and take action on this report.</p>`),
  }),

  passwordReset: ({ resetUrl, username }) => ({
    subject: 'Reset your DriveClique password',
    html: wrap(`
      <p>Hi <strong>${username}</strong>,</p>
      <p>We received a request to reset your password. Click the button below to choose a new one:</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${resetUrl}"
           style="background:#e53e3e;color:#fff;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:600;font-size:16px;display:inline-block">
          Reset Password
        </a>
      </div>
      <p style="color:#aaa;font-size:13px">This link expires in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email.</p>
      <p style="color:#666;font-size:12px;word-break:break-all">Or paste this URL into your browser:<br/>${resetUrl}</p>`),
  }),
};

module.exports = { sendEmail, emailTemplates };
