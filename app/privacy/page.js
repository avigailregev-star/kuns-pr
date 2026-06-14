export const metadata = {
  title: 'מדיניות פרטיות | קונסרבטוריון הבית למוסיקה',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4" dir="rtl">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm p-8 sm:p-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">מדיניות פרטיות</h1>
        <p className="text-gray-500 text-sm mb-8">עדכון אחרון: יוני 2026</p>

        <Section title="1. מי אנחנו">
          <p>
            קונסרבטוריון הבית למוסיקה, הגפן 1, דימונה.<br />
            טלפון: 08-6551283 | דוא"ל: consdimona@gmail.com
          </p>
          <p className="mt-2">
            אנו מחויבים להגן על הפרטיות של התלמידים, ההורים והמשתמשים באתר זה,
            בהתאם לחוק הגנת הפרטיות, התשמ"א-1981 ותקנותיו.
          </p>
        </Section>

        <Section title="2. איזה מידע אנו אוספים">
          <ul className="list-disc list-inside space-y-1">
            <li>שם התלמיד/ה ותאריך לידה</li>
            <li>כיתה ובית ספר</li>
            <li>שם ההורה/אפוטרופוס</li>
            <li>מספר טלפון ודוא"ל של ההורה</li>
            <li>כלי נגינה ותוכנית הלימודים המבוקשת</li>
            <li>העדפות זמינות לשיעורים</li>
            <li>מידע על התאמות נגישות (במידה ומסופק)</li>
          </ul>
          <p className="mt-2 text-gray-500 text-sm">
            המידע נאסף ישירות מטופס ההרשמה המקוון ומשמש לצרכי הרשמה בלבד.
          </p>
        </Section>

        <Section title="3. כיצד אנו משתמשים במידע">
          <ul className="list-disc list-inside space-y-1">
            <li>ניהול הרשמה ושיבוץ תלמידים לשיעורים ומורים</li>
            <li>שליחת אישור הרשמה ועדכונים בדוא"ל</li>
            <li>תיאום ותקשורת שוטפת לגבי שיעורים ותשלומים</li>
            <li>ניהול רישומים פנימיים של הקונסרבטוריון</li>
          </ul>
          <p className="mt-2 text-gray-500 text-sm">
            אנו לא עושים שימוש במידע לצרכי שיווק ללא הסכמה מפורשת.
          </p>
        </Section>

        <Section title="4. שמירת המידע ואבטחתו">
          <p>
            המידע נשמר בשרתים מאובטחים (Supabase) ובגיליונות Google Sheets הנגישים
            לצוות הניהול בלבד. אנו מיישמים אמצעי אבטחה טכניים וארגוניים מתאימים
            להגנה על המידע מפני גישה, שינוי, חשיפה או מחיקה בלתי מורשות.
          </p>
        </Section>

        <Section title="5. שיתוף מידע עם צדדים שלישיים">
          <p>
            אנו לא מוכרים, משכירים או מעבירים את פרטיכם לגורמים מסחריים שלישיים.
            המידע עשוי להיות מועבר אך ורק ל:
          </p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>ספקי שירות טכנולוגי הנדרשים להפעלת האתר (Supabase, Google)</li>
            <li>רשויות ממשלתיות — אם נדרש על פי חוק</li>
          </ul>
        </Section>

        <Section title="6. שמירת מידע">
          <p>
            המידע נשמר כל עוד התלמיד/ה רשום/ה בקונסרבטוריון ולתקופה של עד 3 שנים לאחר
            סיום הלימודים לצרכים מנהלתיים. לאחר מכן המידע נמחק.
          </p>
        </Section>

        <Section title="7. זכויותיכם">
          <ul className="list-disc list-inside space-y-1">
            <li>עיון במידע שנשמר אודותיכם</li>
            <li>בקשת תיקון מידע שגוי</li>
            <li>בקשת מחיקת המידע (בכפוף לחובות שמירה חוקיות)</li>
            <li>קבלת עותק של המידע בפורמט קריא</li>
          </ul>
          <p className="mt-2">
            לממש זכויות אלו, פנו אלינו בדוא"ל: consdimona@gmail.com
          </p>
        </Section>

        <Section title="8. עוגיות (Cookies)">
          <p>
            האתר עשוי להשתמש בעוגיות טכניות הנחוצות לתפקוד תקין של הטפסים.
            אין שימוש בעוגיות שיווקיות או מעקב.
          </p>
        </Section>

        <Section title="9. יצירת קשר">
          <p>
            לכל שאלה בנושא פרטיות, פנו אלינו:<br />
            קונסרבטוריון הבית למוסיקה, הגפן 1, דימונה<br />
            טלפון: 08-6551283<br />
            דוא"ל: consdimona@gmail.com
          </p>
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
