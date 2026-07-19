# סימון "התקיימה שיחת היכרות" - עיצוב

## רקע

בטבלת הניהול (AdminTable), כאשר `contactRow.attended_open_day === false`, מוצג תג סגול "טרם שיחת היכרות" ליד שם התלמיד/ה. כרגע אין דרך לעדכן את השדה הזה אחרי ההרשמה - הוא נקבע פעם אחת ב-`app/api/register/route.js` ולא ניתן לשינוי מהאדמין. המטרה: לאפשר למנהל/ת לסמן במהירות שהשיחה התקיימה, כך שהתג ייעלם.

## זרימה

1. התג "טרם שיחת היכרות" הופך לכפתור לחיץ (`<button>` במקום `<span>`).
2. לחיצה עליו מציגה `confirm("לסמן שהתקיימה שיחת היכרות?")`.
3. באישור:
   - קריאת `PATCH /api/registrations` עם `{ id: contactRow.id, attended_open_day: true }`.
   - עדכון אופטימי של ה-state המקומי (`setRows`) כך שהתג נעלם מיד מהטבלה.
   - שימוש ב-`updatingIds` בזמן הקריאה, בדיוק כמו בדפוס הקיים של `updatePaymentStatus`.
4. אין דיאלוג שגיאה מיוחד - אם הקריאה נכשלת, מספיק לוג בקונסול (בדומה לשאר הפעולות הדומות בקובץ).

## שינויי קוד

### `app/api/registrations/route.js`
ב-PATCH handler (סביב שורות 81-88), להוסיף את `attended_open_day` לפרמטרים הנקראים מה-body ולרשימת השדות המותרים לעדכון:

```js
const { id, admin_notes, registration_status, student_name, parent_name, parent_phone, parent_email, attended_open_day } = await request.json();
...
if (attended_open_day !== undefined) updateData.attended_open_day = attended_open_day;
```

### `components/AdminTable.jsx`
- פונקציה חדשה `markAttendedOpenDay(id)`, במבנה זהה ל-`updatePaymentStatus` (שורות 461-473): מוסיפה ל-`updatingIds`, שולחת PATCH, מעדכנת `rows` locally, מסירה מ-`updatingIds`.
- התג הקיים (שורות 645-649) הופך לכפתור:

```jsx
{contactRow.attended_open_day === false && (
  <button
    type="button"
    onClick={() => {
      if (confirm('לסמן שהתקיימה שיחת היכרות?')) markAttendedOpenDay(contactRow.id);
    }}
    className="mr-1 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium hover:bg-purple-200"
  >
    טרם שיחת היכרות
  </button>
)}
```

## מחוץ לתחום

- אין דרך להחזיר את השדה ל-`false` דרך הממשק (לא נדרש - ברגע שהשיחה התקיימה אין תרחיש חזרה אחורה).
- אין שינוי בסנכרון לאפליקציית הנוכחות (`syncRegistrationToAttendance`) - השדה הזה לא חלק מהסנכרון הקיים.
