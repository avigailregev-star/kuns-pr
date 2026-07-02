import { filterRangesByCourse, TEACHER_COURSE_DAY_FILTER } from './teacherCourseDayFilter';

describe('filterRangesByCourse', () => {
  const allRanges = [
    { day_of_week: 0, start_time: '14:00', end_time: '20:00' },
    { day_of_week: 1, start_time: '14:00', end_time: '20:00' },
    { day_of_week: 2, start_time: '15:30', end_time: '20:00' },
    { day_of_week: 4, start_time: '14:45', end_time: '20:00' },
  ];

  test('drums course keeps only Sunday (0) and Thursday (4)', () => {
    const result = filterRangesByCourse(allRanges, "תופים- נתנאל יחיא 45 דק'");
    expect(result.map(r => r.day_of_week)).toEqual([0, 4]);
  });

  test('guitar course keeps only Monday (1) and Tuesday (2)', () => {
    const result = filterRangesByCourse(allRanges, "גיטרה- נתנאל יחיא 45 דק'");
    expect(result.map(r => r.day_of_week)).toEqual([1, 2]);
  });

  test('a course with no entry in the map returns the ranges unchanged', () => {
    const result = filterRangesByCourse(allRanges, "פסנתר- מרינה גוטמן 45 דק'");
    expect(result).toBe(allRanges);
  });

  test('undefined selectedCourse returns the ranges unchanged', () => {
    const result = filterRangesByCourse(allRanges, undefined);
    expect(result).toBe(allRanges);
  });

  test('map has exactly the two expected course keys', () => {
    expect(TEACHER_COURSE_DAY_FILTER).toEqual({
      "תופים- נתנאל יחיא 45 דק'": [0, 4],
      "גיטרה- נתנאל יחיא 45 דק'": [1, 2],
    });
  });
});
