'use client';

import { useState } from 'react';

const AGREEMENT_TEXT = `תקנון הרשמה לקונסרבטוריון המוזיקה

1. כללי
הרשמה לקונסרבטוריון המוזיקה מהווה הסכמה לכל התנאים המפורטים במסמך זה. הקונסרבטוריון שומר לעצמו את הזכות לשנות תנאים אלו בכל עת.

2. תנאי התשלום
שכר הלימוד ישולם מראש בתחילת כל חודש לימודים, לא יאוחר מה-5 לכל חודש. אי תשלום במועד עלול לגרום להשעיית הלימודים. החזרים יינתנו רק במקרה של ביטול שנעשה 14 יום לפני תחילת הלימודים.

3. נוכחות ועדכון שיעורים
היעדרות מראש מחייבת הודעה 24 שעות מראש. שיעורים שלא בוצעו עקב היעדרות ללא הודעה מראש לא יפוצו. הקונסרבטוריון יעשה מאמץ לתזמן שיעורי פיצוי במקרה של היעדרות המורה.

4. כללי התנהגות
הכוח המוזיקלי שלנו מבוסס על כבוד הדדי בין תלמידים, מורים וצוות הקונסרבטוריון. כל התלמידים מחויבים לנהוג בכבוד ובנימוס. התנהגות בלתי הולמת עלולה לגרום להפסקת הלימודים ללא החזר כספי.

5. שימוש בציוד הקונסרבטוריון
תלמידים המשתמשים בכלים של הקונסרבטוריון אחראים לשמירה ולטיפול בהם. כל נזק שנגרם לציוד יחויב על חשבון ההורים.

6. צילום ופרסום
הקונסרבטוריון עשוי לצלם ולהקליט הופעות ואירועים לצרכים פנימיים ופרסומיים. הסכמה לתנאים אלו מהווה הסכמה לשימוש בתמונות ובהקלטות.

7. מדיניות ביטול
ביטול הרשמה חייב להיעשות בכתב. ביטולים שנעשו פחות מ-14 יום לפני תחילת הסמסטר לא יזכו בהחזר. ביטולים בתוך סמסטר יזכו בהחזר יחסי.

8. פרטיות ואבטחת מידע
המידע האישי שנמסר בטופס זה ישמש לצרכי ניהול ותקשורת בקונסרבטוריון בלבד, ולא יועבר לגורמים שלישיים ללא הסכמה מפורשת.

9. שינויים בתכנית הלימודים
הקונסרבטוריון שומר לעצמו את הזכות לשנות מורים, ימים ושעות לימוד בהתאם לצרכים ארגוניים. שינויים מהותיים יודיעו לפחות שבועיים מראש.

10. אישור ההורים
בהגשת טופס הרשמה זה, אנו מאשרים שקראנו והבנו את כל תנאי ההרשמה ואנו מסכימים להם במלואם.

— הגעת לסוף ההסכם, ניתן לאשר —`;

export default function AgreementScroll({ onAgree, agreed }) {
  const [canAgree, setCanAgree] = useState(false);

  function handleScroll(e) {
    const el = e.target;
    if (el.scrollHeight - el.scrollTop <= el.clientHeight + 15) {
      setCanAgree(true);
    }
  }

  return (
    <div className="space-y-4">
      <div
        onScroll={handleScroll}
        className="agreement-box h-52 overflow-y-auto rounded-xl p-4 text-sm leading-relaxed text-right"
        style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: '#CBD5E1',
        }}
        dir="rtl"
      >
        <pre className="whitespace-pre-wrap font-sans">{AGREEMENT_TEXT}</pre>
      </div>

      {!canAgree && (
        <p className="text-xs text-amber-400/80 flex items-center gap-1.5">
          <span>⬇️</span> גלול עד סוף ההסכם כדי לאשר
        </p>
      )}

      <label
        className={`flex items-center gap-3 cursor-pointer p-3 rounded-xl border transition-all ${
          agreed
            ? 'border-purple-500/50 bg-purple-500/10'
            : canAgree
            ? 'border-white/15 bg-white/5 hover:border-white/25'
            : 'border-white/5 bg-white/3 opacity-40 cursor-not-allowed'
        }`}
      >
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => canAgree && onAgree(e.target.checked)}
          disabled={!canAgree}
          className="w-4 h-4 accent-purple-500"
        />
        <span className="text-sm font-medium text-slate-300">
          קראתי ואני מסכים/ה לתנאי ההרשמה
        </span>
        {agreed && <span className="mr-auto text-purple-400">✓</span>}
      </label>
    </div>
  );
}
