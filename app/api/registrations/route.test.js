import { DELETE, PATCH } from './route';

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

// Queue-per-table mock, same pattern as lib/syncToAttendance.test.js, which
// also records each call's .eq() filters so tests can assert exactly which
// group (if any) a write targeted.
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
    const record = { table, eqCalls: [], inCalls: [] };
    const self = {
      select: () => self,
      eq: (...args) => { record.eqCalls.push(args); return self; },
      in: (...args) => { record.inCalls.push(args); return self; },
      delete: () => { record.method = 'delete'; return self; },
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

beforeEach(() => {
  getServerSession.mockResolvedValue({ user: { name: 'admin' } });
});

describe('DELETE /api/registrations', () => {
  test('rejects deleting multiple lessons in one request', async () => {
    getSupabaseClient.mockClear();
    const res = await DELETE(makeRequest({ ids: ['r1', 'r2'] }));
    expect(res.status).toBe(400);
    expect(getSupabaseClient).not.toHaveBeenCalled();
  });

  test('deletes only the selected lesson and leaves other groups untouched', async () => {
    const mockSupabase = createMockSupabase({ registrations: [
      { data: { id: 'r1', student_name: 'דני כהן', group_id: 'g-theory' }, error: null },
      { error: null },
      { data: [], error: null },
    ], students: [{ error: null }] });
    getSupabaseClient.mockReturnValue(mockSupabase);
    const res = await DELETE(makeRequest({ id: 'r1' }));
    expect(res.status).toBe(200);
    const deletes = mockSupabase.calls.filter(c => c.method === 'delete');
    expect(deletes).toHaveLength(1);
    expect(deletes[0].table).toBe('registrations');
    expect(deletes[0].eqCalls).toEqual([['id', 'r1']]);
    const attendance = mockSupabase.calls.find(c => c.table === 'students' && c.method === 'update');
    expect(attendance.eqCalls).toContainEqual(['group_id', 'g-theory']);
    expect(attendance.eqCalls).toContainEqual(['name', 'דני כהן']);
  });

  test('a theory lesson without a group cannot deactivate private or ensemble lessons', async () => {
    const mockSupabase = createMockSupabase({ registrations: [
      { data: { id: 'r1', student_name: 'דני כהן', group_id: null }, error: null },
      { error: null },
    ] });
    getSupabaseClient.mockReturnValue(mockSupabase);
    const res = await DELETE(makeRequest({ id: 'r1' }));
    expect(res.status).toBe(200);
    expect(mockSupabase.calls.some(c => c.table === 'students')).toBe(false);
  });

  test('keeps group attendance active when another lesson still uses that group', async () => {
    const mockSupabase = createMockSupabase({ registrations: [
      { data: { id: 'r1', student_name: 'דני כהן', group_id: 'g1' }, error: null },
      { error: null },
      { data: [{ id: 'r2', status: 'שובץ', registration_status: 'Pending' }], error: null },
    ] });
    getSupabaseClient.mockReturnValue(mockSupabase);
    const res = await DELETE(makeRequest({ id: 'r1' }));
    expect(res.status).toBe(200);
    expect(mockSupabase.calls.some(c => c.table === 'students')).toBe(false);
  });
});

describe('PATCH /api/registrations', () => {
  test('cancelled payment with no group leaves other attendance lessons active', async () => {
    const mockSupabase = createMockSupabase({ registrations: [
      { error: null },
      { data: { student_name: 'דני כהן', group_id: null }, error: null },
    ] });
    getSupabaseClient.mockReturnValue(mockSupabase);
    const res = await PATCH(makeRequest({ id: 'r1', registration_status: 'Cancelled' }));
    expect(res.status).toBe(200);
    expect(mockSupabase.calls.some(c => c.table === 'students')).toBe(false);
  });

  test('cancelled payment only deactivates its linked attendance group', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { error: null },
        { data: { student_name: 'דני כהן', group_id: 'g1' }, error: null },
      ],
      students: [{ error: null }],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);
    const res = await PATCH(makeRequest({ id: 'r1', registration_status: 'Cancelled' }));
    expect(res.status).toBe(200);
    const update = mockSupabase.calls.find(c => c.table === 'students');
    expect(update.eqCalls).toContainEqual(['group_id', 'g1']);
    expect(update.payload.is_active).toBe(false);
  });

  test.each([true, false])('saves optional lesson requirements (%s) without changing assignments or payment', async (value) => {
    const mockSupabase = createMockSupabase({ registrations: [{ error: null }] });
    getSupabaseClient.mockReturnValue(mockSupabase);
    const res = await PATCH(makeRequest({ id: 'r1', ensemble_not_required: value, theory_not_required: value }));
    expect(res.status).toBe(200);
    expect(mockSupabase.calls).toHaveLength(1);
    expect(mockSupabase.calls[0].payload).toEqual({
      ensemble_not_required: value, theory_not_required: value, updated_at: expect.any(String),
    });
    expect(mockSupabase.calls[0].eqCalls).toEqual([['id', 'r1']]);
  });

  test('rejects invalid requirement values before accessing the database', async () => {
    getSupabaseClient.mockClear();
    const res = await PATCH(makeRequest({ id: 'r1', theory_not_required: 'true' }));
    expect(res.status).toBe(400);
    expect(getSupabaseClient).not.toHaveBeenCalled();
  });

  test('rejects updates with a missing registration id', async () => {
    const res = await PATCH(makeRequest({ ensemble_not_required: true }));
    expect(res.status).toBe(400);
  });

  test('writes attended_open_day to the update payload when provided', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { error: null }, // update
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await PATCH(makeRequest({ id: 'r1', attended_open_day: true }));
    expect(res.status).toBe(200);

    const update = mockSupabase.calls.find(c => c.table === 'registrations' && c.method === 'update');
    expect(update).toBeDefined();
    expect(update.payload.attended_open_day).toBe(true);
    expect(update.eqCalls).toContainEqual(['id', 'r1']);
  });

  test('omits attended_open_day from the update payload when not provided', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { error: null }, // update
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await PATCH(makeRequest({ id: 'r1', admin_notes: 'hello' }));
    expect(res.status).toBe(200);

    const update = mockSupabase.calls.find(c => c.table === 'registrations' && c.method === 'update');
    expect(update.payload).not.toHaveProperty('attended_open_day');
  });
});
