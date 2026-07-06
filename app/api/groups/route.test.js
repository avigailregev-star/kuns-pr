import { POST } from './route';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));
jest.mock('../auth/[...nextauth]/route', () => ({ authOptions: {} }));
jest.mock('../../../lib/supabase', () => ({
  getSupabaseClient: jest.fn(),
}));

import { getServerSession } from 'next-auth';
import { getSupabaseClient } from '../../../lib/supabase';

function makeRequest(body) {
  return { json: async () => body };
}

// Builds a fake Supabase client. `responses` maps table name -> ordered
// queue of { data, error } objects. Every call chain on a table (whether it
// ends in .single()/.maybeSingle() or is awaited directly) consumes the next
// queued response for that table, in call order — this works because each
// test knows exactly which table is hit, and in what order, by route.js.
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
      in: () => self,
      insert: () => self,
      update: () => self,
      order: () => self,
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

describe('POST /api/groups', () => {
  test('creates a group and attaches multiple students, deactivating a prior group membership', async () => {
    const mockSupabase = createMockSupabase({
      groups: [
        { data: [] }, // overlap check: no existing groups for this teacher
        { data: { id: 'g1', name: 'מקהלה ב-ו', lesson_type: 'choir', is_mangan_school: false, school_name: null }, error: null }, // insert
      ],
      group_schedules: [
        { error: null },
      ],
      teachers: [
        { data: { name: 'דנה כהן' }, error: null },
      ],
      registrations: [
        {
          data: [
            { id: 'r1', student_name: 'יוסי כהן', instruments: ['גיטרה'], parent_phone: '050-1', group_id: null },
            { id: 'r2', student_name: 'שרה לוי', instruments: null, parent_phone: null, group_id: 'old-group' },
            { id: 'r3', student_name: 'מיכל אברהם', instruments: 'פסנתר', parent_phone: '050-3', group_id: null },
          ],
          error: null,
        }, // fetch
        { error: null }, // r1 update
        { error: null }, // r2 update
        { error: null }, // r3 update
      ],
      students: [
        { error: null }, // r1 insert
        { error: null }, // r2 deactivate (old group)
        { error: null }, // r2 insert
        { error: null }, // r3 insert
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({
      name: 'מקהלה ב-ו',
      lesson_type: 'choir',
      teacher_id: 5,
      assigned_day: 1,
      assigned_time: '15:00',
      student_registration_ids: ['r1', 'r2', 'r3'],
    }));

    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data).toEqual({ id: 'g1', name: 'מקהלה ב-ו', lesson_type: 'choir', is_mangan_school: false, school_name: null });

    // Exact call sequence: overlap check, insert, schedule, teacher lookup,
    // registrations fetch, then per-student (update, insert), with an extra
    // deactivate for r2 (which had a different prior group).
    expect(mockSupabase.from.mock.calls.map(c => c[0])).toEqual([
      'groups',          // overlap check
      'groups',          // insert
      'group_schedules', // schedule insert
      'teachers',        // teacher name lookup
      'registrations',   // fetch students to attach
      'registrations',   // r1 update
      'students',        // r1 insert
      'students',        // r2 deactivate old group
      'registrations',   // r2 update
      'students',        // r2 insert
      'registrations',   // r3 update
      'students',        // r3 insert
    ]);
  });

  test('rejects an overlapping schedule with 409 and never creates the group', async () => {
    const mockSupabase = createMockSupabase({
      groups: [
        {
          data: [
            { lesson_type: 'choir', group_schedules: [{ day_of_week: 1, start_time: '15:00', end_time: '16:00' }] },
          ],
        },
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({
      name: 'תזמורת',
      lesson_type: 'orchestra',
      teacher_id: 5,
      assigned_day: 1,
      assigned_time: '15:00',
    }));

    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.error).toContain('חיפוף בזמנים');

    // Only the overlap check ran — no group insert, no further tables touched.
    expect(mockSupabase.from.mock.calls.map(c => c[0])).toEqual(['groups']);
  });
});
