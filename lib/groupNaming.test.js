import { LESSON_TYPE_OPTIONS, getLessonTypeValue, computeGroupName, matchesLessonType } from './groupNaming';

describe('LESSON_TYPE_OPTIONS', () => {
  test('has exactly 16 options in the required order', () => {
    expect(LESSON_TYPE_OPTIONS.map(o => o.label)).toEqual([
      'פרטני 45 דקות',
      'פרטני 60 דקות',
      'שיעור זוגי אליטה',
      'מנגינות שנה ב',
      'מנגינות שנה ג',
      'מנגינות שנה ד',
      'תיאוריה',
      'מקהלה צעירה',
      'מקהלה צעירה ייצוגית',
      'הזמיר- מקהלה ייצוגית',
      'מקהלת קולות הנגב',
      'תזמורת נשיפה',
      'תזמורת כלי קשת',
      'אנסמבל מוזיקה מן המזרח א',
      'אנסמבל מוזיקה מן המזרח ב',
      'תזמורת מקאם דימונה',
    ]);
  });
});

describe('getLessonTypeValue', () => {
  test('maps individual durations to their own values', () => {
    expect(getLessonTypeValue('פרטני 45 דקות')).toBe('individual_45');
    expect(getLessonTypeValue('פרטני 60 דקות')).toBe('individual_60');
  });

  test('maps all four choir groups to the same "choir" value', () => {
    expect(getLessonTypeValue('מקהלה צעירה')).toBe('choir');
    expect(getLessonTypeValue('מקהלה צעירה ייצוגית')).toBe('choir');
    expect(getLessonTypeValue('הזמיר- מקהלה ייצוגית')).toBe('choir');
    expect(getLessonTypeValue('מקהלת קולות הנגב')).toBe('choir');
  });

  test('maps all five orchestra/ensemble groups to the same "orchestra" value', () => {
    expect(getLessonTypeValue('תזמורת נשיפה')).toBe('orchestra');
    expect(getLessonTypeValue('תזמורת כלי קשת')).toBe('orchestra');
    expect(getLessonTypeValue('אנסמבל מוזיקה מן המזרח א')).toBe('orchestra');
    expect(getLessonTypeValue('אנסמבל מוזיקה מן המזרח ב')).toBe('orchestra');
    expect(getLessonTypeValue('תזמורת מקאם דימונה')).toBe('orchestra');
  });

  test('maps the three melodies years to the same "melodies_individual" value', () => {
    expect(getLessonTypeValue('מנגינות שנה ב')).toBe('melodies_individual');
    expect(getLessonTypeValue('מנגינות שנה ג')).toBe('melodies_individual');
    expect(getLessonTypeValue('מנגינות שנה ד')).toBe('melodies_individual');
  });

  test('maps theory and elite duet', () => {
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
    expect(computeGroupName('מקהלה צעירה', ['יוסי כהן', 'שרה לוי', 'מיכל אברהם'])).toBe('מקהלה צעירה');
  });

  test('no students: returns the type label alone without throwing', () => {
    expect(computeGroupName('תזמורת נשיפה', [])).toBe('תזמורת נשיפה');
  });

  test('filters out empty/falsy names before counting', () => {
    expect(computeGroupName('פרטני 60 דקות', ['', 'יוסי כהן', null])).toBe('פרטני 60 דקות - יוסי כהן');
  });
});

describe('matchesLessonType', () => {
  test('exact match to a bare group label', () => {
    expect(matchesLessonType('מקהלה צעירה', 'מקהלה צעירה')).toBe(true);
  });

  test('matches an individual lesson named "<type> - <student>"', () => {
    expect(matchesLessonType('פרטני 45 דקות - אביגיל לויץ טסט', 'פרטני 45 דקות')).toBe(true);
  });

  test('does not match a different type', () => {
    expect(matchesLessonType('פרטני 60 דקות - דנה לוי', 'פרטני 45 דקות')).toBe(false);
  });

  test('does not false-match a label that is a text-prefix of a different real label', () => {
    // "מקהלה צעירה" is a substring-prefix of "מקהלה צעירה ייצוגית", a different type —
    // selecting the former must not pull in lessons of the latter.
    expect(matchesLessonType('מקהלה צעירה ייצוגית', 'מקהלה צעירה')).toBe(false);
  });

  test('does not match when no type is selected', () => {
    expect(matchesLessonType('פרטני 45 דקות - אביגיל לויץ טסט', '')).toBe(false);
  });
});
