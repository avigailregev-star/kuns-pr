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

export function buildScheduleGrid(registrations, { teacherName, blockedStatuses = [] }) {
  const lessons = registrations
    .filter((r) => r.teacher === teacherName)
    .filter((r) => r.assigned_day != null && r.assigned_day !== '' && r.assigned_time)
    .filter((r) => !blockedStatuses.includes(r.status))
    .map((r) => {
      const startMins = timeToMins(r.assigned_time);
      const durationMins = r.assigned_end_time
        ? timeToMins(r.assigned_end_time) - startMins
        : getLessonDuration(r.selected_course);
      return {
        id: r.id,
        day: Number(r.assigned_day),
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
