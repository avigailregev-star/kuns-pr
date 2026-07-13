# ייצוא רישומים לגיליון גוגל ספציפי — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** הוספת כפתור "ייצוא לגיליון גוגל" במסך הניהול שמייצא את הרישומים המסוננים (אותם נתונים שכבר מיוצאים לאקסל) לגיליון Google Sheets ספציפי וקבוע, תוך החלפה מלאה של תוכן הגיליון בכל לחיצה.

**Architecture:** פונקציה חדשה `replaceExportSheet` ב-`lib/googleSheets.js` (מוחקת את הגיליון היעד וכותבת מחדש כותרות+שורות דרך `google-spreadsheet`), נחשפת דרך API route חדש בצד שרת (`app/api/registrations/export-to-sheet`), ומופעלת מכפתור חדש ב-`components/AdminTable.jsx` שמשתמש בלוגיקת בניית השורות המשותפת עם ייצוא האקסל הקיים.

**Tech Stack:** Next.js API routes, `google-spreadsheet` (v4) + `google-auth-library` (JWT), React (client component), Jest.

## Global Constraints

- הגיליון היעד (`GOOGLE_EXPORT_SHEET_ID`) נפרד לגמרי מ-`GOOGLE_SHEET_ID` הקיים (המשמש לסנכרון הרשמות חדש) — אין לגעת בקוד או במשתני הסביבה הקיימים של `appendRegistrationRow`.
- כל ייצוא **מחליף לחלוטין** את תוכן הגיליון (מחיקה + כתיבה מחדש) — לא append.
- העמודות המיוצאות זהות בדיוק לאלו של ייצוא האקסל הקיים, באותו סדר: תאריך, תלמיד/ה, הורה, טלפון, אימייל, סוג, כלים, סטטוס, תשלום, מורה, יום, שעה, הערות.
- ה-API route חדש דורש session מחוברת (כמו שאר נתיבי ה-admin ב-`app/api/registrations/*`), כי הוא כותב לגיליון חיצוני באמצעות מפתח סודי בצד שרת.

---

### Task 1: `replaceExportSheet` ב-`lib/googleSheets.js`

**Files:**
- Modify: `lib/googleSheets.js`
- Test: `lib/googleSheets.test.js` (חדש)
- Modify: `.env.local.example`

**Interfaces:**
- Produces: `export async function replaceExportSheet({ headers, rows })` — `headers: string[]`, `rows: (string|number)[][]`. משתמש ב-`process.env.GOOGLE_EXPORT_SHEET_ID`, `process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL`, `process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`. זורק שגיאה אם הכתיבה ל-Google Sheets נכשלת (לא בולעת שגיאות בשקט — בניגוד ל-`appendRegistrationRow`).

- [ ] **Step 1: כתיבת הבדיקה הכושלת**

צור את `lib/googleSheets.test.js`:

```js
jest.mock('google-spreadsheet', () => ({
  GoogleSpreadsheet: jest.fn(),
}));
jest.mock('google-auth-library', () => ({
  JWT: jest.fn(),
}));

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { replaceExportSheet } from './googleSheets';

function makeSheet(callOrder) {
  return {
    clear: jest.fn().mockImplementation(async () => { callOrder.push('clear'); }),
    setHeaderRow: jest.fn().mockImplementation(async () => { callOrder.push('setHeaderRow'); }),
    addRows: jest.fn().mockImplementation(async () => { callOrder.push('addRows'); }),
  };
}

beforeEach(() => {
  process.env.GOOGLE_EXPORT_SHEET_ID = 'export-sheet-id';
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'bot@example.com';
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = 'fake-key';
  GoogleSpreadsheet.mockReset();
});

describe('replaceExportSheet', () => {
  test('connects to GOOGLE_EXPORT_SHEET_ID (not GOOGLE_SHEET_ID)', async () => {
    const callOrder = [];
    const sheet = makeSheet(callOrder);
    const doc = { loadInfo: jest.fn().mockResolvedValue(undefined), sheetsByIndex: [sheet] };
    GoogleSpreadsheet.mockImplementation(() => doc);

    await replaceExportSheet({ headers: ['א'], rows: [['1']] });

    expect(GoogleSpreadsheet).toHaveBeenCalledWith('export-sheet-id', expect.anything());
  });

  test('clears the sheet, then writes the header row, then writes the data rows, in that order', async () => {
    const callOrder = [];
    const sheet = makeSheet(callOrder);
    const doc = { loadInfo: jest.fn().mockResolvedValue(undefined), sheetsByIndex: [sheet] };
    GoogleSpreadsheet.mockImplementation(() => doc);

    await replaceExportSheet({ headers: ['תאריך', 'תלמיד/ה'], rows: [['01/01/2026', 'יוסי כהן']] });

    expect(callOrder).toEqual(['clear', 'setHeaderRow', 'addRows']);
    expect(sheet.setHeaderRow).toHaveBeenCalledWith(['תאריך', 'תלמיד/ה']);
    expect(sheet.addRows).toHaveBeenCalledWith([['01/01/2026', 'יוסי כהן']]);
  });

  test('writes just the header row when there are no data rows', async () => {
    const callOrder = [];
    const sheet = makeSheet(callOrder);
    const doc = { loadInfo: jest.fn().mockResolvedValue(undefined), sheetsByIndex: [sheet] };
    GoogleSpreadsheet.mockImplementation(() => doc);

    await replaceExportSheet({ headers: ['תאריך'], rows: [] });

    expect(sheet.addRows).toHaveBeenCalledWith([]);
  });

  test('propagates errors from the Google Sheets API instead of swallowing them', async () => {
    const doc = { loadInfo: jest.fn().mockRejectedValue(new Error('permission denied')), sheetsByIndex: [] };
    GoogleSpreadsheet.mockImplementation(() => doc);

    await expect(replaceExportSheet({ headers: [], rows: [] })).rejects.toThrow('permission denied');
  });
});
```

