'use client';
import { useEffect, useRef, useState } from 'react';
import StatusSelect from './StatusSelect';
import { getLessonDuration } from '../lib/lessonDuration';
import { LESSON_TYPE_OPTIONS } from '../lib/groupNaming';
import { teacherCalendar, slotProblem, minutes, clockTime, dayNumber, WEEK_DAYS, PRIVATE_TYPES } from '../lib/teacherSchedulePicker';

export default function TeacherSchedulePicker({ row, rows, teachers, groups, onClose, onSave, onDelete, onUpdateStatus, onUpdatePaymentStatus }) {
  const linked = groups.find(g => String(g.id) === String(row.group_id));
  const schedule = linked?.group_schedules?.find(s => s.start_time);
  const initialStart = row.assigned_time || schedule?.start_time || '';
  const initialStartMinutes = minutes(initialStart);
  const initialEnd = row.assigned_end_time || schedule?.end_time || (initialStartMinutes == null ? '' : clockTime(initialStartMinutes + getLessonDuration(row.selected_course)));
  const [draft, setDraft] = useState({ ...row, assigned_day: dayNumber(row.assigned_day ?? schedule?.day_of_week), assigned_time: initialStart, assigned_end_time: initialEnd });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingAction, setUpdatingAction] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(row.registration_status || 'Pending');
  const [error, setError] = useState('');
  const dialog = useRef(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const teacher = teachers.find(t => t.name === draft.teacher);
  const calendar = teacherCalendar(teacher, rows, groups, row);
  const start = minutes(draft.assigned_time);
  const duration = getLessonDuration(draft.selected_course);
  const end = minutes(draft.assigned_end_time);
  const problem = !teacher ? 'יש לבחור מורה' : slotProblem(calendar, draft.assigned_day, start, end);
  async function save() {
    if (problem || saving) return;
    setSaving(true); setError('');
    try {
      if (await onSave(draft)) onClose();
      else setError('השמירה לא הושלמה. בדקי את השעה ונסי שוב.');
    } catch { setError('שגיאה בשמירה. נסי שוב.'); }
    finally { setSaving(false); }
  }
  async function removeLesson() {
    if (saving || deleting || !onDelete) return;
    setDeleting(true); setError('');
    try {
      if (await onDelete(row)) onClose();
      else setError('מחיקת השיעור לא הושלמה. נסי שוב.');
    } catch { setError('שגיאה במחיקת השיעור. נסי שוב.'); }
    finally { setDeleting(false); }
  }
  async function changeStatus(value) {
    if (!onUpdateStatus || updatingAction) return;
    setUpdatingAction(true); setError('');
    try {
      if (await onUpdateStatus(row.id, value)) setDraft(d => ({ ...d, status: value }));
      else setError('עדכון הסטטוס לא הושלם. נסי שוב.');
    } finally { setUpdatingAction(false); }
  }
  async function changePayment(value) {
    if (!onUpdatePaymentStatus || updatingAction) return;
    setUpdatingAction(true); setError('');
    try {
      if (await onUpdatePaymentStatus(row.id, value)) setPaymentStatus(value);
      else setError('עדכון התשלום לא הושלם. נסי שוב.');
    } finally { setUpdatingAction(false); }
  }
  return (
    <dialog ref={dialog} onCancel={e => { if (saving) e.preventDefault(); else onClose(); }} dir="rtl" className="w-[96vw] max-w-7xl max-h-[94vh] rounded-2xl p-0 shadow-2xl backdrop:bg-black/40">
      <div className="p-4 border-b flex justify-between items-center">
        <div><h2 className="text-xl font-bold">מערכת השעות של {draft.teacher || 'המורה'}</h2><p className="text-sm text-gray-500">{row.student_name} · בחירת שיבוץ</p></div>
        <button type="button" disabled={saving || deleting} onClick={onClose} aria-label="סגור מערכת שעות" className="px-3 py-2 rounded-lg border">סגור ×</button>
      </div>
      <div className="mx-4 mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <h3 className="font-semibold text-gray-800 mb-2">פרטי תלמיד/ה</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 text-sm text-gray-700">
          <p>👤 {row.parent_name || '—'}</p>
          <p dir="ltr" className="text-right">📞 {row.parent_phone || '—'}</p>
          <p>📧 {row.parent_email || '—'}</p>
          <p>🏫 בית ספר: {row.school_name || '—'}</p>
          <p>🎓 כיתה: {row.grade || '—'}</p>
          <p>🎂 תאריך לידה: {row.birthdate ? new Date(row.birthdate).toLocaleDateString('he-IL') : '—'}</p>
          <p>📅 שיחה טלפונית בזמן רצוי: {row.preferred_slot || '—'}</p>
          <p className="sm:col-span-2">🚫 ימים לא פנויים: {Array.isArray(row.unavailable_days) && row.unavailable_days.length ? row.unavailable_days.map(day => `יום ${day}`).join(', ') : 'ללא הגבלה'}</p>
        </div>
      </div>
      <div className="mx-4 mt-3 rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-800 mb-3">סטטוס ותשלום</h3>
        <div className="flex flex-wrap items-center gap-2">
          <StatusSelect value={draft.status} onChange={changeStatus} disabled={saving || deleting || updatingAction} />
          <button type="button" onClick={() => changePayment('Confirmed')} disabled={updatingAction || paymentStatus === 'Confirmed'} className="text-xs px-3 py-2 rounded-lg bg-green-100 text-green-800 disabled:opacity-40">✓ סמן כשולם</button>
          <button type="button" onClick={() => changePayment('Pending')} disabled={updatingAction || paymentStatus === 'Pending'} className="text-xs px-3 py-2 rounded-lg bg-amber-100 text-amber-800 disabled:opacity-40">↺ ממתין לתשלום</button>
          <button type="button" onClick={() => changePayment('Cancelled')} disabled={updatingAction || paymentStatus === 'Cancelled'} className="text-xs px-3 py-2 rounded-lg bg-gray-100 text-gray-700 disabled:opacity-40">✗ בטל תשלום</button>
        </div>
      </div>
      <div className="p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        <label className="text-sm">מורה<select className="admin-input mt-1" value={draft.teacher || ''} onChange={e => setDraft(d => ({ ...d, teacher: e.target.value, assigned_day: null, assigned_time: '', assigned_end_time: '' }))}><option value="">בחרי מורה</option>{teachers.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}</select></label>
        <label className="text-sm">סוג שיעור<select className="admin-input mt-1" value={draft.selected_course || ''} onChange={e => setDraft(d => { const nextDuration = getLessonDuration(e.target.value); const nextStart = minutes(d.assigned_time); return { ...d, selected_course: e.target.value, assigned_end_time: nextStart == null ? d.assigned_end_time : clockTime(nextStart + nextDuration) }; })}>
          <option value={row.selected_course || ''}>{row.selected_course || 'פרטני 45 דקות'}</option>
          {LESSON_TYPE_OPTIONS.filter(t => PRIVATE_TYPES.includes(t.value) && t.label !== row.selected_course).map(t => <option key={t.label}>{t.label}</option>)}
        </select></label>
        <label className="text-sm">יום<select className="admin-input mt-1" value={draft.assigned_day ?? ''} onChange={e => setDraft(d => ({ ...d, assigned_day: dayNumber(e.target.value) }))}><option value="">בחרי יום</option>{WEEK_DAYS.map((day,i) => <option key={day} value={i}>{day}</option>)}</select></label>
        <label className="text-sm">שעת התחלה<input type="time" dir="ltr" className="admin-input mt-1" value={draft.assigned_time?.slice(0,5) || ''} onChange={e => { const nextStart = minutes(e.target.value); setDraft(d => ({ ...d, assigned_time: e.target.value, assigned_end_time: nextStart == null ? '' : clockTime(nextStart + getLessonDuration(d.selected_course)) })); }} /></label>
        <label className="text-sm">שעת סיום<input type="time" dir="ltr" className="admin-input mt-1" value={draft.assigned_end_time?.slice(0,5) || ''} onChange={e => setDraft(d => ({ ...d, assigned_end_time: e.target.value }))} /></label>
      </div>
      <div className="px-4 pb-3 flex flex-wrap gap-4 text-sm"><span className="bg-gray-100 px-3 py-1 rounded">אפור — שעות זמינות</span><span className="bg-red-100 text-red-800 px-3 py-1 rounded">אדום — שיעור קיים</span><span>משך השיעור: {duration} דקות · ניתן לבחור חלון זמין ואז לדייק בשדות השעה</span></div>
      {!calendar.availability.length && <p className="mx-4 mb-3 p-3 bg-amber-50 text-amber-900 rounded-lg">לא הוגדרו שעות זמינות למורה. יש להגדיר אותן בלשונית מורים לפני שמירת שיבוץ.</p>}
      <div className="overflow-auto max-h-[40vh] border-y mx-4 p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 min-w-[760px]">
          {WEEK_DAYS.map((dayName, day) => {
            const events = calendar.events.filter(event => event.day === day).sort((a, b) => a.start - b.start);
            const ranges = calendar.availability.filter(range => range.day === day).sort((a, b) => a.start - b.start);
            const currentLessonIsOnDay = draft.assigned_day === day && start != null && end != null && end > start;
            const lessonCards = [
              ...events.map(event => ({ ...event, current: false })),
              ...(currentLessonIsOnDay ? [{ id: `current-${row.id}`, label: `השיעור הנוכחי · ${row.student_name}`, start, end, current: true }] : []),
            ].sort((a, b) => a.start - b.start);
            return <section key={dayName} className="rounded-xl border border-gray-200 p-2 bg-white">
              <h3 className="font-semibold text-center border-b pb-2 mb-2">{dayName}</h3>
              <div className="space-y-2">
                {lessonCards.map(lesson => <div key={lesson.id} className={`rounded-lg p-2 text-xs ${lesson.current ? 'border-2 border-purple-500 bg-purple-100 text-purple-950' : 'bg-red-100 text-red-900'}`}>
                  <span className="block font-semibold">{lesson.label}</span>
                  <span dir="ltr" className="block text-right">{clockTime(lesson.start)}–{clockTime(lesson.end)}</span>
                </div>)}
                {ranges.map((range, index) => {
                  const selected = draft.assigned_day === day && start != null && start >= range.start && end <= range.end;
                  return <button key={`${day}-${index}`} type="button" disabled={saving || updatingAction} onClick={() => setDraft(d => ({ ...d, assigned_day: day, assigned_time: clockTime(range.start), assigned_end_time: clockTime(range.start + getLessonDuration(d.selected_course)) }))} className={`w-full rounded-lg p-2 text-xs text-right ${selected ? 'ring-2 ring-purple-600 bg-purple-100' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    <span className="block font-semibold">שעות זמינות</span>
                    <span dir="ltr" className="block text-right">{clockTime(range.start)}–{clockTime(range.end)}</span>
                  </button>;
                })}
                {!currentLessonIsOnDay && !events.length && !ranges.length && <p className="text-xs text-gray-400 text-center py-3">אין שעות</p>}
              </div>
            </section>;
          })}
        </div>
      </div>
      <div className="p-4 flex flex-wrap items-center justify-between gap-4">
        <div aria-live="polite" className={`text-sm ${problem || error ? 'text-red-700' : 'text-gray-700'}`}>{error || problem || `זמין — יום ${WEEK_DAYS[draft.assigned_day]} ${clockTime(start)}–${clockTime(end)}`}</div>
        <div className="flex items-center gap-2">
          {onDelete && <button type="button" onClick={removeLesson} disabled={saving || deleting} className="px-4 py-2 rounded-lg border border-red-300 bg-white text-red-700 font-semibold disabled:opacity-40">{deleting ? 'מנקה…' : '🗑 נקה שיבוץ'}</button>}
          <button type="button" onClick={save} disabled={!!problem || saving || deleting} className="btn-primary px-8 disabled:opacity-40 shrink-0">{saving ? 'שומר…' : 'שמור'}</button>
        </div>
      </div>
    </dialog>
  );
}
