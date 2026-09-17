import { POST } from './route';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));
jest.mock('../auth/[...nextauth]/route', () => ({ authOptions: {} }));
jest.mock('../../../lib/supabase', () => ({
  getSupabaseClient: jest.fn(),
}));
jest.mock('../../../lib/makeWebhook', () => ({
  sendToMake: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../lib/email', () => ({
  sendAssignmentEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../lib/syncToAttendance', () => ({
  syncRegistrationToAttendance: jest.fn().mockResolvedValue(undefined),
}));

import { getServerSession } from 'next-auth';
import { getSupabaseClient } from '../../../lib/supabase';

function makeRequest(body) {
  return { json: async () => body };
}

// Same queue-per-table mock pattern as app/api/groups/route.test.js: every
// call chain on a table (whether it ends in .single()/.maybeSingle() or is
// awaited directly) consumes the next queued response for that table, in
// call order.
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
      neq: () => self,
      in: () => self,
      insert: () => self,
      update: payload => { record.method = 'update'; record.payload = payload; return self; },
      order: () => self,
      single: () => { calls.push(record); return Promise.resolve(nextResponse(table)); },
      maybeSingle: () => { calls.push(record); return Promise.resolve(nextResponse(table)); },
      then: (resolve, reject) => { calls.push(record); return Promise.resolve(nextResponse(table)).then(resolve, reject); },
    };
    return self;
  }
  const from = jest.fn(table => builder(table));
  return { from, calls };
}

beforeEach(() => {
  getServerSession.mockResolvedValue({ user: { name: 'admin' } });
});

describe('POST /api/update-status — lesson identity', () => {
  test('refuses to replace a melodies private lesson with an ensemble', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [{ data: { id: 'melodies', selected_course: "מנגינות שנה ב' - עוד", group_id: null }, error: null }],
      groups: [{ data: { id: 'ensemble', lesson_type: 'orchestra' }, error: null }],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({ id: 'melodies', newStatus: 'שובץ', groupId: 'ensemble' }));

    expect(res.status).toBe(409);
    expect(mockSupabase.calls.some(c => c.table === 'registrations' && c.method === 'update')).toBe(false);
  });

  test('refuses to replace a private lesson with a theory assignment', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [{ data: { id: 'private', selected_course: 'פרטני 45 דקות', group_id: null }, error: null }],
      groups: [{ data: { id: 'theory', lesson_type: 'theory' }, error: null }],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({ id: 'private', newStatus: 'שובץ', groupId: 'theory' }));

    expect(res.status).toBe(409);
    expect(mockSupabase.calls.some(c => c.table === 'registrations' && c.method === 'update')).toBe(false);
  });

  test('refuses to assign a second row of the same student to an existing group', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { data: { id: 'r1', student_name: 'הלל נמן', parent_phone: '050-1234567', selected_course: 'מנגינות שנה ג׳', group_id: null }, error: null },
        { data: [{ id: 'r2', student_name: 'הלל  נמן ', parent_phone: '0501234567' }], error: null },
      ],
      groups: [{ data: { id: 'ensemble', lesson_type: 'orchestra' }, error: null }],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({ id: 'r1', newStatus: 'שובץ', groupId: 'ensemble' }));

    expect(res.status).toBe(409);
    expect(mockSupabase.calls.some(c => c.table === 'registrations' && c.method === 'update')).toBe(false);
  });
});

describe('POST /api/update-status — clear one assignment', () => {
  test('keeps another registration in the same group active', async () => {
    const mockSupabase = createMockSupabase({ registrations: [
      { data: { id: 'r1', student_name: 'דני כהן', group_id: 'g1' }, error: null },
      { error: null },
      { data: [{ id: 'r2', status: 'שובץ', registration_status: 'Pending' }], error: null },
    ] });
    getSupabaseClient.mockReturnValue(mockSupabase);
    const res = await POST(makeRequest({ id: 'r1', newStatus: 'חדש', scheduleMode: 'clear' }));
    expect(res.status).toBe(200);
    expect(mockSupabase.calls.some(c => c.table === 'students' && c.method === 'update')).toBe(false);
  });

  test('deactivates attendance only in the cleared registration group', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { data: { id: 'r1', student_name: 'דני כהן', group_id: 'g1' }, error: null },
        { error: null },
        { data: [], error: null },
      ],
      students: [{ error: null }],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);
    const res = await POST(makeRequest({ id: 'r1', newStatus: 'חדש', scheduleMode: 'clear' }));
    expect(res.status).toBe(200);
    const update = mockSupabase.calls.find(c => c.table === 'students' && c.method === 'update');
    expect(update.eqCalls).toContainEqual(['group_id', 'g1']);
    expect(update.eqCalls).toContainEqual(['name', 'דני כהן']);
  });
});

describe('POST /api/update-status — cancellation attendance scope', () => {
  test('does not deactivate another lesson when the cancelled registration has no group', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { error: null },
        { data: { id: 'r1', student_name: 'דני כהן', group_id: null }, error: null },
        { data: { student_name: 'דני כהן', group_id: null }, error: null },
      ],
      message_log: [{ error: null }],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);
    const res = await POST(makeRequest({ id: 'r1', newStatus: 'בוטל' }));
    expect(res.status).toBe(200);
    expect(mockSupabase.calls.some(c => c.table === 'students' && c.method === 'update')).toBe(false);
  });

  test('does not run a second direct deactivation after attendance sync', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { error: null },
        { data: { id: 'r1', student_name: 'דני כהן', group_id: 'g1' }, error: null },
        { data: { student_name: 'דני כהן', group_id: 'g1' }, error: null },
      ],
      message_log: [{ error: null }],
      students: [{ error: null }],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);
    const res = await POST(makeRequest({ id: 'r1', newStatus: 'בוטל' }));
    expect(res.status).toBe(200);
    expect(mockSupabase.calls.some(c => c.table === 'students' && c.method === 'update')).toBe(false);
  });
});