- [ ] **Step 2: הרצת הבדיקה לוודא שהיא נכשלת**

Run: `npm test -- lib/googleSheets.test.js`
Expected: FAIL — `replaceExportSheet is not a function` (הפונקציה עוד לא קיימת).

- [ ] **Step 3: מימוש `replaceExportSheet`**

ב-`lib/googleSheets.js`, הוסף בסוף הקובץ (אחרי `appendRegistrationRow` הקיים, בלי לגעת בו):

```js
export async function replaceExportSheet({ headers, rows }) {
  const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(process.env.GOOGLE_EXPORT_SHEET_ID, serviceAccountAuth);
  await doc.loadInfo();

  const sheet = doc.sheetsByIndex[0];
  await sheet.clear();
  await sheet.setHeaderRow(headers);
  await sheet.addRows(rows);
}
```

- [ ] **Step 4: הרצת הבדיקה לוודא שהיא עוברת**

Run: `npm test -- lib/googleSheets.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: תיעוד משתנה הסביבה החדש**

ב-`.env.local.example`, אחרי שורת ה-`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (שורה 15) ולפני `# --- Supabase ---`, הוסף:

```
# מזהה גיליון היעד לייצוא ידני של רישומים (נפרד מ-GOOGLE_SHEET_ID)
GOOGLE_EXPORT_SHEET_ID=your_export_sheet_id_here
```

- [ ] **Step 6: קומיט**

```bash
git add lib/googleSheets.js lib/googleSheets.test.js .env.local.example
git commit -m "feat: add replaceExportSheet for manual Google Sheets export"
```

---

### Task 2: API route `app/api/registrations/export-to-sheet`

**Files:**
- Create: `app/api/registrations/export-to-sheet/route.js`
- Test: `app/api/registrations/export-to-sheet/route.test.js`

**Interfaces:**
- Consumes: `replaceExportSheet({ headers, rows })` מ-Task 1 (`../../../../lib/googleSheets`).
- Produces: `POST` handler בנתיב `/api/registrations/export-to-sheet`. גוף בקשה: `{ headers: string[], rows: any[][] }`. תגובות: `200 { success: true }`, `400 { error }` (קלט חסר/לא תקין), `401 { error: 'אינך מורשה' }` (אין session), `500 { error }` (כשל בכתיבה לגיליון).

- [ ] **Step 1: כתיבת הבדיקה הכושלת**

צור את `app/api/registrations/export-to-sheet/route.test.js`:

