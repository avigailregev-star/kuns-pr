'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ThankYouContent() {
  const searchParams = useSearchParams();
  const paymentUrl = searchParams.get('paymentUrl');
  const isTrial = searchParams.get('type') === 'trial';

  return (
    <div className="relative z-10 glass p-10 max-w-md w-full text-center">
      <div className="text-6xl mb-5">{isTrial ? '🎵' : '🎉'}</div>
      <h1 className="text-3xl font-bold mb-3">
        <span className="gradient-text">
          {isTrial ? 'קיבלנו את בקשתך!' : 'הרשמתך התקבלה!'}
        </span>
      </h1>
      <p className="text-slate-400 mb-8 leading-relaxed">
        {isTrial
          ? 'תודה על התעניינותך בקונסרבטוריון המוזיקה.'
          : <>תודה על ההרשמה לקונסרבטוריון המוזיקה.<br />ניצור איתך קשר בהקדם לתיאום שיחת התאמה.</>
        }
      </p>

      <div className="text-right space-y-3 mb-8 p-4 rounded-xl" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
        <h3 className="font-semibold text-purple-300 mb-3">מה הלאה?</h3>

        {isTrial ? (
          <>
            <div className="flex items-start gap-3 text-sm text-slate-300">
              <span className="text-purple-400 mt-0.5">📞</span>
              <span>נחזור אליך בהקדם לתיאום שיעור הניסיון</span>
            </div>
            <div className="flex items-start gap-3 text-sm text-slate-300">
              <span className="text-purple-400 mt-0.5">🎵</span>
              <span>שיעור הניסיון אינו כרוך בתשלום</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3 text-sm text-slate-300">
              <span className="text-purple-400 mt-0.5">✉️</span>
              <span>שלחנו לך אישור לכתובת האימייל שסיפקת</span>
            </div>
            <div className="flex items-start gap-3 text-sm text-slate-300">
              <span className="text-purple-400 mt-0.5">📞</span>
              <span>נחזור אליך לשיחת התאמה במועד שבחרת</span>
            </div>
            <div className="flex items-start gap-3 text-sm text-slate-300">
              <span className="text-purple-400 mt-0.5">🎵</span>
              <span>לאחר השיחה נשבץ אותך לקבוצה המתאימה</span>
            </div>
          </>
        )}
      </div>

      {!isTrial && (
        <div className="flex items-center gap-2 p-3 rounded-xl mb-4 text-sm text-red-300" style={{ background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)' }}>
          <span>🗓️</span>
          <span>לא יחויב תשלום לפני ה-10 לספטמבר</span>
        </div>
      )}

      {paymentUrl && (
        <a
          href={paymentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary w-full block mb-6 text-center"
          style={{ background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)' }}
        >
          לתשלום דמי הרישום ושכר הלימוד ←
        </a>
      )}

      <Link href="/register" className="text-sm text-purple-400 hover:text-purple-300 transition">
        הרשמה נוספת ←
      </Link>
    </div>
  );
}

export default function ThankYouPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4">
      <div
        className="fixed inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=1920&q=80')",
        }}
      />
      <div className="fixed inset-0 hero-overlay" />
      <div className="fixed top-1/4 right-0 w-72 h-72 bg-purple-700 opacity-20 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 left-0 w-64 h-64 bg-emerald-600 opacity-15 rounded-full blur-3xl pointer-events-none" />

      <Suspense fallback={null}>
        <ThankYouContent />
      </Suspense>
    </div>
  );
}
