import { syncRegistrationToAttendance } from './syncToAttendance';

// Queue-per-table mock, same pattern as app/api/update-status/route.test.js,
// but also logs every insert/update call (with its .eq() filters and payload)
// so tests can assert exactly which group a write targeted.
function createMockSupabase(responses) {
  const queues = {};
  for (const [table, list] of Object.entries(responses)) {
    queues[table] = [...list];
  }
  function nextResponse(table) {
    const q = queues[table];
    if (!q || q.length === 0) throw new Error(`No mock response queued for table "${table}"`);
    return q.shift();
  }
  const calls = [];
  function builder(table) {
    const record = { table, eqCalls: [] };
    const self = {
      select: () => self,
      eq: (...args) => { record.eqCalls.push(args); return self; },
      insert: (payload) => { record.method = 'insert'; record.payload = payload; return self; },
      update: (payload) => { record.method = 'update'; record.payload = payload; return self; },
      maybeSingle: () => { calls.push({ ...record, eqCalls: [...record.eqCalls] }); return Promise.resolve(nextResponse(table)); },
      single: () => { calls.push({ ...record, eqCalls: [...record.eqCalls] }); return Promise.resolve(nextResponse(table)); },
      then: (resolve, reject) => {
        calls.push({ ...record, eqCalls: [...record.eqCalls] });
        return Promise.resolve(nextResponse(table)).then(resolve, reject);
      },
    };
    return self;
  }
  const from = jest.fn(table => builder(table));
  return { from, calls };
}

function baseReg(overrides = {}) {
  return {
    id: 'r1',
    teacher: 'דנה כהן',
    assigned_day: 1,
    assigned_time: '15:30',
    student_name: 'יוסי כהן',
    instruments: ['גיטרה'],
    parent_phone: '050-1111111',
    selected_course: 'פרטני 45 דקות',
    status: 'שובץ',
    registration_status: null,
    group_id: null,
    ...overrides,
  };
}

describe('syncRegistrationToAttendance — explicit group id (manual "existing lesson" pick)', () => {
  test('uses the given group id directly instead of searching for or creating a matching group', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [{ error: null }], // registrations.group_id update
      students: [
        { data: null, error: null }, // existing-student check in the explicit group: not found
        { error: null }, // insert into the explicit group
      ],
    });

    await syncRegistrationToAttendance(mockSupabase, baseReg(), 'g-existing');

    const tablesTouched = mockSupabase.from.mock.calls.map(c => c[0]);
    expect(tablesTouched).not.toContain('groups');
    expect(tablesTouched).not.toContain('teachers');
    expect(tablesTouched).not.toContain('group_schedules');

    const studentInsert = mockSupabase.calls.find(c => c.table === 'students' && c.method === 'insert');
    expect(studentInsert.payload).toMatchObject({ group_id: 'g-existing', name: 'יוסי כהן' });

    const regUpdate = mockSupabase.calls.find(c => c.table === 'registrations' && c.method === 'update');
    expect(regUpdate.payload).toEqual({ group_id: 'g-existing' });
  });

  test('deactivates the student in their previous group when moved to an explicit group id', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [{ error: null }],
      students: [
        { error: null }, // deactivate in the old group
        { data: null, error: null }, // existing-student check in the new group: not found
        { error: null }, // insert into the new group
      ],
    });

    await syncRegistrationToAttendance(mockSupabase, baseReg({ group_id: 'g-old' }), 'g-new');

    const deactivate = mockSupabase.calls.find(
      c => c.table === 'students' && c.method === 'update' && c.payload?.is_active === false
    );
    expect(deactivate).toBeDefined();
    expect(deactivate.eqCalls).toContainEqual(['group_id', 'g-old']);

    const insert = mockSupabase.calls.find(c => c.table === 'students' && c.method === 'insert');
    expect(insert.payload).toMatchObject({ group_id: 'g-new' });
  });

  test('without an explicit group id, still searches for/creates a group as before', async () => {
    const mockSupabase = createMockSupabase({
      teachers: [{ data: { id: 't1' }, error: null }],
      groups: [
        { data: [], error: null }, // no existing groups match teacher+name
        { data: { id: 'g-new-auto' }, error: null }, // insert new group -> select('id').single()
      ],
      group_schedules: [{ error: null }],
      registrations: [{ error: null }],
      students: [
        { data: null, error: null },
        { error: null },
      ],
    });

    await syncRegistrationToAttendance(mockSupabase, baseReg());

    const groupInsert = mockSupabase.calls.find(c => c.table === 'groups' && c.method === 'insert');
    expect(groupInsert.payload).toMatchObject({ teacher_id: 't1', name: 'פרטני 45 דקות' });

    const studentInsert = mockSupabase.calls.find(c => c.table === 'students' && c.method === 'insert');
    expect(studentInsert.payload).toMatchObject({ group_id: 'g-new-auto' });
  });

  test('a candidate group whose schedule has no start_time is skipped instead of crashing the search', async () => {
    const mockSupabase = createMockSupabase({
      teachers: [{ data: { id: 't1' }, error: null }],
      groups: [
        { data: [{ id: 'g-candidate', group_schedules: [{ day_of_week: 1, start_time: null }] }], error: null }, // candidate exists but has no start_time set
        { data: { id: 'g-new-auto' }, error: null }, // falls through to creating a new group
      ],
      group_schedules: [{ error: null }],
      registrations: [{ error: null }],
      students: [
        { data: null, error: null },
        { error: null },
      ],
    });

    await syncRegistrationToAttendance(mockSupabase, baseReg());

    const groupInsert = mockSupabase.calls.find(c => c.table === 'groups' && c.method === 'insert');
    expect(groupInsert).toBeDefined();

    const studentInsert = mockSupabase.calls.find(c => c.table === 'students' && c.method === 'insert');
    expect(studentInsert.payload).toMatchObject({ group_id: 'g-new-auto' });
  });
});
