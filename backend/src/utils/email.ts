import nodemailer from 'nodemailer';

interface SendVerificationEmailParams {
  to: string;
  firstName: string;
  verificationToken: string;
}

interface SendPasswordResetEmailParams {
  to: string;
  firstName: string;
  resetToken: string;
  resetUrl: string;
}

// Create transporter lazily to allow missing SMTP config in development
const createTransporter = () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: (process.env.SMTP_SECURE || 'false') === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return null; // Fallback to console logging
};

export const sendVerificationEmail = async ({ to, firstName, verificationToken }: SendVerificationEmailParams): Promise<void> => {
  const baseUrl = process.env.FRONTEND_BASE_URL || 'http://localhost:5173';
  const verifyUrl = `${baseUrl}/verify?token=${verificationToken}`;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#222;max-width:600px;margin:0 auto;">
      <h2 style="color:#0d6efd;">Confirm your IdealStay account</h2>
      <p>Hi ${firstName || ''},</p>
      <p>Thank you for registering with <strong>IdealStay</strong>. Please confirm your email address by clicking the button below:</p>
      <p style="text-align:center;">
        <a href="${verifyUrl}" style="background:#0d6efd;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600;">Verify Email</a>
      </p>
      <p>If the button doesn't work, copy and paste this URL into your browser:</p>
      <code style="display:block;background:#f5f5f5;padding:8px 12px;border-radius:4px;word-break:break-all;">${verifyUrl}</code>
      <p style="font-size:12px;color:#666;">If you did not create an IdealStay account, you can ignore this email.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
      <p style="font-size:12px;color:#888;">IdealStay &copy; ${new Date().getFullYear()}</p>
    </div>
  `;

  const transporter = createTransporter();
  if (!transporter) {
    console.log('📧 (DEV MODE) Verification email (no SMTP configured):');
    console.log(' To:', to);
    console.log(' Link:', verifyUrl);
    return;
  }

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'no-reply@idealstay.local',
    to,
    subject: 'Verify your IdealStay account',
    html,
  });
};

export const sendPasswordResetEmail = async ({ to, firstName, resetToken, resetUrl }: SendPasswordResetEmailParams): Promise<void> => {
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#222;max-width:600px;margin:0 auto;">
      <h2 style="color:#0d6efd;">Reset your IdealStay password</h2>
      <p>Hi ${firstName || ''},</p>
      <p>We received a request to reset your password. Click the button below to choose a new one. This link will expire soon.</p>
      <p style="text-align:center;">
        <a href="${resetUrl}" style="background:#0d6efd;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600;">Reset Password</a>
      </p>
      <p>If the button doesn't work, copy and paste this URL into your browser:</p>
      <code style="display:block;background:#f5f5f5;padding:8px 12px;border-radius:4px;word-break:break-all;">${resetUrl}</code>
      <p style="font-size:12px;color:#666;">If you did not request this, you can safely ignore this email.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
      <p style="font-size:12px;color:#888;">IdealStay &copy; ${new Date().getFullYear()}</p>
    </div>
  `;

  const transporter = createTransporter();
  if (!transporter) {
    console.log('📧 (DEV MODE) Password reset email (no SMTP configured):');
    console.log(' To:', to);
    console.log(' Link:', resetUrl);
    console.log(' Token:', resetToken);
    return;
  }

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'no-reply@idealstay.local',
    to,
    subject: 'Reset your IdealStay password',
    html,
  });
};

export const sendGenericEmail = async (to: string, subject: string, html: string) => {
  const transporter = createTransporter();
  if (!transporter) {
    console.log('📧 (DEV MODE) Generic email (no SMTP configured):');
    console.log(' To:', to);
    console.log(' Subject:', subject);
    return;
  }
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'no-reply@idealstay.local',
    to,
    subject,
    html,
  });
};

export default {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendGenericEmail,
};
