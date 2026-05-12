import { getLessonDuration } from './lessonDuration';

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

  // Group schedules from the attendance app
  const { data: groups } = await supabase
    .from('groups')
    .select('teacher_id, teachers(name), group_schedules(day_of_week, start_time, end_time)')
    .not('teacher_id', 'is', null);

  for (const group of (groups || [])) {
    const teacherName = group.teachers?.name;
    if (!teacherName) continue;
    for (const sched of (group.group_schedules || [])) {
      if (!sched.start_time || !sched.end_time) continue;
      const [sh, sm] = sched.start_time.split(':').map(Number);
      const [eh, em] = sched.end_time.split(':').map(Number);
      const duration = (eh * 60 + em) - (sh * 60 + sm);
      if (!map[teacherName]) map[teacherName] = {};
      if (!map[teacherName][sched.day_of_week]) map[teacherName][sched.day_of_week] = 0;
      map[teacherName][sched.day_of_week] += duration;
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
