import { getLessonDuration } from './lessonDuration';

export const SLOT_MINUTES = 30;
const DEFAULT_RANGE_START = 8 * 60;
const DEFAULT_RANGE_END = 20 * 60;

export function timeToMins(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minsToTime(mins) {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

function floorToSlot(mins) {
  return Math.floor(mins / SLOT_MINUTES) * SLOT_MINUTES;
}

function ceilToSlot(mins) {
  return Math.ceil(mins / SLOT_MINUTES) * SLOT_MINUTES;
}

function assignColumnsForDay(dayLessons) {
  const sorted = [...dayLessons].sort((a, b) => a.startMins - b.startMins);
  const groups = [];
  let currentGroup = [];
  let currentEnd = -Infinity;

  for (const lesson of sorted) {
    if (currentGroup.length > 0 && lesson.startMins >= currentEnd) {
      groups.push(currentGroup);
      currentGroup = [];
      currentEnd = -Infinity;
    }
    currentGroup.push(lesson);
    currentEnd = Math.max(currentEnd, lesson.endMins);
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  const result = [];
  for (const group of groups) {
    const columnCount = group.length;
    const conflict = columnCount > 1;
    group.forEach((lesson, index) => {
      result.push({ ...lesson, columnIndex: index, columnCount, conflict });
    });
  }
  return result;
}

// A registration linked to an existing group (group_id) gets its real day/time
// from that group's schedule, not from its own assigned_day/assigned_time —
// same source of truth as TeachersTab's getEffectiveSchedule.
function resolveSchedule(r, groupsById) {
  const group = r.group_id != null ? groupsById[r.group_id] : null;
  const sched = group?.group_schedules?.find((sc) => sc.start_time) || group?.group_schedules?.[0];
  if (sched) return { day: sched.day_of_week, time: sched.start_time, endTime: sched.end_time };
  return { day: r.assigned_day, time: r.assigned_time, endTime: r.assigned_end_time };
}

export function buildScheduleGrid(registrations, { teacherName, blockedStatuses = [], groupsById = {} }) {
  const lessons = registrations
    .filter((r) => r.teacher === teacherName)
    .filter((r) => !blockedStatuses.includes(r.status))
    .map((r) => ({ r, sched: resolveSchedule(r, groupsById) }))
    .filter(({ sched }) => sched.day != null && sched.day !== '' && sched.time)
    .map(({ r, sched }) => {
      const startMins = timeToMins(sched.time);
      const durationMins = sched.endTime
        ? timeToMins(sched.endTime) - startMins
        : getLessonDuration(r.selected_course);
      return {
        id: r.id,
        day: Number(sched.day),
        startMins,
        endMins: startMins + durationMins,
        studentName: r.student_name,
        course: r.selected_course,
      };
    })
    .filter((l) => l.day >= 0 && l.day <= 5);

  let rangeStart = DEFAULT_RANGE_START;
  let rangeEnd = DEFAULT_RANGE_END;
  if (lessons.length > 0) {
    rangeStart = floorToSlot(Math.min(...lessons.map((l) => l.startMins)));
    rangeEnd = ceilToSlot(Math.max(...lessons.map((l) => l.endMins)));
  }

  const slots = [];
  for (let m = rangeStart; m < rangeEnd; m += SLOT_MINUTES) slots.push(m);

  const lessonsWithColumns = [];
  for (let day = 0; day <= 5; day++) {
    const dayLessons = lessons.filter((l) => l.day === day);
    lessonsWithColumns.push(...assignColumnsForDay(dayLessons));
  }

  return { slots, rangeStart, lessons: lessonsWithColumns };
}
