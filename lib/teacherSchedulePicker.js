import { getLessonDuration } from './lessonDuration';
import { getGroupLessonDuration } from './teacherCapacity';

export const WEEK_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];
export const PRIVATE_TYPES = ['individual_45', 'individual_60', 'melodies_individual'];
const EXCLUDED = ['בוטל', 'נדחה', 'רשימת המתנה', 'ממתין לשיחת היכרות'];
export function dayNumber(value) {
  if (value == null || value === '') return null;
  const letters = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז'];
  const day = letters.includes(value) ? letters.indexOf(value) : Number(value);
  return Number.isInteger(day) && day >= 0 && day <= 6 ? day : null;
}
export function minutes(value) {
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(value || '')) return null;
  const [h, m] = value.split(':').map(Number);
  return h < 24 && m < 60 ? h * 60 + m : null;
}
export function clockTime(value) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
export function categoryGroups(groups, kind) {
  const types = kind === 'theory' ? ['theory'] : kind === 'ensemble' ? ['orchestra', 'choir'] : [];
  return groups.filter(g => types.includes(g.lesson_type)).sort((a, b) => a.name.localeCompare(b.name, 'he'));
}
export function teacherCalendar(teacher, rows, groups, currentRow) {
  const ranges = (teacher?.teacher_availability_ranges || []).map(r => ({
    day: dayNumber(r.day_of_week), start: minutes(r.start_time), end: minutes(r.end_time),
  }));
  if (!ranges.length) {
    for (const [day, range] of Object.entries(teacher?.available_hours || {})) {
      ranges.push({ day: dayNumber(day), start: minutes(range.from), end: minutes(range.to) });
    }
  }
  const availability = ranges.filter(r => r.day != null && r.day < WEEK_DAYS.length && r.start != null && r.end > r.start);
  const teacherGroups = groups.filter(g => String(g.teacher_id) === String(teacher?.id));
  const events = [];
  for (const g of teacherGroups) {
    const activeLinkedRows = rows.filter(r => String(r.group_id) === String(g.id) && !EXCLUDED.includes(r.status) && r.registration_status !== 'Cancelled');
    if (PRIVATE_TYPES.includes(g.lesson_type) && activeLinkedRows.length === 0) continue;
    // The current private lesson can move without conflicting with itself.
    if (String(g.id) === String(currentRow?.group_id) && PRIVATE_TYPES.includes(g.lesson_type) &&
      !rows.some(r => r.id !== currentRow.id && String(r.group_id) === String(g.id) && !EXCLUDED.includes(r.status) && r.registration_status !== 'Cancelled')) continue;
    for (const s of g.group_schedules || []) {
      const start = minutes(s.start_time);
      if (dayNumber(s.day_of_week) == null || dayNumber(s.day_of_week) >= WEEK_DAYS.length || start == null) continue;
      const label = PRIVATE_TYPES.includes(g.lesson_type)
        ? activeLinkedRows.map(row => row.student_name).filter(Boolean).join(', ') || g.name
        : g.name;
      events.push({ id: `${g.id}-${s.day_of_week}-${start}`, day: dayNumber(s.day_of_week), start,
        end: minutes(s.end_time) ?? start + getGroupLessonDuration(g.lesson_type), label });
    }
  }
  for (const r of rows) {
    if (r.id === currentRow?.id || r.teacher !== teacher?.name || EXCLUDED.includes(r.status) || r.registration_status === 'Cancelled') continue;
    const day = dayNumber(r.assigned_day), start = minutes(r.assigned_time);
    if (day == null || day >= WEEK_DAYS.length || start == null) continue;
    // A linked group already represents this registration in the calendar.
    if (teacherGroups.some(g => String(g.id) === String(r.group_id) && g.group_schedules?.some(s => dayNumber(s.day_of_week) === day && minutes(s.start_time) === start))) continue;
    events.push({ id: r.id, day, start, end: minutes(r.assigned_end_time) ?? start + getLessonDuration(r.selected_course), label: r.student_name });
  }
  return { availability, events };
}
export function slotProblem(calendar, day, start, end) {
  if (dayNumber(day) == null || Number(day) >= WEEK_DAYS.length || start == null || end == null || end <= start || end >= 1440) return 'יש לבחור יום ושעות תקינים';
  const conflict = calendar.events.find(e => e.day === Number(day) && start < e.end && e.start < end);
  if (conflict) return `חפיפה — ${conflict.label} (${clockTime(conflict.start)}–${clockTime(conflict.end)})`;
  if (!calendar.availability.some(r => r.day === Number(day) && start >= r.start && end <= r.end)) return 'מחוץ לשעות הזמינות של המורה';
  return '';
}
