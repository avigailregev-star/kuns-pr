import { getLessonDuration } from './lessonDuration';

function toMins(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

const DAY_TO_HEBREW = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז'];

export async function buildUsedMinutesMap(supabase) {
  const map = {};

  const { data: assignments, error } = await supabase
    .from('registrations')
    .select('teacher, assigned_day, selected_course, status, registration_status, group_id')
    .not('assigned_day', 'is', null)
    .not('teacher', 'is', null);

  const syncedGroupIds = new Set();

  if (!error && assignments) {
    const excluded = ['בוטל', 'ממתין לשיחת היכרות', 'רשימת המתנה', 'נדחה'];
    const filtered = assignments.filter(r =>
      !excluded.includes(r.status) && r.registration_status !== 'Cancelled'
    );

    // ספור כל שילוב ייחודי של מורה+יום+שעה פעם אחת (קבוצות עם כמה תלמידים לא נספרות כפולה)
    const seenSlots = new Set();
    for (const reg of filtered) {
      if (reg.group_id) syncedGroupIds.add(reg.group_id);
      const slotKey = `${reg.teacher}|${reg.assigned_day}|${reg.assigned_time ?? ''}`;
      if (seenSlots.has(slotKey)) continue;
      seenSlots.add(slotKey);
      if (!map[reg.teacher]) map[reg.teacher] = {};
      if (!map[reg.teacher][reg.assigned_day]) map[reg.teacher][reg.assigned_day] = 0;
      map[reg.teacher][reg.assigned_day] += getLessonDuration(reg.selected_course);
    }
  }

  const { data: groups } = await supabase
    .from('groups')
    .select('id, lesson_type, teacher_id, teachers(name, available_hours, teacher_availability_ranges(day_of_week, start_time, end_time)), group_schedules(day_of_week, start_time, end_time)')
    .not('teacher_id', 'is', null);

  for (const group of (groups || [])) {
    if (syncedGroupIds.has(group.id)) continue;
    const teacherName = group.teachers?.name;
    if (!teacherName) continue;

    const availByDay = {};
    for (const range of (group.teachers?.teacher_availability_ranges || [])) {
      availByDay[range.day_of_week] = { start_time: range.start_time, end_time: range.end_time };
    }

    const lt = group.lesson_type;
    const groupDuration = (lt === 'individual_45' || lt === 'melodies_individual') ? 45 : 60;

    for (const sched of (group.group_schedules || [])) {
      if (!sched.start_time) continue;

      let avail = availByDay[sched.day_of_week];

      if (!avail?.start_time || !avail?.end_time) {
        const hDay = DAY_TO_HEBREW[sched.day_of_week];
        const hours = group.teachers?.available_hours?.[hDay];
        if (hours?.from && hours?.to) {
          avail = { start_time: hours.from, end_time: hours.to };
        }
      }

      if (!avail?.start_time || !avail?.end_time) continue;

      const groupEnd = sched.end_time ?? (() => {
        const endMins = toMins(sched.start_time) + groupDuration;
        return `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`;
      })();
      const overlapStart = Math.max(toMins(sched.start_time), toMins(avail.start_time));
      const overlapEnd   = Math.min(toMins(groupEnd), toMins(avail.end_time));
      const overlapMins  = Math.max(0, overlapEnd - overlapStart);
      if (overlapMins === 0) continue;

      if (!map[teacherName]) map[teacherName] = {};
      if (!map[teacherName][sched.day_of_week]) map[teacherName][sched.day_of_week] = 0;
      map[teacherName][sched.day_of_week] += overlapMins;
    }
  }

  return map;
}

export function freeMinutesOnDay(availableHours, day, usedMinutes) {
  const hours = availableHours?.[day];
  if (!hours?.from || !hours?.to) return 0;
  const [fh, fm] = hours.from.split(':').map(Number);
  const [th, tm] = hours.to.split(':').map(Number);
  const total = (th * 60 + tm) - (fh * 60 + fm);
  return total - (usedMinutes || 0);
}