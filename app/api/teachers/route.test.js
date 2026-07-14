import { POST } from './route';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));
jest.mock('../auth/[...nextauth]/route', () => ({ authOptions: {} }));
jest.mock('../../../lib/supabase', () => ({
  getSupabaseClient: jest.fn(),
}));
jest.mock('../../../lib/teacherCapacity', () => ({
  buildUsedMinutesMap: jest.fn().mockResolvedValue({}),
}));

import { getServerSession } from 'next-auth';
import { getSupabaseClient } from '../../../lib/supabase';

function makeRequest(body) {
  return { json: async () => body };
}

function createMockSupabase(teacherInsertResult, capturedInserts) {
  return {
    from: jest.fn((table) => {
      if (table === 'teachers') {
        return {
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve(teacherInsertResult),
            }),
          }),
        };
      }
      if (table === 'teacher_availability_ranges') {
        return {
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

describe('POST /api/teachers — closed_for_registration', () => {
  test('persists closed_for_registration per range on create', async () => {
    const capturedInserts = [];
    getSupabaseClient.mockReturnValue(createMockSupabase(
      { data: { id: 't2', name: 'יוסי לוי' }, error: null },
      capturedInserts,
    ));

    const res = await POST(makeRequest({
      name: 'יוסי לוי',
      instrument_type: 'גיטרה',
      availability_ranges: [
        { day_of_week: 3, start_time: '16:00', end_time: '19:00', closed_for_registration: true },
      ],
    }));

    expect(res.status).toBe(200);
    expect(capturedInserts).toEqual([
      { teacher_id: 't2', day_of_week: 3, start_time: '16:00', end_time: '19:00', closed_for_registration: true },
    ]);
  });
});
