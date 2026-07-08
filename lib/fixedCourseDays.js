export const FIXED_COURSE_DAYS = {
  "מקהלת צעירים ב-ו": 3, // יום רביעי
  "מקהלה צעירה": 3,       // יום רביעי (same choir, lesson-type label)
  "הזמיר": 1,             // יום שני
  "הזמיר- מקהלה ייצוגית": 1, // יום שני (same choir, lesson-type label)
};

// The teacher's own availability range for the fixed day covers her whole
// working day (e.g. also individual lessons before/after the choir), so it
// can't be used to derive the choir's actual meeting time. These are the
// real, fixed meeting times, kept independent of that range.
export const FIXED_COURSE_TIMES = {
  "מקהלת צעירים ב-ו": { start_time: '17:00', end_time: '18:30' },
  "מקהלה צעירה": { start_time: '17:00', end_time: '18:30' },
  "הזמיר": { start_time: '17:00', end_time: '19:00' },
  "הזמיר- מקהלה ייצוגית": { start_time: '17:00', end_time: '19:00' },
};

export function filterRangesToFixedDay(ranges, selectedCourse) {
  const fixedDay = FIXED_COURSE_DAYS[selectedCourse];
  if (fixedDay == null) return ranges;
  return ranges.filter((r) => r.day_of_week === fixedDay);
}
