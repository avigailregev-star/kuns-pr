'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import InstrumentPicker from './InstrumentPicker';
import DaysPicker from './DaysPicker';
import AgreementScroll from './AgreementScroll';

const REGISTRATION_TYPES = [
  { value: 'new', label: 'תלמיד/ה חדש/ה', desc: 'מתחיל/ה ללמוד כלי נגינה' },
  { value: 'continue', label: 'תלמיד/ה ממשיך/ה', desc: 'המשך לימודים מהשנה הקודמת' },
  { value: 'adult', label: 'לומד/ת בוגר/ת', desc: 'מבוגרים המעוניינים ללמוד' },
  { value: 'trial', label: 'שיעור ניסיון', desc: 'שיעור אחד לפני הרשמה' },
];

const SLOT_OPTIONS = [
  'ימי א׳ בין 16:00–19:00',
  'ימי ב׳ בין 15:00–18:00',
  'ימי ג׳ בין 16:00–19:00',
  'ימי ד׳ בין 15:00–18:00',
  'ימי ה׳ בין 16:00–19:00',
  'ימי ו׳ בין 09:00–13:00',
];

const STEPS = [
  { label: 'פרטים', icon: '👤' },
  { label: 'כלי נגינה', icon: '🎸' },
  { label: 'זמינות', icon: '📅' },
  { label: 'הסכם', icon: '📋' },
];

