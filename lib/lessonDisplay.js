// The assigned teacher is a separate field. Legacy lesson titles sometimes
// end with a teacher's name, which can become stale after reassignment.
export function displayLessonTitle(course, teacherNames = []) {
  if (!course) return '';
  const match = teacherNames
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .find(name => course.endsWith(name) && /[-–—]\s*$/.test(course.slice(0, -name.length)));
  return match ? course.slice(0, -match.length).replace(/\s*[-–—]\s*$/, '').trim() : course;
}
