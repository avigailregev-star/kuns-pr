import { PUT } from './route';

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

// Captures the array passed to .insert(...) per table, since the shared
// queue-based mock pattern used elsewhere in this repo (e.g.
// app/api/groups/route.test.js) doesn't record call arguments — this test
// needs to assert on what was actually inserted, not just which table.
function createMockSupabase(teacherUpdateResult, capturedInserts) {
  return {
    from: jest.fn((table) => {
      if (table === 'teachers') {
        return {
          update: () => ({
            eq: () => ({
              select: () => ({
                single: () => Promise.resolve(teacherUpdateResult),
              }),
            }),
          }),
        };
      }
      if (table === 'teacher_availability_ranges') {
        return {
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
          insert: (rows) => {
            capturedInserts.push(...rows);
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

beforeEach(() => {
  getServerSession.mockResolvedValue({ user: { name: 'admin' } });
});

describe('PUT /api/teachers/[id] — closed_for_registration', () => {
  test('persists closed_for_registration per range on save', async () => {
    const capturedInserts = [];
    getSupabaseClient.mockReturnValue(createMockSupabase(
      { data: { id: 't1', name: 'דנה כהן' }, error: null },
      capturedInserts,
    ));

    const res = await PUT(makeRequest({
      name: 'דנה כהן',
      instrument_type: 'פסנתר',
      availability_ranges: [
        { day_of_week: 0, start_time: '15:00', end_time: '18:00', closed_for_registration: true },
        { day_of_week: 1, start_time: '15:00', end_time: '18:00', closed_for_registration: false },
      ],
    }), { params: { id: 't1' } });

    expect(res.status).toBe(200);
    expect(capturedInserts).toEqual([
      { teacher_id: 't1', day_of_week: 0, start_time: '15:00', end_time: '18:00', closed_for_registration: true },
      { teacher_id: 't1', day_of_week: 1, start_time: '15:00', end_time: '18:00', closed_for_registration: false },
    ]);
  });

  test('defaults closed_for_registration to false when the field is omitted', async () => {
    const capturedInserts = [];
    getSupabaseClient.mockReturnValue(createMockSupabase(
      { data: { id: 't1', name: 'דנה כהן' }, error: null },
      capturedInserts,
    ));

    await PUT(makeRequest({
      name: 'דנה כהן',
      instrument_type: 'פסנתר',
      availability_ranges: [
        { day_of_week: 2, start_time: '15:00', end_time: '18:00' },
      ],
    }), { params: { id: 't1' } });

    expect(capturedInserts).toEqual([
      { teacher_id: 't1', day_of_week: 2, start_time: '15:00', end_time: '18:00', closed_for_registration: false },
    ]);
  });
});
