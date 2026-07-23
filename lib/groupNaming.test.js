import {
  LESSON_TYPE_OPTIONS, getLessonTypeValue, computeGroupName, matchesLessonType,
  THEORY_LABEL, ENSEMBLE_LABELS, THEORY_LABELS, getAddonBadge,
  nextNumberedGroupName, matchesGroupLabel, groupBaseLabel,
} from './groupNaming';

describe('LESSON_TYPE_OPTIONS', () => {
  test('has exactly 18 options in the required order', () => {
    expect(LESSON_TYPE_OPTIONS.map(o => o.label)).toEqual([
      'פרטני 45 דקות',
      'פרטני 60 דקות',
      'שיעור זוגי אליטה',
      'מנגינות שנה ב',
      'מנגינות שנה ג',
      'מנגינות שנה ד',
      'תיאוריה',
      'פיתוח קשב',
      'קצב לכולם',
      'קומפוזיציה',
      'מקהלה צעירה',
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

  test('maps all three choir groups to the same "choir" value', () => {
    expect(getLessonTypeValue('מקהלה צעירה')).toBe('choir');
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

  test('maps the three new theory sub-types to "theory"', () => {
    expect(getLessonTypeValue('פיתוח קשב')).toBe('theory');
    expect(getLessonTypeValue('קצב לכולם')).toBe('theory');
    expect(getLessonTypeValue('קומפוזיציה')).toBe('theory');
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

  test('does not false-match a label that is a text-prefix superstring', () => {
    // "מקהלה צעירה" is a substring-prefix of "מקהלה צעירה ייצוגית" —
    // selecting the former must not pull in lessons of the latter, even
    // though the latter is no longer a real course label.
    expect(matchesLessonType('מקהלה צעירה ייצוגית', 'מקהלה צעירה')).toBe(false);
  });

  test('does not match when no type is selected', () => {
    expect(matchesLessonType('פרטני 45 דקות - אביגיל לויץ טסט', '')).toBe(false);
  });
});

describe('THEORY_LABEL', () => {
  test('is the exact theory label', () => {
    expect(THEORY_LABEL).toBe('תיאוריה');
  });
});

describe('ENSEMBLE_LABELS', () => {
  test('lists exactly the 8 orchestra/choir labels, in LESSON_TYPE_OPTIONS order', () => {
    expect(ENSEMBLE_LABELS).toEqual([
      'מקהלה צעירה',
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

describe('getAddonBadge', () => {
  test('returns the theory badge for the theory course', () => {
    expect(getAddonBadge('תיאוריה')).toEqual({ emoji: '📘', label: 'תיאוריה' });
  });

  test('returns the ensemble badge for orchestra and choir courses', () => {
    expect(getAddonBadge('תזמורת כלי קשת')).toEqual({ emoji: '🎻', label: 'הרכב' });
    expect(getAddonBadge('מקהלה צעירה')).toEqual({ emoji: '🎻', label: 'הרכב' });
  });

  test('returns null for individual, melodies, and unknown courses', () => {
    expect(getAddonBadge('פרטני 45 דקות')).toBeNull();
    expect(getAddonBadge('מנגינות שנה ב')).toBeNull();
    expect(getAddonBadge('לא קיים')).toBeNull();
    expect(getAddonBadge(null)).toBeNull();
  });
});

describe('THEORY_LABELS', () => {
  test('lists exactly the 4 theory labels, in LESSON_TYPE_OPTIONS order', () => {
    expect(THEORY_LABELS).toEqual([
      'תיאוריה',
      'פיתוח קשב',
      'קצב לכולם',
      'קומפוזיציה',
    ]);
  });
});

describe('nextNumberedGroupName', () => {
  test('starts at 1 when there are no existing groups of this label', () => {
    expect(nextNumberedGroupName('פיתוח קשב', [])).toBe('פיתוח קשב 1');
  });

  test('continues from the highest existing number for this label', () => {
    expect(nextNumberedGroupName('פיתוח קשב', ['פיתוח קשב 1', 'פיתוח קשב 2'])).toBe('פיתוח קשב 3');
  });

  test('ignores groups of a different label, including ones with the same prefix', () => {
    expect(nextNumberedGroupName('קשב', ['פיתוח קשב 5', 'קשב 1'])).toBe('קשב 2');
  });

  test('ignores a non-numbered group with the exact same name', () => {
    expect(nextNumberedGroupName('תיאוריה', ['תיאוריה'])).toBe('תיאוריה 1');
  });
});

describe('matchesGroupLabel', () => {
  test('matches an exact bare label', () => {
    expect(matchesGroupLabel('תיאוריה', 'תיאוריה')).toBe(true);
  });

  test('matches a numbered instance of the label', () => {
    expect(matchesGroupLabel('פיתוח קשב 2', 'פיתוח קשב')).toBe(true);
  });

  test('does not match a different label', () => {
    expect(matchesGroupLabel('קצב לכולם 1', 'פיתוח קשב')).toBe(false);
  });

  test('does not false-match a label that is a text-prefix superstring', () => {
    expect(matchesGroupLabel('פיתוח קשביבי 1', 'פיתוח קשב')).toBe(false);
  });
});

describe('groupBaseLabel', () => {
  test('strips a trailing number', () => {
    expect(groupBaseLabel('פיתוח קשב 2')).toBe('פיתוח קשב');
  });

  test('returns the name unchanged when there is no trailing number', () => {
    expect(groupBaseLabel('תיאוריה')).toBe('תיאוריה');
  });

  test('returns the name unchanged for the old "<label> - <student>" convention', () => {
    expect(groupBaseLabel('מקהלה צעירה - יוסי כהן')).toBe('מקהלה צעירה - יוסי כהן');
  });
});
