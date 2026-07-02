// נקודתי: נתנאל יחיא מלמד תופים בימים ראשון וחמישי, וגיטרה בימים שני ושלישי.
// המפה הזו מסננת את ימי הזמינות המוצגים לפי הקורס שנבחר, רק עבורו.
export const TEACHER_COURSE_DAY_FILTER = {
  "תופים- נתנאל יחיא 45 דק'": [0, 4],
  "גיטרה- נתנאל יחיא 45 דק'": [1, 2],
};

export function filterRangesByCourse(ranges, selectedCourse) {
  const allowedDays = TEACHER_COURSE_DAY_FILTER[selectedCourse];
  if (!allowedDays) return ranges;
  return ranges.filter((r) => allowedDays.includes(r.day_of_week));
}
