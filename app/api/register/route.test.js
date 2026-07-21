import { POST } from './route';

jest.mock('../../../lib/supabase', () => ({
  getSupabaseClient: jest.fn(),
}));
jest.mock('../../../lib/googleSheets', () => ({
  appendRegistrationRow: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../lib/makeWebhook', () => ({
  sendToMake: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../lib/email', () => ({
  sendConfirmationEmail: jest.fn().mockResolvedValue(undefined),
}));

import { getSupabaseClient } from '../../../lib/supabase';

function makeRequest(body) {
  return { json: async () => body };
}

// Queue-based mock like app/api/update-status/route.test.js, plus arg
// capture on .insert() (needed here to inspect the `status`/`admin_notes`
// this route computes, since the response body doesn't expose them).
function createMockSupabase(responses, capturedInserts) {
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
      not: () => self,
      eq: () => self,
      neq: () => self,
      ilike: () => self,
      insert: (rows) => {
        if (!capturedInserts[table]) capturedInserts[table] = [];
        capturedInserts[table].push(rows);
        return self;
      },
      single: () => Promise.resolve(nextResponse(table)),
      maybeSingle: () => Promise.resolve(nextResponse(table)),
      then: (resolve, reject) => Promise.resolve(nextResponse(table)).then(resolve, reject),
    };
    return self;
  }
  return { from: jest.fn(table => builder(table)) };
}

const baseBody = {
  studentName: 'תום כהן',
  parentName: 'רונית כהן',
  parentPhone: '0501234567',
  parentEmail: 'ronit@example.com',
  type: 'continue',
  selectedCourse: "גיטרה- שיעור המשך 45 דק'",
  selectedTeacher: 'דנה כהן',
};

describe('POST /api/register — closed_for_registration server-side check', () => {
  test('a closed day forces רשימת המתנה even when the day has free capacity', async () => {
    const capturedInserts = {};
    const mockSupabase = createMockSupabase({
      registrations: [
        { data: [], error: null }, // buildUsedMinutesMap: no existing assignments
        { data: { id: 'r1' }, error: null }, // main insert .select('id').single()
      ],
      groups: [
        { data: [], error: null }, // buildUsedMinutesMap: no groups
      ],
      teachers: [
        {
          data: {
            available_hours: {},
            teacher_availability_ranges: [
              { day_of_week: 1, start_time: '15:00', end_time: '16:00', closed_for_registration: true },
            ],
          },
          error: null,
        },
      ],
    }, capturedInserts);
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({ ...baseBody, selectedDay: 1 }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(capturedInserts.registrations[0][0].status).toBe('רשימת המתנה');
    expect(capturedInserts.registrations[0][0].admin_notes).toContain('סגור להרשמות חדשות');
  });

  test('an open day with free capacity saves normally', async () => {
    const capturedInserts = {};
    const mockSupabase = createMockSupabase({
      registrations: [
        { data: [], error: null },
        { data: { id: 'r1' }, error: null },
      ],
      groups: [
        { data: [], error: null },
      ],
      teachers: [
        {
          data: {
            available_hours: {},
            teacher_availability_ranges: [
              { day_of_week: 1, start_time: '15:00', end_time: '16:00', closed_for_registration: false },
            ],
          },
          error: null,
        },
      ],
    }, capturedInserts);
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({ ...baseBody, selectedDay: 1 }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(capturedInserts.registrations[0][0].status).toBe('חדש');
  });

  test('when every one of the teacher\'s days is closed, the all-days-full check also triggers רשימת המתנה', async () => {
    const capturedInserts = {};
    const mockSupabase = createMockSupabase({
      registrations: [
        { data: [], error: null }, // buildUsedMinutesMap
        { data: { id: 'r1' }, error: null }, // main insert
      ],
      groups: [
        { data: [], error: null },
      ],
      teachers: [
        {
          data: {
            available_days: [],
            available_hours: {},
            teacher_availability_ranges: [
              { day_of_week: 0, start_time: '15:00', end_time: '18:00', closed_for_registration: true },
              { day_of_week: 1, start_time: '15:00', end_time: '18:00', closed_for_registration: true },
            ],
          },
          error: null,
        },
      ],
    }, capturedInserts);
    getSupabaseClient.mockReturnValue(mockSupabase);

    // No selectedDay → hits the "all days full" branch instead of the day-specific one.
    const res = await POST(makeRequest({ ...baseBody, selectedDay: '' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(capturedInserts.registrations[0][0].status).toBe('רשימת המתנה');
  });
});

describe('POST /api/register — teacher quota check fails safe on DB error', () => {
  test('a failed capacity count does not silently treat the teacher as available', async () => {
    const capturedInserts = {};
    const mockSupabase = createMockSupabase({
      teachers: [
        {
          data: [{ id: 't1', name: 'דנה כהן', instrument_type: 'גיטרה', max_students: 5 }],
          error: null,
        },
      ],
      registrations: [
        { count: null, error: { message: 'connection reset' } }, // quota count query fails
        { data: { id: 'r1' }, error: null }, // main insert
      ],
    }, capturedInserts);
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({
      ...baseBody,
      type: 'new',
      instruments: ['גיטרה'],
      attendedOpenDay: true,
      selectedTeacher: undefined,
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    // Can't confirm capacity → falls back to waitlist instead of assuming a free spot.
    expect(capturedInserts.registrations[0][0].status).toBe('רשימת המתנה');
  });
});
