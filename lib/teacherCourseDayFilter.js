const NETANEL_YAHYA_GUITAR_DAYS = [1, 2]; // שני, שלישי
const NETANEL_YAHYA_DRUMS_DAYS = [0, 4]; // ראשון, חמישי

export function filterRangesByCourse(ranges, selectedCourse) {
  if (!selectedCourse || !selectedCourse.includes('נתנאל יחיא')) return ranges;

  let allowedDays;
  if (selectedCourse.includes('גיטרה')) {
    allowedDays = NETANEL_YAHYA_GUITAR_DAYS;
  } else if (
    selectedCourse.includes('תופים') ||
    selectedCourse.includes("דג'מבה") ||
    selectedCourse.includes('כלי הקשה')
  ) {
    allowedDays = NETANEL_YAHYA_DRUMS_DAYS;
  }

  if (!allowedDays) return ranges;
  return ranges.filter((r) => allowedDays.includes(r.day_of_week));
}
