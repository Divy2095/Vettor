import nodemailer from "nodemailer";

import { env } from "../config/env.js";

const hasSmtpConfig = Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS);

const createTransporter = () => {
  if (!hasSmtpConfig) return null;

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: Boolean(env.SMTP_SECURE),
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
};

const transporter = createTransporter();

const sendOrLog = async ({ to, subject, text }) => {
  if (!transporter) {
    console.log(`\n[DEV EMAIL]\nTo: ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }

  await transporter.sendMail({
    from: env.EMAIL_FROM || "Resume AI <no-reply@example.com>",
    to,
    subject,
    text,
  });
};

export const sendPasswordResetEmail = async ({ to, token }) => {
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}&email=${encodeURIComponent(to)}`;

  await sendOrLog({
    to,
    subject: "Reset your password",
    text: `Use this link to reset your password: ${resetUrl}`,
  });
};
