import { getLessonDuration } from './lessonDuration';

export async function buildUsedMinutesMap(supabase) {
  const { data: assignments, error } = await supabase
    .from('registrations')
    .select('teacher, assigned_day, selected_course')
    .not('assigned_day', 'is', null)
    .not('teacher', 'is', null)
    .not('status', 'in', '("בוטל","ממתין לשיחת היכרות","רשימת המתנה")');

  if (error || !assignments) return {};

  const map = {};
  for (const reg of assignments) {
    if (!map[reg.teacher]) map[reg.teacher] = {};
    if (!map[reg.teacher][reg.assigned_day]) map[reg.teacher][reg.assigned_day] = 0;
    map[reg.teacher][reg.assigned_day] += getLessonDuration(reg.selected_course);
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
