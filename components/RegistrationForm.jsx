'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import InstrumentPicker from './InstrumentPicker';
import DaysPicker from './DaysPicker';
import AgreementScroll from './AgreementScroll';
import { getPaymentLink, getCoursePrice, COURSE_GROUPS, PAYMENT_LINKS } from '../lib/paymentLinks';

const MELODIES_COURSE_NAMES = Object.keys(PAYMENT_LINKS).filter((name) => name.includes('מנגינות'));

const PROGRAM_CATEGORIES = [
  { value: 'melodies',      label: 'מנגינות (שנה א, ב, ג)', desc: 'תוכנית שעות בית הספר' },
  { value: 'conservatory',  label: 'קונסרבטוריון',           desc: 'לימודי כלי נגינה פרטיים' },
];

const CONSERVATORY_TYPES = [
  { value: 'new',      label: 'מתחיל/ה',      desc: 'תלמיד/ה חדש/ה ללימודי כלי נגינה' },
  { value: 'continue', label: 'ממשיך/ה',       desc: 'המשך לימודים מהשנה הקודמת' },
  { value: 'adult',    label: 'בוגר/ת',        desc: 'מבוגרים המעוניינים ללמוד' },
  { value: 'trial',    label: 'שיעור ניסיון',  desc: 'שיעור אחד לפני הרשמה' },
];

const GRADE_OPTIONS = [
  'גן', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב',
];

// עדכן רשימה זו עם שמות בתי הספר הרלוונטיים
const SCHOOL_OPTIONS = [
  // 'שם בית ספר 1',
  // 'שם בית ספר 2',
  'אחר',
];

const SLOT_OPTIONS = [
  'ימי א׳ בין 16:00–19:00',
  'ימי ב׳ בין 15:00–18:00',
  'ימי ג׳ בין 16:00–19:00',
  'ימי ד׳ בין 15:00–18:00',
  'ימי ה׳ בין 16:00–19:00',
  'ימי ו׳ בין 09:00–13:00',
];

const STEP_DEFS = {
  personal:   { label: 'פרטים',    icon: '👤' },
  instrument: { label: 'כלי נגינה', icon: '🎸' },
  course:     { label: 'קורס',     icon: '🎼' },
  days:       { label: 'זמינות',   icon: '📅' },
  agreement:  { label: 'הסכם',     icon: '📋' },
};

const FLOWS = {
  trial:    ['personal', 'instrument'],
  new:      ['personal', 'course',     'agreement'],
  adult:    ['personal', 'instrument', 'agreement'],
  continue: ['personal', 'course',     'agreement'],
  melodies: ['personal', 'course',     'agreement'],
};

const DAYS_HE = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];

