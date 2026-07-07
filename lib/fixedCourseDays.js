export const FIXED_COURSE_DAYS = {
  "מקהלת צעירים ב-ו": 3, // יום רביעי
  "הזמיר": 1,             // יום שני
};

export function filterRangesToFixedDay(ranges, selectedCourse) {
  const fixedDay = FIXED_COURSE_DAYS[selectedCourse];
  if (fixedDay == null) return ranges;
  return ranges.filter((r) => r.day_of_week === fixedDay);
}
