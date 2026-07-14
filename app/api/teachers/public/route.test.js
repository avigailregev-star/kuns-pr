import { GET } from './route';

jest.mock('../../../../lib/supabase', () => ({
  getSupabaseClient: jest.fn(),
}));
jest.mock('../../../../lib/teacherCapacity', () => ({
  buildUsedMinutesMap: jest.fn().mockResolvedValue({}),
}));

import { getSupabaseClient } from '../../../../lib/supabase';

// Three parallel queries hit 'teachers' twice (names, then extra fields) and
// 'teacher_availability_ranges' once, in that literal array order inside the
// route's Promise.all — see route.js. Each table gets its own response queue.
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
      order: () => self,
      then: (resolve, reject) => Promise.resolve(nextResponse(table)).then(resolve, reject),
    };
    return self;
  }
  return { from: jest.fn(table => builder(table)) };
}

describe('GET /api/teachers/public — closed_for_registration', () => {
  test('includes closed_for_registration on each availability range', async () => {
    const mockSupabase = createMockSupabase({
      teachers: [
        { data: [{ id: 't1', name: 'דנה כהן' }], error: null },
        { data: [{ id: 't1', instrument_type: 'פסנתר', available_days: [], max_students: null, available_hours: {}, courses: [] }], error: null },
      ],
      teacher_availability_ranges: [
        {
          data: [
            { teacher_id: 't1', day_of_week: 1, start_time: '15:00', end_time: '18:00', closed_for_registration: true },
            { teacher_id: 't1', day_of_week: 2, start_time: '15:00', end_time: '18:00', closed_for_registration: false },
          ],
          error: null,
        },
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await GET();
    const json = await res.json();

    expect(json.data[0].teacher_availability_ranges).toEqual([
      { day_of_week: 1, start_time: '15:00', end_time: '18:00', closed_for_registration: true },
      { day_of_week: 2, start_time: '15:00', end_time: '18:00', closed_for_registration: false },
    ]);
  });
});
