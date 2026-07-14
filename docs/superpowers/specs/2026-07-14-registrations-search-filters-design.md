# עיצוב: הוספת פילטרים לפי כלי / מורה / תשלום בטבלת הרישומים

**תאריך:** 2026-07-14
**פרויקט:** קונסרבטוריון — מערכת הרשמה
**מיקום:** `components/AdminTable.jsx` (טבלת הרישומים בפאנל הניהול)

---

## הבעיה

בטבלת הרישומים ב-`AdminTable.jsx` קיים כיום חיפוש טקסט חופשי (לפי שם תלמיד/הורה/טלפון) ופילטר יחיד לפי סטטוס (`filterStatus`, שורות 133-134, 452-462). אין אפשרות לסנן לפי כלי נגינה, מורה משובץ, או סטטוס תשלום — מה שמקשה למצוא למשל "כל הרישומים של מורה X שעדיין ממתינים לתשלום".

בנוסף, דרופדאון הסטטוס הקיים מציג רק 4 מתוך 6 הערכים המוגדרים ב-`StatusSelect.jsx` (חסרים "רשימת המתנה" ו"ממתין לשיחת היכרות").

## מקורות אמת (single source of truth)

שתי רשימות קיימות היום כ-`const` פרטי בתוך קומפוננטות ולא מיוצאות — ייצוא שלהן מונע שכפול:

- `components/StatusSelect.jsx` שורה 3: `STATUS_OPTIONS` (6 ערכים) → יהפוך ל-`export const`.
- `components/InstrumentPicker.jsx` שורות 3-54: `INSTRUMENTS` (מערך `{value, label, img}`) → יהפוך ל-`export const`.

`AdminTable.jsx` יייבא את שתיהן במקום להגדיר רשימות מקבילות.

## State חדש (`AdminTable.jsx`, ליד שורות 133-134)

```js
const [filterInstrument, setFilterInstrument] = useState('');
const [filterTeacher, setFilterTeacher] = useState('');
const [filterPayment, setFilterPayment] = useState('');
```

## לוגיקת סינון (מרחיבה את `filtered`, שורות 408-416)

```js
const matchInstrument = !filterInstrument || row.instruments?.includes(filterInstrument);
const matchTeacher = !filterTeacher || row.teacher === filterTeacher;
const matchPayment = !filterPayment || (row.registration_status || 'Pending') === filterPayment;
```

הערה: `registration_status` חסר/ריק מוצג היום כ"ממתין" (`paymentStatusLabel`, `lib/excelExport.js` שורות 16-17) — לכן הפילטר מתייחס לערך חסר כ-`'Pending'` כדי שההתנהגות תישאר עקבית עם ה-badge בטבלה.

## דרופדאונים חדשים (UI)

נוספים לאותה שורת `flex flex-col sm:flex-row gap-3` (שורות 444-462), אחרי הסלקט של סטטוס, עם אותו `className="form-input sm:w-40"`:

1. **כלי** — `<option>` לכל איבר ב-`INSTRUMENTS` המיובא (value = הקוד, טקסט = `label` בעברית).
2. **מורה** — `<option>` לכל שם ייחודי מתוך `teachers` (ה-state הקיים, נטען מ-`/api/teachers`), ממויין א'-ב'. מחושב עם `useMemo`.
3. **תשלום** — 3 אופציות קבועות: `Confirmed`/`Pending`/`Cancelled`, עם טקסט מ-`paymentStatusLabel()` (שולם/ממתין/בוטל).

## תיקון אגב: השלמת דרופדאון הסטטוס

הסלקט הקיים (שורות 452-462) יעודכן כך שיציג את כל 6 הערכים מ-`STATUS_OPTIONS` המיובא במקום 4 `<option>` קשיחים.

## מקרי קצה

- **רישום בלי `row.instruments` (רק `selected_course`):** לא ייתפס ע"י פילטר הכלי (הפילטר בודק רק את `row.instruments`) — מקובל, כי `selected_course` הוא טקסט חופשי ולא ניתן להתאמה מדויקת לרשימת כלים.
- **שילוב כמה פילטרים בו-זמנית:** לוגיקת AND — כל התנאים חייבים להתקיים יחד (כמו `matchSearch && matchStatus` הקיים).
- **איפוס פילטרים:** אין כרגע כפתור "נקה פילטרים" ייעודי — מחוץ לסקופ, כל דרופדאון מתאפס בנפרד לערך "הכל".

## מחוץ לסקופ

- לא נוגעים בתצוגת עמודת "כלים" בטבלה עצמה (שורות 540-543) — היא מציגה כיום את קודי ה-value הגולמיים (למשל `piano`) במקום התווית בעברית. זו התנהגות קיימת שלא קשורה לבקשת הפילטור, ולא מתוקנת כאן.
- אין שינוי ב-API או במסד הנתונים — הכל צד לקוח (`filtered` בזיכרון).
- אין multi-select (בחירת כמה כלים/מורים בו-זמנית) — כל פילטר הוא single-select.