```js
import { POST } from './route';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));
jest.mock('../../auth/[...nextauth]/route', () => ({ authOptions: {} }));
jest.mock('../../../../lib/googleSheets', () => ({
  replaceExportSheet: jest.fn(),
}));

import { getServerSession } from 'next-auth';
import { replaceExportSheet } from '../../../../lib/googleSheets';

function makeRequest(body) {
  return { json: async () => body };
}

describe('POST /api/registrations/export-to-sheet', () => {
  test('rejects with 401 when there is no session', async () => {
    getServerSession.mockResolvedValue(null);

    const res = await POST(makeRequest({ headers: ['א'], rows: [] }));

    expect(res.status).toBe(401);
    expect(replaceExportSheet).not.toHaveBeenCalled();
  });

  test('rejects with 400 when headers or rows are missing', async () => {
    getServerSession.mockResolvedValue({ user: { name: 'admin' } });

    const res = await POST(makeRequest({ headers: ['א'] }));

    expect(res.status).toBe(400);
    expect(replaceExportSheet).not.toHaveBeenCalled();
  });

  test('calls replaceExportSheet with the request body and returns success', async () => {
    getServerSession.mockResolvedValue({ user: { name: 'admin' } });
    replaceExportSheet.mockResolvedValue(undefined);

    const res = await POST(makeRequest({ headers: ['תאריך'], rows: [['01/01/2026']] }));
    const json = await res.json();

    expect(replaceExportSheet).toHaveBeenCalledWith({ headers: ['תאריך'], rows: [['01/01/2026']] });
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  test('returns 500 with the error message when replaceExportSheet throws', async () => {
    getServerSession.mockResolvedValue({ user: { name: 'admin' } });
    replaceExportSheet.mockRejectedValue(new Error('permission denied'));

    const res = await POST(makeRequest({ headers: ['א'], rows: [] }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toContain('permission denied');
  });
});
```

- [ ] **Step 2: הרצת הבדיקה לוודא שהיא נכשלת**

Run: `npm test -- app/api/registrations/export-to-sheet/route.test.js`
Expected: FAIL — הקובץ `./route` עוד לא קיים.

- [ ] **Step 3: מימוש ה-route**

צור את `app/api/registrations/export-to-sheet/route.js`:

```js
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { replaceExportSheet } from '../../../../lib/googleSheets';

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });
  }

  try {
    const { headers, rows } = await request.json();
    if (!Array.isArray(headers) || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'חסרים headers/rows' }, { status: 400 });
    }

    await replaceExportSheet({ headers, rows });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}
```

- [ ] **Step 4: הרצת הבדיקה לוודא שהיא עוברת**

Run: `npm test -- app/api/registrations/export-to-sheet/route.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: קומיט**

```bash
git add app/api/registrations/export-to-sheet/route.js app/api/registrations/export-to-sheet/route.test.js
git commit -m "feat: add export-to-sheet API route"
```

---

### Task 3: כפתור ייצוא ב-`components/AdminTable.jsx`

**Files:**
- Modify: `components/AdminTable.jsx:40-63` (איזור `exportToExcel`)
- Modify: `components/AdminTable.jsx:112-127` (state hooks של הקומפוננטה)
- Modify: `components/AdminTable.jsx:417-422` (שורת הכפתורים ליד "ייצוא Excel")

**Interfaces:**
- Consumes: `POST /api/registrations/export-to-sheet` מ-Task 2 — גוף `{ headers, rows }`, מצפה ל-`200 { success: true }` או `4xx/5xx { error }`.

- [ ] **Step 1: חילוץ `buildExportRows` משותף ל-Excel ול-Sheets**

ב-`components/AdminTable.jsx`, מצא את הפונקציה `exportToExcel` (שורות 40–63):

```js
async function exportToExcel(rows) {
  const headers = ['תאריך', 'תלמיד/ה', 'הורה', 'טלפון', 'אימייל', 'סוג', 'כלים', 'סטטוס', 'תשלום', 'מורה', 'יום', 'שעה', 'הערות'];
  const dataRows = rows.map(r => [
    new Date(r.created_at).toLocaleDateString('he-IL'),
    r.student_name || '',
    r.parent_name || '',
    r.parent_phone || '',
    r.parent_email || '',
    getTypeLabel(r),
    Array.isArray(r.instruments)
      ? (r.instruments.length > 0 ? r.instruments.join('; ') : (r.selected_course || ''))
      : (r.instruments || r.selected_course || ''),
    r.status || '',
    paymentStatusLabel(r.registration_status),
    r.teacher || '',
    r.assigned_day != null && r.assigned_day !== '' ? (DAY_NAMES[Number(r.assigned_day)] ?? r.assigned_day) : '',
    r.assigned_time ? r.assigned_time.slice(0, 5) : '',
    r.admin_notes || '',
  ]);

  const rowColors = assignRowColors(rows);
  const filename = `רישומים_${new Date().toLocaleDateString('he-IL').replace(/\//g, '-')}.xlsx`;
  await downloadExcelFile({ sheetName: 'רישומים', headers, rows: dataRows, rowColors, filename });
}
```

החלף אותה בשתי פונקציות:

```js
function buildExportRows(rows) {
  const headers = ['תאריך', 'תלמיד/ה', 'הורה', 'טלפון', 'אימייל', 'סוג', 'כלים', 'סטטוס', 'תשלום', 'מורה', 'יום', 'שעה', 'הערות'];
  const dataRows = rows.map(r => [
    new Date(r.created_at).toLocaleDateString('he-IL'),
    r.student_name || '',
    r.parent_name || '',
    r.parent_phone || '',
    r.parent_email || '',
    getTypeLabel(r),
    Array.isArray(r.instruments)
      ? (r.instruments.length > 0 ? r.instruments.join('; ') : (r.selected_course || ''))
      : (r.instruments || r.selected_course || ''),
    r.status || '',
    paymentStatusLabel(r.registration_status),
    r.teacher || '',
    r.assigned_day != null && r.assigned_day !== '' ? (DAY_NAMES[Number(r.assigned_day)] ?? r.assigned_day) : '',
    r.assigned_time ? r.assigned_time.slice(0, 5) : '',
    r.admin_notes || '',
  ]);
  return { headers, dataRows };
}

