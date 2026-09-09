import { assignmentStatusLabel, needsAttention, isStudentHandled, missingStatusLabels } from './registrationWorkflow';
import { groupStudentRows } from './groupStudentRows';

function student(overrides = {}, addons = []) {
  return groupStudentRows([{
    id: 'main', student_name: 'תלמידה', parent_phone: '0501234567',
    created_at: '2026-09-01', selected_course: 'פרטני 45 דקות',
    status: 'שובץ', registration_status: 'Confirmed',
    ensemble_not_required: true, theory_not_required: true,
    ...overrides,
  }, ...addons])[0];
}

test.each([
  ['חדש', 'Pending', ['לא שובץ', 'לא שולם']],
  ['שובץ', 'Pending', ['לא שולם']],
  ['חדש', 'Confirmed', ['לא שובץ']],
  ['שובץ', 'Confirmed', []],
  [null, null, ['לא שובץ', 'לא שולם']],
  ['בוטל', 'Pending', []],
  ['חדש', 'Cancelled', []],
])('only missing work is labeled (%s, %s)', (status, registration_status, labels) => {
  expect(missingStatusLabels({ status, registration_status })).toEqual(labels);
});

test('old and missing statuses display as unassigned without rewriting stored values', () => {
  expect(assignmentStatusLabel('חדש')).toBe('לא שובץ');
  expect(assignmentStatusLabel(null)).toBe('לא שובץ');
  expect(assignmentStatusLabel('בבדיקה')).toBe('לא שובץ · בבדיקה');
  expect(assignmentStatusLabel('שובץ')).toBe('שובץ');
});

test('assigned but unpaid and paid but unassigned stay in registrations', () => {
  expect(isStudentHandled(student({ registration_status: 'Pending' }))).toBe(false);
  expect(isStudentHandled(student({ status: 'חדש' }))).toBe(false);
  expect(isStudentHandled(student({ registration_status: null }))).toBe(false);
  expect(isStudentHandled(student())).toBe(true);
});

test('missing optional lessons need explicit exemptions; legacy rows remain visible', () => {
  expect(isStudentHandled(student({ ensemble_not_required: undefined }))).toBe(false);
  expect(isStudentHandled(student({ theory_not_required: false }))).toBe(false);
});

test('fixed lesson addons do not require payment to be handled', () => {
  const addon = {
    id: 'addon', linked_registration_id: 'main', created_at: '2026-09-02',
    status: 'שובץ', registration_status: 'Pending', selected_course: 'תיאוריה',
  };
  expect(isStudentHandled(student({}, [addon]))).toBe(true);
  expect(isStudentHandled(student({}, [{ ...addon, registration_status: 'Confirmed' }]))).toBe(true);
});

test('handled requires paid assigned individual and assigned-or-not-required fixed lessons', () => {
  const staleTheory = {
    id: 'theory', linked_registration_id: 'main', created_at: '2026-09-02',
    status: 'חדש', registration_status: 'Pending', selected_course: 'תיאוריה',
  };
  expect(isStudentHandled(student({ theory_not_required: true }, [staleTheory]))).toBe(true);
  expect(isStudentHandled(student({ theory_not_required: false }, [staleTheory]))).toBe(false);
  expect(isStudentHandled(student({ theory_not_required: false }, [{ ...staleTheory, status: 'שובץ' }]))).toBe(true);
  expect(isStudentHandled(student({ registration_status: 'Pending' }, [{ ...staleTheory, status: 'שובץ' }]))).toBe(false);
});

test('changing completion or payment returns a student to registrations; partitions lose nobody', () => {
  const students = [student(), student({ status: 'חדש' }), student({ registration_status: 'Cancelled' })];
  const handled = students.filter(isStudentHandled);
  const pending = students.filter(g => !isStudentHandled(g));
  expect(handled).toHaveLength(1);
  expect([...handled, ...pending]).toHaveLength(students.length);
  expect(pending.every(g => !handled.includes(g))).toBe(true);
});

test('red attention covers missing assignment or payment but not cancelled registrations', () => {
  expect(needsAttention({ status: 'שובץ', registration_status: 'Confirmed' })).toBe(false);
  expect(needsAttention({ status: 'חדש', registration_status: 'Confirmed' })).toBe(true);
  expect(needsAttention({ status: 'שובץ' })).toBe(true);
  expect(needsAttention({ status: 'בוטל' })).toBe(false);
  expect(needsAttention({ registration_status: 'Cancelled' })).toBe(false);
});

test('a complete resolved schedule overrides a stale unassigned status in the UI', () => {
  const stale = { status: 'חדש', registration_status: 'Confirmed' };
  expect(missingStatusLabels(stale, true)).toEqual([]);
  expect(needsAttention(stale, true)).toBe(false);
});
