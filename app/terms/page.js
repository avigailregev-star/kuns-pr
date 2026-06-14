export const metadata = {
  title: 'תנאי שימוש | קונסרבטוריון הבית למוסיקה',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4" dir="rtl">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm p-8 sm:p-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">תנאי שימוש</h1>
        <p className="text-gray-500 text-sm mb-8">עדכון אחרון: יוני 2026</p>

        <Section title="1. כללי">
          <p>
            ברוכים הבאים לאתר קונסרבטוריון הבית למוסיקה (להלן: "הקונסרבטוריון"),
            הגפן 1, דימונה. השימוש באתר ובשירותי ההרשמה המקוונים מהווה הסכמה לתנאים המפורטים להלן.
            הקונסרבטוריון שומר את הזכות לשנות תנאים אלו בכל עת.
          </p>
        </Section>

        <Section title="2. השימוש באתר">
          <p>האתר מיועד להרשמה לשיעורים וקורסים בקונסרבטוריון. המשתמש מתחייב:</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>למסור פרטים נכונים ומדויקים בטופס ההרשמה</li>
            <li>שלא לעשות שימוש לרעה במערכת ההרשמה</li>
            <li>לא לנסות לגשת לאזורים מוגנים ללא הרשאה</li>
          </ul>
        </Section>

        <Section title="3. תנאי ההרשמה">
          <p>הרשמה לקונסרבטוריון כפופה לתנאים הבאים:</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>ההרשמה מחייבת אישור מנהלי לאחר הגשת הטופס</li>
            <li>הרשמה חדשה מחייבת שיחת היכרות עם הצוות</li>
            <li>ניתן לגשת לשיעור ניסיון לפני הרשמה מלאה</li>
          </ul>
        </Section>

        <Section title="4. תנאי תשלום">
          <ul className="list-disc list-inside space-y-1">
            <li>שכר הלימוד ישולם מראש עבור כל תקופת הלימודים</li>
            <li>אי תשלום במועד עלול לגרום להשעיית הלימודים</li>
            <li>מחיר הקורסים מצוין בעת ההרשמה ועשוי להשתנות בין שנים</li>
          </ul>
        </Section>

        <Section title="5. מדיניות ביטולים והחזרים">
          <ul className="list-disc list-inside space-y-1">
            <li>ביטול הרשמה חייב להיעשות בכתב (דוא"ל או פנייה ישירה)</li>
            <li>ביטול 14 יום ויותר לפני תחילת הלימודים — החזר מלא</li>
            <li>ביטול פחות מ-14 יום לפני תחילת הלימודים — ללא החזר</li>
            <li>ביטול במהלך סמסטר — החזר יחסי לפי שיעורים שנותרו</li>
          </ul>
        </Section>

        <Section title="6. נוכחות ועדכון שיעורים">
          <ul className="list-disc list-inside space-y-1">
            <li>היעדרות מחייבת הודעה 24 שעות מראש</li>
            <li>שיעורים שבוטלו ללא הודעה מראש לא יפוצו</li>
            <li>הקונסרבטוריון יעשה מאמץ לתזמן שיעורי פיצוי כשהמורה נעדר</li>
          </ul>
        </Section>

        <Section title="7. כללי התנהגות">
          <p>
            כל התלמידים, ההורים וצוות הקונסרבטוריון מחויבים לנהוג בכבוד הדדי.
            התנהגות בלתי הולמת עלולה לגרום להפסקת הלימודים ללא החזר כספי.
          </p>
        </Section>

        <Section title="8. שימוש בציוד">
          <p>
            תלמידים המשתמשים בכלים של הקונסרבטוריון אחראים לשמירה ולטיפול בהם.
            כל נזק שנגרם לציוד יחויב על חשבון ההורים/האפוטרופוסים.
          </p>
        </Section>

        <Section title="9. צילום ופרסום">
          <p>
            הקונסרבטוריון עשוי לצלם ולהקליט הופעות ואירועים לצרכים פנימיים ופרסומיים.
            הגשת טופס ההרשמה מהווה הסכמה לשימוש בתמונות ובהקלטות כאמור,
            אלא אם כן נמסרה בקשה מפורשת לאי-פרסום.
          </p>
        </Section>

        <Section title="10. שינויים בתכנית הלימודים">
          <p>
            הקונסרבטוריון שומר את הזכות לשנות מורים, ימים ושעות לימוד בהתאם לצרכים ארגוניים.
            שינויים מהותיים יודיעו לפחות שבועיים מראש.
          </p>
        </Section>

        <Section title="11. הגבלת אחריות">
          <p>
            הקונסרבטוריון אינו אחראי לנזקים עקיפים הנובעים מהפסקת פעילות,
            כשל טכני של האתר, או נסיבות שמחוץ לשליטתו. השימוש באתר הוא על אחריות המשתמש.
          </p>
        </Section>

        <Section title="12. יצירת קשר">
          <p>
            קונסרבטוריון הבית למוסיקה, הגפן 1, דימונה<br />
            טלפון: 08-6551283<br />
            דוא"ל: avigailregev@gmail.com
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
