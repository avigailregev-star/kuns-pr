import { POST } from './route';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));
jest.mock('../../auth/[...nextauth]/route', () => ({ authOptions: {} }));
jest.mock('../../../../lib/supabase', () => ({
  getSupabaseClient: jest.fn(),
}));

import { getServerSession } from 'next-auth';
import { getSupabaseClient } from '../../../../lib/supabase';

function makeRequest(body) {
  return { json: async () => body };
}

// Same queue-per-table mock pattern as app/api/groups/route.test.js.
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
  function builder(table) {
    const self = {
      select: () => self,
      eq: () => self,
      insert: () => self,
      update: () => self,
      single: () => Promise.resolve(nextResponse(table)),
      maybeSingle: () => Promise.resolve(nextResponse(table)),
      then: (resolve, reject) => Promise.resolve(nextResponse(table)).then(resolve, reject),
    };
    return self;
  }
  const from = jest.fn(table => builder(table));
  return { from };
}

beforeEach(() => {
  getServerSession.mockResolvedValue({ user: { name: 'admin' } });
});

const sourceReg = {
  student_name: 'דני כהן',
  student_phone: '050-1234567',
  parent_name: 'משה כהן',
  parent_phone: '050-7654321',
  parent_email: 'moshe@example.com',
  birthdate: '2012-01-01',
  grade: 'ו',
  school_name: 'בית ספר א',
  has_accommodations: false,
  type: 'continue',
  instruments: ['גיטרה'],
};

describe('POST /api/registrations/addon — validation', () => {
  test('rejects when groupId is missing', async () => {
    const res = await POST(makeRequest({ sourceId: 'r1' }));
    expect(res.status).toBe(400);
  });

  test('rejects when sourceId is missing', async () => {
    const res = await POST(makeRequest({ groupId: 'g1' }));
    expect(res.status).toBe(400);
  });

  test('rejects when the source registration does not exist', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [{ data: null, error: null }],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({ sourceId: 'missing', groupId: 'g1' }));
    expect(res.status).toBe(404);
  });
});

describe('POST /api/registrations/addon — attach to an existing group', () => {
  test('copies teacher/day/time from the group schedule and adds the student to it', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { data: sourceReg, error: null }, // source fetch
        { data: { id: 'new2', ...sourceReg, selected_course: 'תזמורת כלי קשת', linked_registration_id: 'r1', status: 'שובץ', teacher: 'רותם לוי', assigned_day: 2, assigned_time: '17:00', group_id: 'g1' }, error: null }, // insert
      ],
      groups: [
        { data: { id: 'g1', name: 'תזמורת כלי קשת', teacher_id: 't1', lesson_type: 'orchestra', group_schedules: [{ day_of_week: 2, start_time: '17:00', end_time: '18:00' }] }, error: null },
      ],
      teachers: [
        { data: { name: 'רותם לוי' }, error: null },
      ],
      students: [
        { data: null, error: null }, // existing-student check: not found
        { error: null },              // insert
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({ sourceId: 'r1', groupId: 'g1' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.selected_course).toBe('תזמורת כלי קשת');
    expect(json.data.status).toBe('שובץ');
    expect(json.data.teacher).toBe('רותם לוי');
  });

  test('returns 404 when the given groupId does not match any group', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { data: sourceReg, error: null }, // source fetch
      ],
      groups: [
        { data: null, error: null }, // group not found
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({ sourceId: 'r1', groupId: 'missing-group' }));
    expect(res.status).toBe(404);
  });

  test('still creates the registration when the teacher lookup errors, falling back to a null teacher name', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { data: sourceReg, error: null }, // source fetch
        { data: { id: 'new3', ...sourceReg, selected_course: 'תזמורת כלי קשת', linked_registration_id: 'r1', status: 'שובץ', teacher: null, assigned_day: 2, assigned_time: '17:00', group_id: 'g1' }, error: null }, // insert
      ],
      groups: [
        { data: { id: 'g1', name: 'תזמורת כלי קשת', teacher_id: 't1', lesson_type: 'orchestra', group_schedules: [{ day_of_week: 2, start_time: '17:00', end_time: '18:00' }] }, error: null },
      ],
      teachers: [
        { data: null, error: { message: 'teacher lookup boom' } },
      ],
      students: [
        { data: null, error: null }, // existing-student check: not found
        { error: null },              // insert
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({ sourceId: 'r1', groupId: 'g1' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.teacher).toBe(null);
  });

  test('does not attempt a students insert when the existence check errors (fails closed)', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { data: sourceReg, error: null }, // source fetch
        { data: { id: 'new4', ...sourceReg, selected_course: 'תזמורת כלי קשת', linked_registration_id: 'r1', status: 'שובץ', teacher: 'רותם לוי', assigned_day: 2, assigned_time: '17:00', group_id: 'g1' }, error: null }, // insert
      ],
      groups: [
        { data: { id: 'g1', name: 'תזמורת כלי קשת', teacher_id: 't1', lesson_type: 'orchestra', group_schedules: [{ day_of_week: 2, start_time: '17:00', end_time: '18:00' }] }, error: null },
      ],
      teachers: [
        { data: { name: 'רותם לוי' }, error: null },
      ],
      students: [
        { data: null, error: { message: 'boom' } }, // existing-student check errors
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({ sourceId: 'r1', groupId: 'g1' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.id).toBe('new4');

    // Only one students call (the failed existence check) — no insert attempted.
    const studentsCalls = mockSupabase.from.mock.calls.filter(c => c[0] === 'students');
    expect(studentsCalls.length).toBe(1);
  });
});