async function exportToExcel(rows) {
  const { headers, dataRows } = buildExportRows(rows);
  const rowColors = assignRowColors(rows);
  const filename = `רישומים_${new Date().toLocaleDateString('he-IL').replace(/\//g, '-')}.xlsx`;
  await downloadExcelFile({ sheetName: 'רישומים', headers, rows: dataRows, rowColors, filename });
}

async function postRegistrationsToSheet(headers, rows) {
  const res = await fetch('/api/registrations/export-to-sheet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ headers, rows }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || 'שגיאה בייצוא לגיליון');
  }
}
```

- [ ] **Step 2: הוספת state לטעינה**

ב-`components/AdminTable.jsx:120`, אחרי `const [saved, setSaved] = useState(null);`, הוסף:

```js
  const [sheetExporting, setSheetExporting] = useState(false);
```

- [ ] **Step 3: הוספת handler**

ב-`components/AdminTable.jsx`, מיד לפני `async function handleCreateGroup(...)` (שורה 267), הוסף:

```js
  async function handleExportToSheet() {
    setSheetExporting(true);
    try {
      const { headers, dataRows } = buildExportRows(filtered);
      await postRegistrationsToSheet(headers, dataRows);
      alert('הייצוא לגיליון הושלם בהצלחה');
    } catch (err) {
      alert(err.message || 'שגיאת רשת — נסה שוב');
    } finally {
      setSheetExporting(false);
    }
  }
```

- [ ] **Step 4: הוספת הכפתור**

ב-`components/AdminTable.jsx:417-422`, אחרי כפתור "ייצוא Excel" (ולפני כפתור "הדפסה"):

```jsx
        <button
          onClick={() => exportToExcel(filtered)}
          className="px-4 py-2 border border-green-300 text-green-700 rounded-lg hover:bg-green-50 text-sm"
        >
          📊 ייצוא Excel
        </button>
        <button
          onClick={handleExportToSheet}
          disabled={sheetExporting}
          className="px-4 py-2 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 text-sm disabled:opacity-50"
        >
          {sheetExporting ? '⏳ מייצא...' : '📤 ייצוא לגיליון גוגל'}
        </button>
```

- [ ] **Step 5: הרצת שאר הבדיקות לוודא שלא נשבר כלום**

Run: `npm test`
Expected: PASS — כל הבדיקות הקיימות (כולל `lib/excelExport.test.js`) ממשיכות לעבור, בפרט שאין רגרסיה בהתנהגות `exportToExcel`.

- [ ] **Step 6: בדיקה ידנית בדפדפן**

1. הרץ `npm run dev`, היכנס למסך הניהול (`/admin`).
2. ודא ש-`.env.local` מכיל את `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` / `GOOGLE_EXPORT_SHEET_ID` (בוצע כבר בהקמה הידנית).
3. לחץ על "📤 ייצוא לגיליון גוגל" — ודא שהכפתור מציג "⏳ מייצא..." וננעל בזמן הבקשה.
4. פתח את הגיליון בדפדפן ווודא שהתוכן הוחלף בכותרות + השורות המסוננות, זהות לתוכן קובץ האקסל המקביל.
5. סנן את הטבלה (למשל לפי סטטוס) ולחץ שוב — ודא שהגיליון משקף רק את השורות המסוננות (לא את כולן).

- [ ] **Step 7: קומיט**

```bash
git add components/AdminTable.jsx
git commit -m "feat: add Google Sheets export button to admin table"
```
