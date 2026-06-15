import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (secret !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const login = process.env.BREVO_SMTP_LOGIN;
  const pass = process.env.BREVO_SMTP_PASSWORD;

  if (!login || !pass) {
    return NextResponse.json({
      error: 'Missing env vars',
      BREVO_SMTP_LOGIN: login ? 'SET' : 'MISSING',
      BREVO_SMTP_PASSWORD: pass ? 'SET' : 'MISSING',
    });
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    auth: { user: login, pass },
  });

  try {
    await transporter.verify();

    const info = await transporter.sendMail({
      from: '"קונסרבטוריון" <avigailregev@gmail.com>',
      to: 'avigailregev@gmail.com',
      subject: 'בדיקת מייל מ-Vercel',
      text: 'אם קיבלת את זה — המייל עובד בפרודקשן!',
    });

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      response: info.response,
      BREVO_LOGIN: login,
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err.message,
      code: err.code,
      response: err.response,
      BREVO_LOGIN: login,
    });
  }
}
