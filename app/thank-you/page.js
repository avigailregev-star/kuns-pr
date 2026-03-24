import Link from 'next/link';

export const metadata = {
  title: 'הרשמה התקבלה | קונסרבטוריון',
};

export default function ThankYouPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center px-4">
      {/* Background */}
      <div
        className="fixed inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=1920&q=80')",
        }}
      />
      <div className="fixed inset-0 hero-overlay" />

      {/* Blobs */}
      <div className="fixed top-1/4 right-0 w-72 h-72 bg-purple-700 opacity-20 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 left-0 w-64 h-64 bg-emerald-600 opacity-15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 glass p-10 max-w-md w-full text-center">
        <div className="text-6xl mb-5">🎉</div>
        <h1 className="text-3xl font-bold mb-3">
          <span className="gradient-text">הרשמתך התקבלה!</span>
        </h1>
        <p className="text-slate-400 mb-8 leading-relaxed">
          תודה על ההרשמה לקונסרבטוריון המוזיקה.
          <br />
          ניצור איתך קשר בהקדם לתיאום שיחת התאמה.
        </p>

        <div className="text-right space-y-3 mb-8 p-4 rounded-xl" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
          <h3 className="font-semibold text-purple-300 mb-3">מה הלאה?</h3>
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
        </div>

        <Link href="/register" className="text-sm text-purple-400 hover:text-purple-300 transition">
          הרשמה נוספת ←
        </Link>
      </div>
    </div>
  );
}
