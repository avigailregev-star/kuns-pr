import { getGroupLessonDuration } from './teacherCapacity';

describe('getGroupLessonDuration', () => {
  test('individual_45 lessons are 45 minutes', () => {
    expect(getGroupLessonDuration('individual_45')).toBe(45);
  });

  test('melodies_individual lessons are 45 minutes', () => {
    expect(getGroupLessonDuration('melodies_individual')).toBe(45);
  });

  test('individual_60 lessons are 60 minutes', () => {
    expect(getGroupLessonDuration('individual_60')).toBe(60);
  });

  test('group lesson types (e.g. choir) default to 60 minutes', () => {
    expect(getGroupLessonDuration('choir')).toBe(60);
  });

  test('undefined lesson type defaults to 60 minutes', () => {
    expect(getGroupLessonDuration(undefined)).toBe(60);
  });
});
