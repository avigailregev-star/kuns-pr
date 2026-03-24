import RegistrationForm from '../../components/RegistrationForm';

export const metadata = {
  title: 'הרשמה לקונסרבטוריון',
};

export default function RegisterPage() {
  return (
    <div className="relative min-h-screen">
      {/* Hero Background */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=1920&q=80')",
        }}
      />
      {/* Dark overlay */}
      <div className="fixed inset-0 hero-overlay" />

      {/* Decorative blobs */}
      <div className="fixed top-0 right-0 w-96 h-96 bg-purple-700 opacity-20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-80 h-80 bg-blue-600 opacity-15 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 min-h-screen py-10 px-4">
        {/* Top Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 glass px-5 py-2 text-sm text-purple-300 mb-6 rounded-full">
            <span>🎵</span>
            <span>קונסרבטוריון המוזיקה</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-3 leading-tight">
            <span className="gradient-text">הרשמה לקונסרבטוריון</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-md mx-auto">
            מלאו את הטופס ונחזור אליכם בהקדם לתיאום שיחת היכרות
          </p>
        </div>

        <RegistrationForm />
      </div>
    </div>
  );
}
