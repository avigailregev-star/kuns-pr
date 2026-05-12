import nodemailer from 'nodemailer';

function createTransporter() {
  return nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    auth: {
      user: process.env.BREVO_SMTP_LOGIN,
      pass: process.env.BREVO_SMTP_PASSWORD,
    },
  });
}

export async function sendConfirmationEmail({ parentName, studentName, parentEmail, instruments, selectedCourse, preferredSlot, orchestra }) {
  const transporter = createTransporter();
  const instrumentsList = Array.isArray(instruments) && instruments.length > 0
    ? instruments.join(', ')
    : selectedCourse || null;

  await transporter.sendMail({
    from: '"קונסרבטוריון המוזיקה" <avigailregev@gmail.com>',
    to: parentEmail,
    subject: 'קיבלנו את הרשמתך לקונסרבטוריון',
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #6D28D9;">קונסרבטוריון המוזיקה</h2>
        <p>שלום ${parentName},</p>
        <p>קיבלנו את הרשמת <strong>${studentName}</strong> לקונסרבטוריון.</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          ${instrumentsList ? `<p><strong>קורס / כלי נגינה:</strong> ${instrumentsList}</p>` : ''}
          ${preferredSlot ? `<p><strong>העדפת מועד:</strong> ${preferredSlot}</p>` : ''}
          ${orchestra ? `<p><strong>שיבוץ תזמורת/מקהלה:</strong> ${orchestra}</p>` : ''}
        </div>
        <p>ניצור איתך קשר בקרוב לתיאום שיעורים.</p>
        <p>תודה,<br/>צוות הקונסרבטוריון</p>
      </div>
    `,
  });
}

const DAY_NAMES_EMAIL = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function formatDay(assignedDay) {
  if (assignedDay == null || assignedDay === '') return null;
  const num = Number(assignedDay);
  if (!isNaN(num) && num >= 0 && num <= 6) return `יום ${DAY_NAMES_EMAIL[num]}`;
  return `יום ${assignedDay}`;
}

export async function sendAssignmentEmail({ parentName, studentName, parentEmail, teacher, assignedDay, assignedTime, orchestra }) {
  const transporter = createTransporter();
  const dayLabel = formatDay(assignedDay);

  await transporter.sendMail({
    from: '"קונסרבטוריון המוזיקה" <avigailregev@gmail.com>',
    to: parentEmail,
    subject: 'שובצת לקונסרבטוריון המוזיקה',
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #6D28D9;">קונסרבטוריון המוזיקה</h2>
        <p>שלום ${parentName},</p>
        <p>שמחים לבשר ש<strong>${studentName}</strong> שובץ/ה!</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          ${teacher ? `<p><strong>מורה:</strong> ${teacher}</p>` : ''}
          ${dayLabel ? `<p><strong>יום שיעור:</strong> ${dayLabel}</p>` : ''}
          ${assignedTime ? `<p><strong>שעה:</strong> ${assignedTime}</p>` : ''}
          ${orchestra ? `<p><strong>תזמורת/מקהלה:</strong> ${orchestra}</p>` : ''}
        </div>
        <p>לשאלות ניתן לפנות אלינו בכל עת.</p>
        <p>תודה,<br/>צוות הקונסרבטוריון</p>
      </div>
    `,
  });
}
