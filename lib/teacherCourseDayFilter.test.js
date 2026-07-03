import { filterRangesByCourse } from './teacherCourseDayFilter';

describe('filterRangesByCourse', () => {
  const allRanges = [
    { day_of_week: 0, start_time: '14:00', end_time: '20:00' },
    { day_of_week: 1, start_time: '14:00', end_time: '20:00' },
    { day_of_week: 2, start_time: '15:30', end_time: '20:00' },
    { day_of_week: 4, start_time: '14:45', end_time: '20:00' },
  ];

  test('regular drums course keeps only Sunday (0) and Thursday (4)', () => {
    const result = filterRangesByCourse(allRanges, "תופים- נתנאל יחיא 45 דק'");
    expect(result.map(r => r.day_of_week)).toEqual([0, 4]);
  });

  test('regular guitar course keeps only Monday (1) and Tuesday (2)', () => {
    const result = filterRangesByCourse(allRanges, "גיטרה- נתנאל יחיא 45 דק'");
    expect(result.map(r => r.day_of_week)).toEqual([1, 2]);
  });

  test('melodies guitar course keeps only Monday (1) and Tuesday (2)', () => {
    const result = filterRangesByCourse(allRanges, "מנגינות שנה ב' - גיטרה- נתנאל יחיא");
    expect(result.map(r => r.day_of_week)).toEqual([1, 2]);
  });

  test('melodies djembe course keeps only Sunday (0) and Thursday (4)', () => {
    const result = filterRangesByCourse(allRanges, "מנגינות שנה ג' - דג'מבה- נתנאל יחיא");
    expect(result.map(r => r.day_of_week)).toEqual([0, 4]);
  });

  test('melodies djembe-and-percussion course keeps only Sunday (0) and Thursday (4)', () => {
    const result = filterRangesByCourse(allRanges, "מנגינות שנה ד' - דג'מבה וכלי הקשה- נתנאל יחיא");
    expect(result.map(r => r.day_of_week)).toEqual([0, 4]);
  });

  test('a course for a different teacher returns the ranges unchanged', () => {
    const result = filterRangesByCourse(allRanges, "פסנתר- מרינה גוטמן 45 דק'");
    expect(result).toBe(allRanges);
  });

  test('undefined selectedCourse returns the ranges unchanged', () => {
    const result = filterRangesByCourse(allRanges, undefined);
    expect(result).toBe(allRanges);
  });
});
