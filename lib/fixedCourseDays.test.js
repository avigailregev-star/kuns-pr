import { FIXED_COURSE_DAYS, FIXED_COURSE_TIMES, filterRangesToFixedDay } from './fixedCourseDays';

describe('FIXED_COURSE_DAYS', () => {
  test('מקהלת צעירים ב-ו is fixed to Wednesday (3)', () => {
    expect(FIXED_COURSE_DAYS['מקהלת צעירים ב-ו']).toBe(3);
  });

  test('הזמיר is fixed to Monday (1)', () => {
    expect(FIXED_COURSE_DAYS['הזמיר']).toBe(1);
  });

  test('מקהלה צעירה (lesson-type label for the same choir) is fixed to Wednesday (3)', () => {
    expect(FIXED_COURSE_DAYS['מקהלה צעירה']).toBe(3);
  });

  test('הזמיר- מקהלה ייצוגית (lesson-type label for the same choir) is fixed to Monday (1)', () => {
    expect(FIXED_COURSE_DAYS['הזמיר- מקהלה ייצוגית']).toBe(1);
  });
});

describe('FIXED_COURSE_TIMES', () => {
  test('מקהלת צעירים ב-ו has a fixed time of 17:00–18:30, independent of the teacher\'s full-day availability window', () => {
    expect(FIXED_COURSE_TIMES['מקהלת צעירים ב-ו']).toEqual({ start_time: '17:00', end_time: '18:30' });
  });

  test('הזמיר has a fixed time of 17:00–19:00', () => {
    expect(FIXED_COURSE_TIMES['הזמיר']).toEqual({ start_time: '17:00', end_time: '19:00' });
  });

  test('מקהלה צעירה (lesson-type label) has the same fixed time as מקהלת צעירים ב-ו', () => {
    expect(FIXED_COURSE_TIMES['מקהלה צעירה']).toEqual({ start_time: '17:00', end_time: '18:30' });
  });

  test('הזמיר- מקהלה ייצוגית (lesson-type label) has the same fixed time as הזמיר', () => {
    expect(FIXED_COURSE_TIMES['הזמיר- מקהלה ייצוגית']).toEqual({ start_time: '17:00', end_time: '19:00' });
  });
});

describe('filterRangesToFixedDay', () => {
  const allRanges = [
    { day_of_week: 0, start_time: '14:00', end_time: '20:00' },
    { day_of_week: 1, start_time: '17:00', end_time: '19:00' },
    { day_of_week: 3, start_time: '17:00', end_time: '18:30' },
  ];

  test('הזמיר keeps only the Monday (1) range', () => {
    const result = filterRangesToFixedDay(allRanges, 'הזמיר');
    expect(result).toEqual([{ day_of_week: 1, start_time: '17:00', end_time: '19:00' }]);
  });

  test('מקהלת צעירים ב-ו keeps only the Wednesday (3) range', () => {
    const result = filterRangesToFixedDay(allRanges, 'מקהלת צעירים ב-ו');
    expect(result).toEqual([{ day_of_week: 3, start_time: '17:00', end_time: '18:30' }]);
  });

  test('מקהלה צעירה (lesson-type label) keeps only the Wednesday (3) range', () => {
    const result = filterRangesToFixedDay(allRanges, 'מקהלה צעירה');
    expect(result).toEqual([{ day_of_week: 3, start_time: '17:00', end_time: '18:30' }]);
  });

  test('הזמיר- מקהלה ייצוגית (lesson-type label) keeps only the Monday (1) range', () => {
    const result = filterRangesToFixedDay(allRanges, 'הזמיר- מקהלה ייצוגית');
    expect(result).toEqual([{ day_of_week: 1, start_time: '17:00', end_time: '19:00' }]);
  });

  test('a course with no fixed day returns the ranges unchanged', () => {
    const result = filterRangesToFixedDay(allRanges, "כינור- אביגיל לויץ 45 דק'");
    expect(result).toBe(allRanges);
  });

  test('undefined selectedCourse returns the ranges unchanged', () => {
    const result = filterRangesToFixedDay(allRanges, undefined);
    expect(result).toBe(allRanges);
  });
});
