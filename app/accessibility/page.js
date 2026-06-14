export const metadata = {
  title: 'הצהרת נגישות | קונסרבטוריון הבית למוסיקה',
};

export default function AccessibilityPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4" dir="rtl">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm p-8 sm:p-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">הצהרת נגישות</h1>
        <p className="text-gray-500 text-sm mb-8">עדכון אחרון: יוני 2026</p>

        <Section title="מחויבות לנגישות">
          <p>
            קונסרבטוריון הבית למוסיקה מחויב להנגשת שירותיו ואתר האינטרנט לכלל הציבור,
            לרבות אנשים עם מוגבלויות, בהתאם לחוק שוויון זכויות לאנשים עם מוגבלות,
            התשנ"ח-1998, ותקנות הנגישות הנלוות.
          </p>
        </Section>

        <Section title="רמת הנגישות הנוכחית">
          <p>
            האתר שואף לעמוד ברמת נגישות <strong>WCAG 2.1 AA</strong>.
            בוצעו התאמות הכוללות:
          </p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>הגדרת שפה (עברית) וכיוון טקסט (ימין לשמאל) בכל עמוד</li>
            <li>ניגודיות צבעים מספקת בין טקסט לרקע</li>
            <li>תוויות (labels) לכל שדות הטופס</li>
            <li>ניווט מקלדת בטופס ההרשמה</li>
            <li>הודעות שגיאה ברורות בעת מילוי שגוי של טפסים</li>
            <li>תמונות עם טקסט חלופי (alt text)</li>
            <li>עיצוב רספונסיבי המותאם למגוון מכשירים</li>
          </ul>
        </Section>

        <Section title="מגבלות נגישות ידועות">
          <p>אנו עובדים על שיפור מתמיד. מגבלות שזיהינו:</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>חלק מרכיבי הטפסים עשויים לא להיות נגישים באופן מלא לקוראי מסך</li>
            <li>תוכן מסוים עשוי לדרוש שימוש בעכבר ואינו נגיש עדיין דרך מקלדת בלבד</li>
          </ul>
          <p className="mt-2 text-sm text-gray-500">
            אנו מתכוונים לטפל בליקויים אלו בגרסאות עתידיות של האתר.
          </p>
        </Section>

        <Section title="פנייה בנושא נגישות">
          <p>
            נתקלתם בבעיית נגישות? נשמח לשמוע ולטפל בה בהקדם.
            ניתן לפנות אלינו:
          </p>
          <div className="mt-3 p-4 bg-purple-50 rounded-xl border border-purple-100">
            <p className="font-medium text-gray-800">רכז נגישות — קונסרבטוריון הבית למוסיקה</p>
            <p className="mt-1">טלפון: <a href="tel:086551283" className="text-purple-700 font-medium">08-6551283</a></p>
            <p>דוא"ל: <a href="mailto:avigailregev@gmail.com" className="text-purple-700 font-medium">avigailregev@gmail.com</a></p>
            <p className="text-sm text-gray-500 mt-2">נשתדל להגיב תוך 5 ימי עסקים.</p>
          </div>
        </Section>

        <Section title="פנייה לנציב שוויון זכויות">
          <p>
            אם לא קיבלתם מענה מספק מצדנו, ניתן לפנות לנציב שוויון זכויות לאנשים עם מוגבלות
            במשרד המשפטים.
          </p>
        </Section>

        <Section title="תאריך הבדיקה האחרונה">
          <p>הצהרה זו עודכנה לאחרונה ביוני 2026.</p>
        </Section>

        <div className="mt-10 pt-6 border-t border-gray-100 text-center">
          <a href="/register" className="text-purple-600 hover:text-purple-800 text-sm font-medium">
            ← חזרה לטופס ההרשמה
          </a>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold text-gray-800 mb-3">{title}</h2>
      <div className="text-gray-700 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}
