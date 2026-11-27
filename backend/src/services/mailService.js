import nodemailer from 'nodemailer';
import { AppError } from '../utils/AppError.js';

// Mensajes enviados en pruebas (transporte en memoria); nunca se usa fuera de NODE_ENV=test.
export const sentInTests = [];
let transport;

// En pruebas no se envía nada real; en uso normal se requiere SMTP configurado en .env.
export function isMailConfigured() {
  return process.env.NODE_ENV === 'test' || Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

function getTransport() {
  if (transport) return transport;
  if (process.env.NODE_ENV === 'test') {
    transport = nodemailer.createTransport({ jsonTransport: true });
  } else {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      connectionTimeout: 10000,
    });
  }
  return transport;
}

// Sin SMTP se responde con un error claro en vez de fingir que el correo salió.
export function assertMailConfigured() {
  if (!isMailConfigured()) {
    throw new AppError(503, 'MAIL_NOT_CONFIGURED', 'El envío de correos no está configurado en el servidor. Contacta a la administración.');
  }
}

// Envía un correo de texto.
export async function sendMail({ to, subject, text }) {
  assertMailConfigured();
  const message = { from: process.env.SMTP_FROM || 'MENTOR IA <no-responder@mentor.test>', to, subject, text };
  await getTransport().sendMail(message);
  if (process.env.NODE_ENV === 'test') sentInTests.push(message);
}

// Dirección pública del frontend para armar enlaces en los correos.
export function appUrl() {
  return (process.env.APP_URL || process.env.FRONTEND_ORIGIN?.split(',')[0] || 'http://localhost:5173').replace(/\/$/, '');
}
