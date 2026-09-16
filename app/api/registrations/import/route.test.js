import { POST } from './route';

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('../../auth/[...nextauth]/route', () => ({ authOptions: {} }));
jest.mock('../../../../lib/supabase', () => ({ getSupabaseClient: jest.fn() }));
jest.mock('../../../../lib/syncToAttendance', () => ({ syncRegistrationToAttendance: jest.fn().mockResolvedValue() }));

import { getServerSession } from 'next-auth';
import { getSupabaseClient } from '../../../../lib/supabase';
import { syncRegistrationToAttendance } from '../../../../lib/syncToAttendance';

const request = body => ({ json: async () => body });

beforeEach(() => getServerSession.mockResolvedValue({ user: { name: 'admin' } }));

test('refuses an ambiguous student name without changing any lesson', async () => {
  const update = jest.fn();
  const query = {
    select: () => query,
    ilike: () => query,
    limit: async () => ({ data: [{ id: 'private' }, { id: 'theory' }], error: null }),
    update,
  };
  getSupabaseClient.mockReturnValue({ from: () => query });
  const res = await POST(request({ studentName: 'דני כהן', teacher: 'דנה', assignedTime: '15:00' }));
  expect(res.status).toBe(409);
  expect(update).not.toHaveBeenCalled();
});

test('updates only the uniquely matched named lesson', async () => {
  const filters = [];
  let selects = 0;
  const query = {
    select: () => { selects++; return query; },
    ilike: () => query,
    eq: (...args) => { filters.push(args); return query; },
    limit: async () => ({ data: [{ id: 'private', selected_course: 'פרטני 45 דקות' }], error: null }),
    update: () => query,
    single: async () => ({ data: { id: 'private', student_name: 'דני כהן', teacher: 'דנה', assigned_day: 'ב', assigned_time: '15:00', status: 'שובץ' }, error: null }),
    then: resolve => Promise.resolve({ error: null }).then(resolve),
  };
  getSupabaseClient.mockReturnValue({ from: () => query });
  const res = await POST(request({ studentName: 'דני כהן', teacher: 'דנה', assignedTime: '15:00', selectedCourse: 'פרטני 45 דקות' }));
  expect(res.status).toBe(200);
  expect(filters).toContainEqual(['selected_course', 'פרטני 45 דקות']);
  expect(filters).toContainEqual(['id', 'private']);
  expect(selects).toBe(2);
  expect(syncRegistrationToAttendance).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: 'private' }));
});
