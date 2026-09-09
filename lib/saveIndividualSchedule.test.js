import { saveIndividualSchedule } from './saveIndividualSchedule';
import { syncRegistrationToAttendance } from './syncToAttendance';
jest.mock('./syncToAttendance', () => ({ syncRegistrationToAttendance: jest.fn().mockResolvedValue() }));
const original = { id: 'r', teacher: 'מורה', selected_course: 'פרטני 45 דקות', group_id: 'g', assigned_day: 0, assigned_time: '14:00' };
const group = { id: 'g', name: 'פרטני', lesson_type: 'individual_45', teacher_id: 't', group_schedules: [{ id: 's', day_of_week: 0, start_time: '14:00', end_time: '14:45' }] };
const teacher = { id: 't', name: 'מורה', teacher_availability_ranges: [{ day_of_week: 0, start_time: '14:00', end_time: '18:00' }] };
function mockDb({ rows = [original], groups = [group], readError = null } = {}) {
  const writes = [];
  return { writes, from(table) {
    let method = 'select', payload, filters = [];
    const q = { select: () => q, eq: (...args) => { filters.push(args); return q; }, update: data => { method = 'update'; payload = data; return q; }, insert: data => { method = 'insert'; payload = data; return q; }, maybeSingle: async () => ({ data: table === 'teachers' ? teacher : original }), then: (resolve,reject) => {
      if (method !== 'select') { writes.push({ table, method, payload, filters }); return Promise.resolve({ error: null }).then(resolve,reject); }
      return Promise.resolve({ data: table === 'groups' ? groups : rows, error: readError }).then(resolve,reject);
    } }; return q;
  } };
}
const body = { id: 'r', teacher: 'מורה', assignedDay: 0, assignedTime: '15:00', selectedCourse: 'פרטני 45 דקות' };
test('rejects stale browser selection if a lesson is now occupied; no writes occur', async () => {
  const db = mockDb({ rows: [original, { id: 'other', teacher: 'מורה', assigned_day: 0, assigned_time: '15:15', assigned_end_time: '16:00', status: 'שובץ', student_name: 'אחר' }] });
  expect((await saveIndividualSchedule(db, body)).status).toBe(409);
  expect(db.writes).toEqual([]);
});
test('fails closed on read errors and invalid/outside-availability times', async () => {
  const db = mockDb({ readError: { message: 'offline' } });
  expect((await saveIndividualSchedule(db, body)).status).toBe(503);
  expect(db.writes).toEqual([]);
  const validDb = mockDb();
  expect((await saveIndividualSchedule(validDb, { ...body, assignedTime: '25:00' })).status).toBe(400);
  expect((await saveIndividualSchedule(validDb, { ...body, assignedTime: '17:45' })).status).toBe(400);
  expect(validDb.writes).toEqual([]);
});
test('reschedules own single-student group and registration without changing payment or deleting data', async () => {
  const db = mockDb();
  expect((await saveIndividualSchedule(db, body)).status).toBe(200);
  expect(db.writes.find(w => w.table === 'registrations').payload).toMatchObject({ assigned_day: 0, assigned_time: '15:00', assigned_end_time: '15:45', status: 'שובץ' });
  expect(db.writes.find(w => w.table === 'registrations').payload).not.toHaveProperty('registration_status');
  expect(db.writes.find(w => w.table === 'group_schedules')).toMatchObject({ payload: { day_of_week: 0, start_time: '15:00', end_time: '15:45' }, filters: [['id', 's']] });
  expect(syncRegistrationToAttendance).toHaveBeenCalledWith(db, expect.objectContaining({ id: 'r', assigned_time: '15:00' }), 'g');
});
test('saves an explicitly selected end time and rejects weekend days', async () => {
  const db = mockDb();
  expect((await saveIndividualSchedule(db, { ...body, assignedEndTime: '16:00' })).status).toBe(200);
  expect(db.writes.find(w => w.table === 'registrations').payload.assigned_end_time).toBe('16:00');
  const weekendDb = mockDb();
  expect((await saveIndividualSchedule(weekendDb, { ...body, assignedDay: 5 })).status).toBe(400);
  expect(weekendDb.writes).toEqual([]);
});
test('does not move a group shared with another registration', async () => {
  const db = mockDb({ rows: [original, { id: 'other', group_id: 'g' }] });
  expect((await saveIndividualSchedule(db, body)).status).toBe(409);
  expect(db.writes).toEqual([]);
});
