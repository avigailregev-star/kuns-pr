import { LESSON_TYPE_OPTIONS, getLessonTypeValue, computeGroupName } from './groupNaming';

describe('LESSON_TYPE_OPTIONS', () => {
  test('has exactly 11 options in the required order', () => {
    expect(LESSON_TYPE_OPTIONS.map(o => o.label)).toEqual([
      'פרטני 45 דקות',
      'פרטני 60 דקות',
      'שיעור זוגי אליטה',
      'תזמורת',
      'מקהלה ב-ו',
      'מקהלה הזמיר',
      'מקהלה בוגרים',
      'תיאוריה',
      'מנגינות שנה ב',
      'מנגינות שנה ג',
      'מנגינות שנה ד',
    ]);
  });
});

describe('getLessonTypeValue', () => {
  test('maps individual durations to their own values', () => {
    expect(getLessonTypeValue('פרטני 45 דקות')).toBe('individual_45');
    expect(getLessonTypeValue('פרטני 60 דקות')).toBe('individual_60');
  });

  test('maps the three choir variants to the same "choir" value', () => {
    expect(getLessonTypeValue('מקהלה ב-ו')).toBe('choir');
    expect(getLessonTypeValue('מקהלה הזמיר')).toBe('choir');
    expect(getLessonTypeValue('מקהלה בוגרים')).toBe('choir');
  });

  test('maps the three melodies years to the same "melodies_individual" value', () => {
    expect(getLessonTypeValue('מנגינות שנה ב')).toBe('melodies_individual');
    expect(getLessonTypeValue('מנגינות שנה ג')).toBe('melodies_individual');
    expect(getLessonTypeValue('מנגינות שנה ד')).toBe('melodies_individual');
  });

  test('maps orchestra, theory and elite duet', () => {
    expect(getLessonTypeValue('תזמורת')).toBe('orchestra');
    expect(getLessonTypeValue('תיאוריה')).toBe('theory');
    expect(getLessonTypeValue('שיעור זוגי אליטה')).toBe('elite_duet');
  });

  test('returns null for an unknown label', () => {
    expect(getLessonTypeValue('לא קיים')).toBeNull();
  });
});

describe('computeGroupName', () => {
  test('one student: appends the student name to the type label', () => {
    expect(computeGroupName('פרטני 45 דקות', ['יוסי כהן'])).toBe('פרטני 45 דקות - יוסי כהן');
  });

  test('multiple students: returns the type label alone', () => {
    expect(computeGroupName('מקהלה ב-ו', ['יוסי כהן', 'שרה לוי', 'מיכל אברהם'])).toBe('מקהלה ב-ו');
  });

  test('no students: returns the type label alone without throwing', () => {
    expect(computeGroupName('תזמורת', [])).toBe('תזמורת');
  });

  test('filters out empty/falsy names before counting', () => {
    expect(computeGroupName('פרטני 60 דקות', ['', 'יוסי כהן', null])).toBe('פרטני 60 דקות - יוסי כהן');
  });
});