export default function RegistrationForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    studentName: '',
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    type: 'new',
    instruments: [],
    unavailableDays: [],
    preferredSlot: '',
    agreed: false,
  });

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function validateStep() {
    if (step === 0) {
      if (!form.studentName.trim()) return 'יש להזין שם תלמיד/ה';
      if (!form.parentName.trim()) return 'יש להזין שם הורה';
      if (!form.parentPhone.trim()) return 'יש להזין מספר טלפון';
      if (!form.parentEmail.trim() || !form.parentEmail.includes('@'))
        return 'יש להזין כתובת אימייל תקינה';
    }
    if (step === 1) {
      if (form.instruments.length === 0) return 'יש לבחור לפחות כלי נגינה אחד';
      if (!form.preferredSlot) return 'יש לבחור מועד רצוי';
    }
    if (step === 3 && !form.agreed) return 'יש לקרוא ולאשר את ההסכם';
    return '';
  }

  function nextStep() {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError('');
    setStep((s) => s + 1);
  }

  function prevStep() {
    setError('');
    setStep((s) => s - 1);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const err = validateStep();
    if (err) { setError(err); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'אירעה שגיאה. נסה שוב.'); return; }
      router.push('/thank-you');
    } catch {
      setError('אירעה שגיאת רשת. בדוק את החיבור ונסה שוב.');
    } finally {
      setLoading(false);
    }
  }

  const selectedType = REGISTRATION_TYPES.find((t) => t.value === form.type);

  return (
    <div className="max-w-lg mx-auto">
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-1 mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center">
            <div className={`flex flex-col items-center gap-1`}>
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                  i < step
                    ? 'bg-gradient-to-br from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/30'
                    : i === step
                    ? 'bg-gradient-to-br from-purple-600 to-blue-600 text-white ring-2 ring-purple-400/50 ring-offset-2 ring-offset-transparent shadow-lg shadow-purple-500/40'
                    : 'bg-white/8 border border-white/15 text-slate-500'
                }`}
              >
                {i < step ? '✓' : s.icon}
              </div>
              <span className={`text-xs hidden sm:block font-medium ${i === step ? 'text-purple-300' : 'text-slate-600'}`}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-px mx-1 mb-4 transition-all ${i < step ? 'bg-purple-500' : 'bg-white/10'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit}>
        <div className="glass p-6 sm:p-8 step-enter">

          {/* ── Step 0: Personal Details ── */}
          {step === 0 && (
            <div className="space-y-5">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white mb-1">פרטים אישיים</h2>
                <p className="text-slate-400 text-sm">נא למלא את פרטי התלמיד/ה וההורה</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="field-label">שם התלמיד/ה *</label>
                  <input type="text" className="form-input" value={form.studentName}
                    onChange={(e) => update('studentName', e.target.value)} placeholder="שם פרטי ומשפחה" />
                </div>
                <div>
                  <label className="field-label">שם ההורה *</label>
                  <input type="text" className="form-input" value={form.parentName}
                    onChange={(e) => update('parentName', e.target.value)} placeholder="שם פרטי ומשפחה" />
                </div>
              </div>

              <div>
                <label className="field-label">טלפון *</label>
                <input type="tel" className="form-input" value={form.parentPhone}
                  onChange={(e) => update('parentPhone', e.target.value)} placeholder="05X-XXXXXXX" dir="ltr" />
              </div>

              <div>
                <label className="field-label">אימייל *</label>
                <input type="email" className="form-input" value={form.parentEmail}
                  onChange={(e) => update('parentEmail', e.target.value)} placeholder="example@email.com" dir="ltr" />
              </div>

              <div>
                <label className="field-label">סוג הרשמה</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {REGISTRATION_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => update('type', t.value)}
                      className={`p-3 rounded-xl border text-right transition-all duration-200 ${
                        form.type === t.value
                          ? 'border-purple-400/70 bg-purple-500/15 text-white'
                          : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20'
                      }`}
                    >
                      <div className="text-sm font-semibold">{t.label}</div>
                      <div className="text-xs opacity-60 mt-0.5">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 1: Instruments + Slot ── */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white mb-1">כלי נגינה</h2>
                <p className="text-slate-400 text-sm">בחרו את הכלים שמעניינים אתכם (ניתן לבחור מספר)</p>
              </div>

              <InstrumentPicker value={form.instruments} onChange={(v) => update('instruments', v)} />

              {form.instruments.length > 0 && (
                <p className="text-xs text-purple-300">
                  נבחרו: {form.instruments.join(', ')}
                </p>
              )}

              <div>
                <label className="field-label">מועד רצוי לשיחת התאמה *</label>
                <select className="form-input mt-1" value={form.preferredSlot}
                  onChange={(e) => update('preferredSlot', e.target.value)}>
                  <option value="">— בחרו מועד מועדף —</option>
                  {SLOT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* ── Step 2: Availability ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white mb-1">ימים לא זמינים</h2>
                <p className="text-slate-400 text-sm">סמנו ימים שבהם לא תוכלו להגיע לשיעורים (לא חובה)</p>
              </div>

              <DaysPicker value={form.unavailableDays} onChange={(v) => update('unavailableDays', v)} />

              {form.unavailableDays.length === 0 ? (
                <p className="text-xs text-slate-500 text-center mt-4">
                  לא נבחרו ימים — גמישות מלאה ✓
                </p>
              ) : (
                <p className="text-xs text-red-400/80 text-center">
                  לא זמינים: {form.unavailableDays.map((d) => `יום ${d}`).join(', ')}
                </p>
              )}
            </div>
          )}

          {/* ── Step 3: Agreement ── */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white mb-1">תקנון ותנאי הרשמה</h2>
                <p className="text-slate-400 text-sm">יש לקרוא את ההסכם עד הסוף לפני האישור</p>
              </div>
              <AgreementScroll agreed={form.agreed} onAgree={(v) => update('agreed', v)} />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-5 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3 mt-4">
          {step > 0 && (
            <button type="button" onClick={prevStep} className="btn-secondary flex-1">
              ← חזור
            </button>
          )}

          {step < STEPS.length - 1 ? (
            <button type="button" onClick={nextStep} className="btn-primary flex-1">
              המשך →
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading || !form.agreed}
              className="btn-primary flex-1"
              style={{ background: 'linear-gradient(135deg, #059669 0%, #0891B2 100%)' }}
            >
              {loading ? '⏳ שולח...' : '✅ שלח הרשמה'}
            </button>
          )}
        </div>

        <p className="text-center text-xs text-slate-600 mt-4">
          שלב {step + 1} מתוך {STEPS.length}
        </p>
      </form>
    </div>
  );
}