describe('POST /api/registrations/addon — per-label duplicate guard', () => {
  test('rejects with 409 when the student already has an active registration of the exact same numbered group', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { data: sourceReg, error: null }, // source fetch
        { data: [{ id: 'existing', status: 'שובץ', selected_course: 'פיתוח קשב 1' }], error: null }, // existing-linked check
      ],
      groups: [
        { data: { id: 'g-2', name: 'פיתוח קשב 2', teacher_id: null, lesson_type: 'theory', group_schedules: [] }, error: null },
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({ sourceId: 'r1', groupId: 'g-2' }));
    expect(res.status).toBe(409);

    // No insert was attempted.
    expect(mockSupabase.from.mock.calls.map(c => c[0])).toEqual(['registrations', 'groups', 'registrations']);
  });

  test('allows joining a different theory label even with an existing active theory add-on', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { data: sourceReg, error: null }, // source fetch
        { data: [{ id: 'existing', status: 'שובץ', selected_course: 'פיתוח קשב 1' }], error: null }, // existing-linked check
        { data: { id: 'new5', ...sourceReg, selected_course: 'קומפוזיציה 1', linked_registration_id: 'r1', status: 'שובץ', teacher: null, assigned_day: null, assigned_time: null, group_id: 'g-comp' }, error: null }, // insert
      ],
      groups: [
        { data: { id: 'g-comp', name: 'קומפוזיציה 1', teacher_id: null, lesson_type: 'theory', group_schedules: [] }, error: null },
      ],
      students: [
        { data: null, error: null }, // existing-student check: not found
        { error: null },              // insert
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({ sourceId: 'r1', groupId: 'g-comp' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.selected_course).toBe('קומפוזיציה 1');
  });

  test('rejects with 500 when the existing-linked check query errors', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { data: sourceReg, error: null }, // source fetch
        { data: null, error: { message: 'Database connection error' } }, // existing-linked check fails
      ],
      groups: [
        { data: { id: 'g-1', name: 'תיאוריה 1', teacher_id: null, lesson_type: 'theory', group_schedules: [] }, error: null },
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({ sourceId: 'r1', groupId: 'g-1' }));
    expect(res.status).toBe(500);
  });
});
