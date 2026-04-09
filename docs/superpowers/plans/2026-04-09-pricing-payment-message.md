# Pricing Table + Payment Message Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** הצגת מחיר הקורס בטופס ההרשמה + הודעת "לא יחויב תשלום לפני ה-10 לספטמבר" בדף תודה.

**Architecture:** פונקציה `getCoursePrice` ב-`lib/paymentLinks.js` ממפה שמות קורסים למחירים לפי תבניות שם. הטופס מציג את המחיר בשלב בחירת קורס בלבד. דף תודה מציג באנר לכל הרשמה חוץ מ-trial.

**Tech Stack:** Next.js 14, React, Tailwind CSS

---

## File Map

| קובץ | שינוי |
|---|---|
| `lib/paymentLinks.js` | הוספת `getCoursePrice` |
| `components/RegistrationForm.jsx` | הצגת כרטיס מחיר בשלב `course` |
| `app/thank-you/page.js` | הוספת באנר תאריך תשלום |

---

### Task 1: הוספת `getCoursePrice` ל-`lib/paymentLinks.js`

**Files:**
- Modify: `lib/paymentLinks.js`

- [ ] **Step 1: הוסף את הפונקציה בסוף הקובץ, אחרי `getCourseNames`**

פתח את `lib/paymentLinks.js` והוסף בסוף:

```js
/**
 * מחזיר מחיר מוצג לפי שם קורס, או null אם לא ידוע.
 */
export function getCoursePrice(courseName) {
  if (!courseName) return null;
  if (courseName.includes("45 דק")) return "4,600 ₪ לשנה";
  if (courseName.includes("60 דק")) return "4,800 ₪ לשנה";
  if (courseName.includes("שנה א'")) return "650 ₪ לשנה";
  if (courseName.includes("שנה ב'")) return "950 ₪ לשנה";
  if (courseName.includes("שנה ג'")) return "1,750 ₪ לשנה";
  if (/תזמורת|מקהלה|תיאוריה|אנסמבל|הזמיר|אורגנית קבוצתי|חלילית קבוצתי/.test(courseName)) return "חינם";
  return null;
}
```

- [ ] **Step 2: ודא ידנית שהפונקציה עובדת נכון**

פתח את `lib/paymentLinks.js` ובדוק שהפונקציה נוספה בסוף הקובץ.

- [ ] **Step 3: Commit**

```bash
git add lib/paymentLinks.js
git commit -m "feat: add getCoursePrice to paymentLinks"
```

---

### Task 2: הצגת כרטיס מחיר בטופס ההרשמה

**Files:**
- Modify: `components/RegistrationForm.jsx`

- [ ] **Step 1: עדכן את ה-import בראש הקובץ**

מצא את השורה:
```js
import { getPaymentLink, getCourseNames } from '../lib/paymentLinks';
```
שנה ל:
```js
import { getPaymentLink, getCourseNames, getCoursePrice } from '../lib/paymentLinks';
```

- [ ] **Step 2: הוסף כרטיס מחיר בשלב `course` — מתחת ל-dropdown הקורס**

מצא את הבלוק שמסתיים ב:
```jsx
                </select>
              </div>

              {form.type === 'continue' && (
```

הוסף **לפני** `{form.type === 'continue' && (`:

```jsx
              {form.selectedCourse && getCoursePrice(form.selectedCourse) && (
                <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)' }}>
                  <span className="text-sm text-slate-300">עלות שנתית:</span>
                  <span className="text-lg font-bold text-purple-300">{getCoursePrice(form.selectedCourse)}</span>
                </div>
              )}
```

- [ ] **Step 3: בדוק ידנית**

הרץ `npm run dev`, עבור לטופס הרשמה, בחר סוג "ממשיך", עבור לשלב קורס, בחר קורס עם "45 דק'" — ודא שמופיע "4,600 ₪ לשנה". בחר קורס "הזמיר" — ודא שמופיע "חינם".

- [ ] **Step 4: Commit**

```bash
git add components/RegistrationForm.jsx
git commit -m "feat: show course price in registration form"
```

---

### Task 3: הוספת באנר תאריך תשלום בדף תודה

**Files:**
- Modify: `app/thank-you/page.js`

- [ ] **Step 1: הוסף את הבאנר בתוך `ThankYouContent`, מתחת לבלוק "מה הלאה?" ולפני כפתור התשלום**

מצא:
```jsx
      {paymentUrl && (
        <a
          href={paymentUrl}
```

הוסף **לפני** הבלוק הזה:

```jsx
      {!isTrial && (
        <div className="flex items-center gap-2 p-3 rounded-xl mb-4 text-sm text-amber-300" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <span>🗓️</span>
          <span>לא יחויב תשלום לפני ה-10 לספטמבר</span>
        </div>
      )}
```

- [ ] **Step 2: בדוק ידנית**

הרץ `npm run dev`, עבור ל-`/thank-you?type=new` — ודא שהבאנר מופיע.
עבור ל-`/thank-you?type=trial` — ודא שהבאנר **לא** מופיע.

- [ ] **Step 3: Commit**

```bash
git add app/thank-you/page.js
git commit -m "feat: add payment date notice on thank-you page"
```

---

### Task 4: Deploy

- [ ] **Step 1: Push ו-deploy**

```bash
git push
```

Vercel יעשה deploy אוטומטי. המתן כדקה ובדוק ב-`kunspr.vercel.app`.
