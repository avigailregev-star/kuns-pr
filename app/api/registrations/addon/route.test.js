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
  test('rejects when neither groupId nor newLabel is given', async () => {
    const res = await POST(makeRequest({ sourceId: 'r1' }));
    expect(res.status).toBe(400);
  });

  test('rejects when both groupId and newLabel are given', async () => {
    const res = await POST(makeRequest({ sourceId: 'r1', groupId: 'g1', newLabel: 'תיאוריה' }));
    expect(res.status).toBe(400);
  });

  test('rejects an unrecognized newLabel', async () => {
    const res = await POST(makeRequest({ sourceId: 'r1', newLabel: 'משהו לא קיים' }));
    expect(res.status).toBe(400);
  });

  test('rejects when the source registration does not exist', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [{ data: null, error: null }],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({ sourceId: 'missing', newLabel: 'תיאוריה' }));
    expect(res.status).toBe(404);
  });
});

describe('POST /api/registrations/addon — create a new (unscheduled) add-on', () => {
  test('creates a theory add-on with status חדש and no teacher/day/time', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { data: sourceReg, error: null },       // source fetch
        { data: [], error: null },               // existing-theory check
        { data: { id: 'new1', ...sourceReg, selected_course: 'תיאוריה', linked_registration_id: 'r1', status: 'חדש' }, error: null }, // insert
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({ sourceId: 'r1', newLabel: 'תיאוריה' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.selected_course).toBe('תיאוריה');
    expect(json.data.status).toBe('חדש');
    expect(json.data.linked_registration_id).toBe('r1');
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
});

describe('POST /api/registrations/addon — duplicate theory guard', () => {
  test('rejects with 409 when the student already has an active theory add-on', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { data: sourceReg, error: null }, // source fetch
        { data: [{ id: 'existing-theory', status: 'שובץ', selected_course: 'תיאוריה' }], error: null }, // existing-theory check
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({ sourceId: 'r1', newLabel: 'תיאוריה' }));
    expect(res.status).toBe(409);

    // No insert was attempted.
    expect(mockSupabase.from.mock.calls.map(c => c[0])).toEqual(['registrations', 'registrations']);
  });
});