describe('POST /api/update-status — schedule conflict check', () => {
  test('rejects with 409 when another registration for the same teacher overlaps', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        {
          data: [
            {
              id: 'r2',
              student_name: 'שרה לוי',
              assigned_day: 1,
              assigned_time: '15:00',
              assigned_end_time: '16:00',
              selected_course: null,
              status: 'שובץ',
            },
          ],
          error: null,
        }, // the "other registrations for this teacher" fetch
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({
      id: 'r1',
      newStatus: 'שובץ',
      teacher: 'דנה כהן',
      assignedDay: 1,
      assignedTime: '15:30',
      assignedEndTime: '16:15',
    }));

    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.error).toContain('שרה לוי');

    // No table other than the conflict-check's own registrations fetch was touched —
    // in particular, no registrations.update ran.
    expect(mockSupabase.from.mock.calls.map(c => c[0])).toEqual(['registrations']);
  });

  test('rejects with 409 when an existing group for the same teacher overlaps', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { data: [], error: null }, // no conflicting individual registrations
        { data: { group_id: null }, error: null }, // current registration has no group of its own
      ],
      teachers: [
        { data: { id: 't1' }, error: null },
      ],
      groups: [
        {
          data: [
            { id: 'g-other', name: 'מקהלה צעירה', group_schedules: [{ day_of_week: 1, start_time: '15:00', end_time: '16:00' }] },
          ],
          error: null,
        },
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({
      id: 'r1',
      newStatus: 'שובץ',
      teacher: 'דנה כהן',
      assignedDay: 1,
      assignedTime: '15:30',
      assignedEndTime: '16:15',
    }));

    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.error).toContain('מקהלה צעירה');

    expect(mockSupabase.from.mock.calls.map(c => c[0])).toEqual(['registrations', 'teachers', 'registrations', 'groups']);
  });

  test('proceeds to save when the only overlapping group is the registration\'s own auto-created group', async () => {
    // Reproduces: after a student's first successful save, syncToAttendance auto-creates
    // a "group" for their individual lesson at their own day/time, linked via group_id.
    // Re-saving that same row must not treat that group as a conflict with itself.
    const mockSupabase = createMockSupabase({
      registrations: [
        { data: [], error: null }, // no conflicting individual registrations
        { data: { group_id: 'g1' }, error: null }, // current registration's own group_id
        { error: null }, // the main registrations.update
        { data: { id: 'r1', student_name: 'יוסי כהן', teacher: 'דנה כהן', assigned_day: 1, assigned_time: '15:30', selected_course: null, status: 'ממתין', registration_status: null, group_id: 'g1' }, error: null }, // post-update select for attendance sync
      ],
      teachers: [
        { data: { id: 't1' }, error: null },
      ],
      groups: [
        {
          data: [
            { id: 'g1', name: 'יוסי כהן', group_schedules: [{ day_of_week: 1, start_time: '15:30', end_time: '16:15' }] },
          ],
          error: null,
        },
      ],
      message_log: [
        { error: null },
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({
      id: 'r1',
      newStatus: 'ממתין',
      teacher: 'דנה כהן',
      assignedDay: 1,
      assignedTime: '15:30',
      assignedEndTime: '16:15',
    }));

    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  test('proceeds to save when there is no conflict', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { data: [], error: null }, // no conflicting individual registrations
        { data: { group_id: null }, error: null }, // current registration's own group_id
        { error: null }, // the main registrations.update
        { data: { student_name: 'יוסי כהן', teacher: 'דנה כהן', assigned_day: 1, assigned_time: '15:30', selected_course: null, status: 'ממתין', registration_status: null, group_id: null, id: 'r1' }, error: null }, // post-update select for attendance sync
      ],
      teachers: [
        { data: { id: 't1' }, error: null },
      ],
      groups: [
        { data: [], error: null }, // no groups at all for this teacher
      ],
      message_log: [
        { error: null },
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({
      id: 'r1',
      newStatus: 'ממתין',
      teacher: 'דנה כהן',
      assignedDay: 1,
      assignedTime: '15:30',
      assignedEndTime: '16:15',
    }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  test('when assignedEndTime is omitted, uses the registration\'s own course length (not a 45-min default) to detect overlap', async () => {
    // r1 is a 60-minute course starting 15:00 → really occupies 15:00-16:00.
    // r2 (another student, same teacher) sits at 15:50-16:10 — this only overlaps
    // if r1's real 60-minute length is used; a wrong 45-min default (ending 15:45)
    // would miss it.
    const mockSupabase = createMockSupabase({
      registrations: [
        { data: { selected_course: "פסנתר - שיעור המשך 60 דק'" }, error: null }, // current reg's own course, for duration fallback
        {
          data: [
            {
              id: 'r2',
              student_name: 'שרה לוי',
              assigned_day: 1,
              assigned_time: '15:50',
              assigned_end_time: '16:10',
              selected_course: null,
              status: 'שובץ',
            },
          ],
          error: null,
        }, // other registrations for this teacher
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({
      id: 'r1',
      newStatus: 'שובץ',
      teacher: 'דנה כהן',
      assignedDay: 1,
      assignedTime: '15:00',
      // no assignedEndTime
    }));

    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.error).toContain('שרה לוי');
  });
});
