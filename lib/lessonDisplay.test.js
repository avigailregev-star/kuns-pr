import { displayLessonTitle } from './lessonDisplay';

test('does not show an obsolete teacher embedded in a melodies title', () => {
  expect(displayLessonTitle("מנגינות שנה ג' - חצוצרה- עמנואל שרלה", ['עמנואל שרלה', 'עודד ישר']))
    .toBe("מנגינות שנה ג' - חצוצרה");
});

test('keeps course titles that do not end in a known teacher', () => {
  expect(displayLessonTitle('מנגינות שנה ב׳ - עוד', ['אורי לוי'])).toBe('מנגינות שנה ב׳ - עוד');
});
