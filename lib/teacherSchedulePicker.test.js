import { teacherCalendar, slotProblem, categoryGroups, dayNumber } from './teacherSchedulePicker';
const teacher = { id: 't', name: 'מורה', teacher_availability_ranges: [{ day_of_week: 0, start_time: '14:00', end_time: '18:00' }] };
const row = { id: 'r', teacher: 'מורה', group_id: 'own' };
const own = { id: 'own', teacher_id: 't', lesson_type: 'individual_45', name: 'שיעור נוכחי', group_schedules: [{ day_of_week: 0, start_time: '14:00', end_time: '14:45' }] };
test('excludes current private group but keeps all other meetings, including multiple days', () => {
  const shared = { id: 'shared', teacher_id: 't', name: 'הרכב', lesson_type: 'orchestra', group_schedules: [{ day_of_week: 0, start_time: '15:00', end_time: '16:00' }, { day_of_week: 2, start_time: '16:00', end_time: '17:00' }] };
  const cal = teacherCalendar(teacher, [row], [own, shared], row);
  expect(cal.events).toHaveLength(2);
  expect(slotProblem(cal, 0, 14 * 60, 14 * 60 + 45)).toBe('');
  expect(slotProblem(cal, 0, 14 * 60 + 30, 15 * 60 + 15)).toContain('חפיפה');
  expect(slotProblem(cal, 0, 16 * 60, 17 * 60)).toBe('');
});
test('detects overlaps from registrations, explicit end times, and excludes cancelled rows', () => {
  const cal = teacherCalendar(teacher, [row, { id: 'other', teacher: 'מורה', assigned_day: 0, assigned_time: '14:00', assigned_end_time: '15:30', status: 'שובץ' }, { id: 'cancelled', teacher: 'מורה', assigned_day: 0, assigned_time: '16:00', status: 'בוטל' }], [], row);
  expect(slotProblem(cal, 0, 15 * 60, 16 * 60)).toContain('חפיפה');
  expect(slotProblem(cal, 0, 16 * 60, 17 * 60)).toBe('');
});
test('blocks outside availability and across a break, supports Hebrew legacy days', () => {
  const cal = teacherCalendar({ ...teacher, teacher_availability_ranges: [], available_hours: { 'א': { from: '14:00', to: '15:00' }, 'ב': { from: '16:00', to: '18:00' } } }, [], [], row);
  expect(slotProblem(cal, 0, 14 * 60 + 30, 15 * 60 + 15)).toContain('מחוץ');
  expect(slotProblem(cal, 1, 16 * 60, 17 * 60)).toBe('');
  expect(dayNumber('א')).toBe(0);
  expect(dayNumber('')).toBeNull();
});
test('never treats other students in the current group as free', () => {
  const cal = teacherCalendar(teacher, [row, { id: 'other', group_id: 'own', student_name: 'נועה כהן', status: 'שובץ' }], [own], row);
  expect(slotProblem(cal, 0, 14 * 60, 14 * 60 + 45)).toContain('חפיפה');
  expect(cal.events[0].label).toBe('נועה כהן');
});
test('does not offer Friday or Saturday for scheduling', () => {
  const weekendTeacher = { ...teacher, teacher_availability_ranges: [{ day_of_week: 5, start_time: '14:00', end_time: '18:00' }] };
  const cal = teacherCalendar(weekendTeacher, [], [], row);
  expect(cal.availability).toEqual([]);
  expect(slotProblem(cal, 5, 14 * 60, 15 * 60)).toContain('תקינים');
  expect(slotProblem(cal, 6, 14 * 60, 15 * 60)).toContain('תקינים');
});
test('ignores an orphaned private group after its registration was unassigned', () => {
  const orphan = { id: 'orphan', teacher_id: 't', lesson_type: 'individual_45', name: 'שיעור שבוטל', group_schedules: [{ day_of_week: 0, start_time: '15:00', end_time: '15:45' }] };
  const cal = teacherCalendar(teacher, [row], [orphan], row);
  expect(cal.events).toEqual([]);
  expect(slotProblem(cal, 0, 15 * 60, 15 * 60 + 45)).toBe('');
});
test('only shows matching add-on categories, including custom names', () => {
  const groups = [{ name: 'פרטני', lesson_type: 'individual_45' }, { name: 'מותאם', lesson_type: 'theory' }, { name: 'הרכב', lesson_type: 'orchestra' }, { name: 'מקהלה', lesson_type: 'choir' }];
  expect(categoryGroups(groups, 'theory').map(g => g.name)).toEqual(['מותאם']);
  expect(categoryGroups(groups, 'ensemble')).toHaveLength(2);
  expect(categoryGroups(groups, 'individual')).toEqual([]);
});
