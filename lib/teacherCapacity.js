import { getLessonDuration } from './lessonDuration';

function toMins(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export async function buildUsedMinutesMap(supabase) {
  const map = {};

  // Individual lesson registrations
  const { data: assignments, error } = await supabase
    .from('registrations')
    .select('teacher, assigned_day, selected_course')
    .not('assigned_day', 'is', null)
    .not('teacher', 'is', null)
    .not('status', 'in', '("בוטל","ממתין לשיחת היכרות","רשימת המתנה","נדחה")');

  if (!error && assignments) {
    for (const reg of assignments) {
      if (!map[reg.teacher]) map[reg.teacher] = {};
      if (!map[reg.teacher][reg.assigned_day]) map[reg.teacher][reg.assigned_day] = 0;
      map[reg.teacher][reg.assigned_day] += getLessonDuration(reg.selected_course);
    }
  }

  // Group schedules — only count minutes that overlap with the teacher's availability window
  const { data: groups } = await supabase
    .from('groups')
    .select('teacher_id, teachers(name, teacher_availability_ranges(day_of_week, start_time, end_time)), group_schedules(day_of_week, start_time, end_time)')
    .not('teacher_id', 'is', null);

  for (const group of (groups || [])) {
    const teacherName = group.teachers?.name;
    if (!teacherName) continue;

    // Build availability map for this teacher: day_of_week → range
    const availByDay = {};
    for (const range of (group.teachers?.teacher_availability_ranges || [])) {
      availByDay[range.day_of_week] = range;
    }

    for (const sched of (group.group_schedules || [])) {
      if (!sched.start_time) continue;

      const avail = availByDay[sched.day_of_week];
      if (!avail?.start_time || !avail?.end_time) continue;

      // If end_time is missing, assume the group runs to the end of the availability window
      const groupEnd = sched.end_time ?? avail.end_time;

      // Only count the portion of the group that falls within the availability window
      const overlapStart = Math.max(toMins(sched.start_time), toMins(avail.start_time));
      const overlapEnd   = Math.min(toMins(groupEnd),          toMins(avail.end_time));
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
