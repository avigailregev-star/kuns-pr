/**
 * סקריפט חד-פעמי: סורק את אתר המתנ"ס ומייצר את lib/paymentLinks.js
 * הרצה: node scripts/build-payment-links.js
 */

const fs = require('fs');
const path = require('path');

// כל מזהי הקורסים באתר המתנ"ס
const COURSE_IDS = [
  89158, 89159, 89160, 89161, 89162, 89163, 89164, 89165, // פסנתר
  89140, 93991,                                             // כלי הקשה / דרבוקה
  97188, 97189, 89155, 89176, 89174,                       // פיתוח קול / קיובייס
  81555, 81553, 81554,                                     // מנגינות יצחק שדה
  81558, 81556, 81557,                                     // מנגינות נווה עמרם
  81548, 81546, 81547,                                     // מנגינות גבריאל
  81561, 81559, 81560,                                     // מנגינות נועם חיים
  81552, 88665, 88666,                                     // מנגינות הרצוג
  81542, 88663, 88664,                                     // מנגינות אמיר
  93995, 93996,                                            // מנגינות רבין
  93992, 93993, 93994,                                     // מנגינות בן עטר
  89137, 89138, 89153,                                     // גיטרה
  89148, 89145, 89146,                                     // כינור
  89151, 89152, 97186, 97187,                              // סקסופון
  89144, 89143,                                            // חצוצרה
  89141,                                                   // חליל צד
  89154, 93997,                                            // עוד
  89170, 89169, 89168, 89171, 89173, 89172,               // תוכניות מיוחדות
  97190,                                                   // קורס DJ
];

const BASE_URL = 'https://www.matnas-dimona.org.il/page.php?type=hug&id=';

async function fetchCoursePage(id) {
  const url = `${BASE_URL}${id}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    console.error(`  ❌ שגיאה בקורס ${id}: ${e.message}`);
    return null;
  }
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractCourseName(html) {
  // חילוץ מתג <title>: "חוג  NAME | שם האתר"
  const titleTag = html.match(/<title>([^<]+)<\/title>/);
  if (titleTag) {
    const raw = titleTag[1].split('|')[0].trim();
    const name = raw.replace(/^חוג\s+/, '').trim();
    if (name) return decodeHtmlEntities(name);
  }

  // גיבוי: og:title השני בדף (הספציפי לקורס)
  const allOgTitles = [...html.matchAll(/<meta property='og:title' content='([^']+)'/g)];
  if (allOgTitles.length > 0) {
    return decodeHtmlEntities(allOgTitles[allOgTitles.length - 1][1].trim());
  }

  return null;
}

function extractPaymentUrl(html) {
  // חיפוש קישור hugim.org.il
  const match = html.match(/https?:\/\/www\.hugim\.org\.il\/[^\s"'<>]+/g);
  if (!match) return null;

  // בחירת הקישור הראשון שמכיל KodMatnas
  const paymentLink = match.find(url => url.includes('KodMatnas') || url.includes('HugIndexNo') || url.includes('hugim.org.il'));
  return paymentLink || match[0];
}

async function main() {
  console.log('🔍 סורק קורסים מאתר המתנ"ס...\n');

  const results = [];
  let found = 0;
  let notFound = 0;

  for (const id of COURSE_IDS) {
    process.stdout.write(`  קורס ${id}... `);
    const html = await fetchCoursePage(id);

    if (!html) {
      console.log('❌ לא נמצא');
      notFound++;
      continue;
    }

    const name = extractCourseName(html);
    const paymentUrl = extractPaymentUrl(html);

    if (paymentUrl) {
      console.log(`✅ ${name || '(ללא שם)'}`);
      results.push({ id, name: name || `קורס ${id}`, paymentUrl });
      found++;
    } else {
      console.log(`⚠️  ${name || '(ללא שם)'} — לא נמצא קישור תשלום`);
      results.push({ id, name: name || `קורס ${id}`, paymentUrl: null });
      notFound++;
    }

    // המתנה קצרה בין בקשות
    await new Promise(r => setTimeout(r, 300));
  }

  // בניית קובץ paymentLinks.js
  const entries = results
    .filter(r => r.paymentUrl)
    .map(r => `  ${JSON.stringify(r.name)}: ${JSON.stringify(r.paymentUrl)},`)
    .join('\n');

  const noPayment = results
    .filter(r => !r.paymentUrl)
    .map(r => `  // ${r.name} (id=${r.id}) — לא נמצא קישור`)
    .join('\n');

  const output = `// קובץ זה נוצר אוטומטית על ידי scripts/build-payment-links.js
// להרצה מחדש: node scripts/build-payment-links.js

export const PAYMENT_LINKS = {
${entries}
};

// קורסים ללא קישור תשלום:
${noPayment}

/**
 * מחזיר קישור תשלום לפי שם הקורס שנבחר.
 */
export function getPaymentLink(courseName) {
  return PAYMENT_LINKS[courseName] || null;
}
`;

  const outPath = path.join(__dirname, '..', 'lib', 'paymentLinks.js');
  fs.writeFileSync(outPath, output, 'utf8');

  console.log(`\n✅ הושלם!`);
  console.log(`   נמצאו קישורים: ${found}`);
  console.log(`   ללא קישור: ${notFound}`);
  console.log(`   הקובץ נשמר: lib/paymentLinks.js`);
}

main().catch(console.error);
