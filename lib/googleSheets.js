import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

export async function appendRegistrationRow(data) {
  const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
  await doc.loadInfo();

  const sheet = doc.sheetsByIndex[0];
  await sheet.addRow({
    'תאריך': new Date().toLocaleString('he-IL'),
    'שם תלמיד': data.studentName,
    'שם הורה': data.parentName,
    'טלפון': data.parentPhone,
    'אימייל': data.parentEmail,
    'סוג הרשמה': data.type,
    'כלי נגינה': Array.isArray(data.instruments) ? data.instruments.join(', ') : data.instruments,
    'ימים לא פנויים': Array.isArray(data.unavailableDays) ? data.unavailableDays.join(', ') : data.unavailableDays,
    'מועד רצוי': data.preferredSlot,
    'סטטוס': 'חדש',
  });
}
