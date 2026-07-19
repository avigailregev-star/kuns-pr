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
    const record = { table, eqCalls: [] };
    const self = {
      select: () => self,
      eq: (...args) => { record.eqCalls.push(args); return self; },
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
  test('scopes the students deactivation to the deleted registration\'s own group_id', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { data: { student_name: 'דני כהן', group_id: 'g1' }, error: null }, // fetch before delete
        { error: null }, // delete
      ],
      message_log: [
        { error: null }, // delete
      ],
      students: [
        { data: [{ id: 1, name: 'דני כהן' }], error: null }, // deactivate
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await DELETE(makeRequest({ id: 'r1' }));
    expect(res.status).toBe(200);

    const studentUpdate = mockSupabase.calls.find(c => c.table === 'students' && c.method === 'update');
    expect(studentUpdate).toBeDefined();
    expect(studentUpdate.payload).toEqual({ is_active: false });
    expect(studentUpdate.eqCalls).toContainEqual(['name', 'דני כהן']);
    expect(studentUpdate.eqCalls).toContainEqual(['group_id', 'g1']);
  });

  test('falls back to a name-only match when the deleted registration has no group_id', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { data: { student_name: 'דני כהן', group_id: null }, error: null }, // fetch before delete
        { error: null }, // delete
      ],
      message_log: [
        { error: null }, // delete
      ],
      students: [
        { data: [], error: null }, // deactivate
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await DELETE(makeRequest({ id: 'r1' }));
    expect(res.status).toBe(200);

    const studentUpdate = mockSupabase.calls.find(c => c.table === 'students' && c.method === 'update');
    expect(studentUpdate).toBeDefined();
    expect(studentUpdate.eqCalls).toContainEqual(['name', 'דני כהן']);
    expect(studentUpdate.eqCalls.some(c => c[0] === 'group_id')).toBe(false);
  });
});

describe('PATCH /api/registrations', () => {
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
