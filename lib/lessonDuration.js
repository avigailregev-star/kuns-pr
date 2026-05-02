export function getLessonDuration(courseName) {
  if (!courseName) return 45;
  if (courseName.includes('60')) return 60;
  return 45;
}