export default function RegistrationForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [teachersList, setTeachersList] = useState([]);
  const [programCategory, setProgramCategory] = useState('conservatory');

  useEffect(() => {
    fetch('/api/teachers/public')
      .then(r => r.json())
      .then(j => setTeachersList(j.data || []))
      .catch(() => {});
  }, []);

  const [form, setForm] = useState({
    studentName: '',
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    type: 'new',
    birthdate: '',
    grade: '',
    schoolName: '',
    hasAccommodations: false,
    orchestra_confirmed: false,
    attendedOpenDay: null,
    instruments: [],
    selectedCourse: '',
    continueTeacher: '',
    continueDay: '',
    continueTime: '',
    unavailableDays: [],
    preferredSlot: '',
    agreed: false,
  });

  const steps = FLOWS[form.type].map((id) => ({ id, ...STEP_DEFS[id] }));
  const currentStepId = steps[step]?.id;
  const isInterviewFlow = form.type === 'new' && form.attendedOpenDay === false;
  const isYearA = form.selectedCourse?.includes("שנה א'");
  const showOrchestraCheckbox = (form.type === 'continue' || form.type === 'melodies') && !isYearA;

  function update(field, value) {
    if (field === 'type') setStep(0);
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function validateStep() {
    if (currentStepId === 'personal') {
      if (!form.studentName.trim()) return 'יש להזין שם תלמיד/ה';
      if (!form.parentName.trim())  return 'יש להזין שם הורה';
      if (!form.parentPhone.trim()) return 'יש להזין מספר טלפון';
      if (!form.parentEmail.trim() || !form.parentEmail.includes('@'))
        return 'יש להזין כתובת אימייל תקינה';
      if (form.type === 'new' && form.attendedOpenDay === null)
        return 'יש לענות על שאלת יום הפתוח';
    }
    if (currentStepId === 'instrument' && !isInterviewFlow) {
      if (form.instruments.length === 0) return 'יש לבחור לפחות כלי נגינה אחד';
      if (form.type !== 'trial' && !form.preferredSlot) return 'יש לבחור מועד רצוי לשיחה טלפונית';
    }
    if (currentStepId === 'course' && !isInterviewFlow) {
      if (!form.selectedCourse) return 'יש לבחור קורס';
      if ((form.type === 'continue' || form.type === 'new') && !form.continueTeacher && !form.preferredSlot)
        return 'יש לבחור מורה או מועד רצוי לשיחה טלפונית';
      if (showOrchestraCheckbox && !form.orchestra_confirmed) return 'יש לאשר השתתפות בתזמורת';
    }
    if (currentStepId === 'agreement') {
      if (!form.agreed) return 'יש לקרוא ולאשר את ההסכם';
    }
    if (form.type === 'new' && form.attendedOpenDay === false && currentStepId !== 'personal') {
      if (!form.preferredSlot) return 'יש לבחור מועד לשיחת היכרות';
    }
    return '';
  }

  function nextStep() {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError('');

    // New student who didn't attend open day — skip to interview submit screen
    if (form.type === 'new' && form.attendedOpenDay === false && currentStepId === 'personal') {
      setStep(1);
      return;
    }

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

      const params = new URLSearchParams();
      if (form.type === 'new' && form.attendedOpenDay === false) {
        params.set('type', 'interview');
      } else {
        params.set('type', form.type);
        if (form.type !== 'trial') {
          const paymentUrl = getPaymentLink(form.selectedCourse);
          if (paymentUrl) params.set('paymentUrl', paymentUrl);
        }
      }
      router.push(`/thank-you?${params.toString()}`);
    } catch {
      setError('אירעה שגיאת רשת. בדוק את החיבור ונסה שוב.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-1 mb-8">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
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
            {i < steps.length - 1 && (
              <div className={`w-8 h-px mx-1 mb-4 transition-all ${i < step ? 'bg-purple-500' : 'bg-white/10'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit}>
        <div className="glass p-6 sm:p-8 step-enter">

          {/* ── Personal Details ── */}
          {currentStepId === 'personal' && (
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="field-label">תאריך לידה</label>
                  <input type="date" className="form-input" value={form.birthdate}
                    onChange={(e) => update('birthdate', e.target.value)} dir="ltr" />
                </div>
                <div>
                  <label className="field-label">כיתה</label>
                  <select className="form-input" value={form.grade}
                    onChange={(e) => update('grade', e.target.value)}>
                    <option value="">— בחרו כיתה —</option>
                    {GRADE_OPTIONS.map((g) => (
                      <option key={g} value={g}>כיתה {g}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="field-label">שם בית הספר</label>
                <select className="form-input" value={form.schoolName}
                  onChange={(e) => update('schoolName', e.target.value)}>
                  <option value="">— בחרו בית ספר —</option>
                  {SCHOOL_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5">
                <input
                  type="checkbox"
                  id="hasAccommodations"
                  checked={form.hasAccommodations}
                  onChange={(e) => update('hasAccommodations', e.target.checked)}
                  className="w-5 h-5 rounded accent-purple-500 cursor-pointer"
                />
                <label htmlFor="hasAccommodations" className="text-sm text-slate-300 cursor-pointer select-none">
                  לתלמיד/ה מגיע התאמות
                </label>
              </div>

              <div>
                <label className="field-label">סוג הרשמה</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {PROGRAM_CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => {
                        setProgramCategory(cat.value);
                        if (cat.value === 'melodies') {
                          update('type', 'melodies');
                        } else {
                          update('type', 'new');
                        }
                      }}
                      className={`p-3 rounded-xl border text-right transition-all duration-200 ${
                        programCategory === cat.value
                          ? 'border-purple-400/70 bg-purple-500/15 text-white'
                          : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20'
                      }`}
                    >
                      <div className="text-sm font-semibold">{cat.label}</div>
                      <div className="text-xs opacity-60 mt-0.5">{cat.desc}</div>
                    </button>
                  ))}
                </div>

                {programCategory === 'conservatory' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                    {CONSERVATORY_TYPES.map((t) => (
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
                )}
              </div>

              {form.type === 'new' && (
                <div>
                  <label className="field-label">האם השתתפת ביום הפתוח? *</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {[
                      { value: true,  label: 'כן', desc: 'השתתפתי ביום הפתוח' },
                      { value: false, label: 'לא', desc: 'לא הגעתי ליום הפתוח' },
                    ].map((opt) => (
                      <button
                        key={String(opt.value)}
                        type="button"
                        onClick={() => update('attendedOpenDay', opt.value)}
                        className={`p-3 rounded-xl border text-right transition-all duration-200 ${
                          form.attendedOpenDay === opt.value
                            ? 'border-purple-400/70 bg-purple-500/15 text-white'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20'
                        }`}
                      >
                        <div className="text-sm font-semibold">{opt.label}</div>
                        <div className="text-xs opacity-60 mt-0.5">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Interview Scheduling (new student, no open day) ── */}
          {form.type === 'new' && form.attendedOpenDay === false && currentStepId !== 'personal' && (
            <div className="space-y-6">
              <div className="mb-4 p-4 rounded-xl border border-purple-400/30 bg-purple-500/10">
                <div className="text-2xl mb-2 text-center">📞</div>
                <h2 className="text-lg font-bold text-white mb-2 text-center">תיאום שיחת היכרות</h2>
                <p className="text-slate-300 text-sm text-center leading-relaxed">
                  כדי להירשם, יש לקיים תחילה שיחת היכרות עם המזכירה.
                  <br />אנא בחר/י מועד מועדף:
                </p>
              </div>
              <div>
                <label className="field-label">מועד מועדף לשיחה *</label>
                <select
                  className="form-input mt-1"
                  value={form.preferredSlot}
                  onChange={(e) => update('preferredSlot', e.target.value)}
                >
                  <option value="">— בחרו מועד —</option>
                  {SLOT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* ── Instrument Picker ── */}
          {currentStepId === 'instrument' && !isInterviewFlow && (
            <div className="space-y-6">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white mb-1">כלי נגינה</h2>
                <p className="text-slate-400 text-sm">בחרו את הכלים שמעניינים אתכם</p>
              </div>

              <InstrumentPicker value={form.instruments} onChange={(v) => update('instruments', v)} />

              {form.instruments.length > 0 && (
                <p className="text-xs text-purple-300">נבחרו: {form.instruments.join(', ')}</p>
              )}

              {form.type !== 'trial' && (
                <div>
                  <label className="field-label">מועד רצוי לשיחה טלפונית *</label>
                  <select className="form-input mt-1" value={form.preferredSlot}
                    onChange={(e) => update('preferredSlot', e.target.value)}>
                    <option value="">— בחרו מועד מועדף —</option>
                    {SLOT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              )}

            </div>
          )}

          {/* ── Course Picker ── */}
          {currentStepId === 'course' && !isInterviewFlow && (
            <div className="space-y-6">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white mb-1">
                  {form.type === 'melodies' ? 'בחירת תוכנית מנגינות' : 'בחירת קורס'}
                </h2>
                <p className="text-slate-400 text-sm">
                  {form.type === 'melodies'
                    ? 'בחרו את תוכנית מנגינות המתאימה לבית הספר'
                    : 'בחרו את הקורס שבו תרצו להמשיך'}
                </p>
              </div>

              <div>
                <label className="field-label">קורס *</label>
                <select
                  className="form-input mt-1"
                  value={form.selectedCourse}
                  onChange={(e) => update('selectedCourse', e.target.value)}
                >
                  <option value="">— בחרו קורס —</option>
                  {form.type === 'melodies' ? (
                    MELODIES_COURSE_NAMES.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))
                  ) : (
                    COURSE_GROUPS.flatMap((group) => [
                      <option key={`__header__${group.label}`} disabled>── {group.label} ──</option>,
                      ...group.courses.map((name) => (
                        <option key={name} value={name}>&nbsp;&nbsp;{name}</option>
                      )),
                    ])
                  )}
                </select>
              </div>

              {form.selectedCourse && getCoursePrice(form.selectedCourse) && (
                <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)' }}>
                  <span className="text-sm text-slate-300">עלות שנתית:</span>
                  <span className="text-lg font-bold text-purple-300">{getCoursePrice(form.selectedCourse)}</span>
                </div>
              )}

              {showOrchestraCheckbox && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.orchestra_confirmed}
                    onChange={(e) => update('orchestra_confirmed', e.target.checked)}
                    className="w-4 h-4 rounded accent-purple-500"
                  />
                  <span className="text-sm text-slate-200">אני מאשר/ת השתתפות בתזמורת *</span>
                </label>
              )}

              {(form.type === 'continue' || form.type === 'new') && (
                <div className="space-y-4 pt-2 border-t border-white/10">
                  <div>
                    <label className="field-label">שם המורה שלי</label>
                    <select className="form-input mt-1" value={form.continueTeacher}
                      onChange={(e) => { update('continueTeacher', e.target.value); update('continueDay', ''); update('continueTime', ''); }}>
                      <option value="">— בחרו מורה (אופציונלי) —</option>
                      {teachersList.map(t => (
                        <option key={t.id} value={t.name}>{t.name}{t.instrument_type ? ` (${t.instrument_type})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  {form.continueTeacher && (() => {
                    const teacher = teachersList.find(t => t.name === form.continueTeacher);
                    const days = teacher?.available_days || [];
                    const hours = teacher?.available_hours || {};
                    return days.length > 0 ? (
                      <div className="space-y-3">
                        <label className="field-label">יום השיעור הקבוע</label>
                        <div className="grid grid-cols-3 gap-2">
                          {days.map(d => (
                            <button key={d} type="button"
                              onClick={() => { update('continueDay', d); update('continueTime', ''); }}
                              className={`p-2 rounded-xl border text-sm text-center transition-all ${
                                form.continueDay === d
                                  ? 'border-purple-400/70 bg-purple-500/15 text-white'
                                  : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20'
                              }`}>
                              <div className="font-semibold">יום {d}</div>
                              {hours[d] && <div className="text-xs opacity-70 mt-0.5">{hours[d].from}–{hours[d].to}</div>}
                            </button>
                          ))}
                        </div>
                        {form.continueDay && (
                          <div>
                            <label className="field-label">שעת השיעור</label>
                            <input type="time" className="form-input mt-1" value={form.continueTime}
                              min={hours[form.continueDay]?.from}
                              max={hours[form.continueDay]?.to}
                              onChange={(e) => update('continueTime', e.target.value)} />
                            {hours[form.continueDay] && (
                              <p className="text-xs text-slate-500 mt-1">שעות פנויות: {hours[form.continueDay].from}–{hours[form.continueDay].to}</p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <label className="field-label">מועד רצוי לשיחה טלפונית *</label>
                        <select className="form-input mt-1" value={form.preferredSlot}
                          onChange={(e) => update('preferredSlot', e.target.value)}>
                          <option value="">— בחרו מועד מועדף —</option>
                          {SLOT_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })()}

                  {!form.continueTeacher && (
                    <div>
                      <label className="field-label">מועד רצוי לשיחה טלפונית *</label>
                      <select className="form-input mt-1" value={form.preferredSlot}
                        onChange={(e) => update('preferredSlot', e.target.value)}>
                        <option value="">— בחרו מועד מועדף —</option>
                        {SLOT_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Unavailable Days ── */}
          {currentStepId === 'days' && !isInterviewFlow && (
            <div className="space-y-5">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white mb-1">ימים לא זמינים</h2>
                <p className="text-slate-400 text-sm">סמנו ימים שבהם לא תוכלו להגיע לשיעורים (לא חובה)</p>
              </div>

              <DaysPicker value={form.unavailableDays} onChange={(v) => update('unavailableDays', v)} />

              {form.unavailableDays.length === 0 ? (
                <p className="text-xs text-slate-500 text-center mt-4">לא נבחרו ימים — גמישות מלאה ✓</p>
              ) : (
                <p className="text-xs text-red-400/80 text-center">
                  לא זמינים: {form.unavailableDays.map((d) => `יום ${d}`).join(', ')}
                </p>
              )}
            </div>
          )}

          {/* ── Agreement ── */}
          {currentStepId === 'agreement' && !isInterviewFlow && (
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

          {step < steps.length - 1 && !(isInterviewFlow && step > 0) ? (
            <button type="button" onClick={nextStep} className="btn-primary flex-1">
              המשך ←
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading || (currentStepId === 'agreement' && !form.agreed)}
              className="btn-primary flex-1"
              style={{ background: 'linear-gradient(135deg, #059669 0%, #0891B2 100%)' }}
            >
              {loading ? '⏳ שולח...' : '✅ שלח הרשמה'}
            </button>
          )}
        </div>

        <p className="text-center text-xs text-slate-600 mt-4">
          שלב {step + 1} מתוך {steps.length}
        </p>
      </form>
    </div>
  );
}
