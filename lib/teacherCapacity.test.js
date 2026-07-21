import { getGroupLessonDuration, buildUsedMinutesMap } from './teacherCapacity';

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
    let requestedCols = null;
    const self = {
      select: (cols) => {
        requestedCols = cols.split(',').map(c => c.trim().split('(')[0].trim());
        return self;
      },
      not: () => self,
      then: (resolve, reject) => Promise.resolve(nextResponse(table)).then(res => {
        // Mimic real Supabase: only the columns actually passed to select() come back.
        if (Array.isArray(res.data) && requestedCols) {
          res = { ...res, data: res.data.map(row => {
            const picked = {};
            for (const col of requestedCols) picked[col] = row[col];
            return picked;
          }) };
        }
        return res;
      }).then(resolve, reject),
    };
    return self;
  }
  return { from: jest.fn(table => builder(table)) };
}

describe('getGroupLessonDuration', () => {
  test('individual_45 lessons are 45 minutes', () => {
    expect(getGroupLessonDuration('individual_45')).toBe(45);
  });

  test('melodies_individual lessons are 45 minutes', () => {
    expect(getGroupLessonDuration('melodies_individual')).toBe(45);
  });

  test('individual_60 lessons are 60 minutes', () => {
    expect(getGroupLessonDuration('individual_60')).toBe(60);
  });

  test('group lesson types (e.g. choir) default to 60 minutes', () => {
    expect(getGroupLessonDuration('choir')).toBe(60);
  });

  test('undefined lesson type defaults to 60 minutes', () => {
    expect(getGroupLessonDuration(undefined)).toBe(60);
  });
});

describe('buildUsedMinutesMap', () => {
  test('counts two individual lessons for the same teacher/day at different times separately', async () => {
    const supabase = createMockSupabase({
      registrations: [{
        data: [
          { teacher: 'דנה כהן', assigned_day: 1, assigned_time: '10:00:00', selected_course: 'פרטני 45 דקות', status: 'שובץ', registration_status: null, group_id: null },
          { teacher: 'דנה כהן', assigned_day: 1, assigned_time: '14:00:00', selected_course: 'פרטני 45 דקות', status: 'שובץ', registration_status: null, group_id: null },
        ],
        error: null,
      }],
      groups: [{ data: [], error: null }],
    });

    const map = await buildUsedMinutesMap(supabase);

    expect(map['דנה כהן'][1]).toBe(90);
  });

  test('still de-dupes multiple students in the same group slot (same teacher/day/time)', async () => {
    const supabase = createMockSupabase({
      registrations: [{
        data: [
          { teacher: 'דנה כהן', assigned_day: 1, assigned_time: '10:00:00', selected_course: 'מקהלה 60 דקות', status: 'שובץ', registration_status: null, group_id: 'g1' },
          { teacher: 'דנה כהן', assigned_day: 1, assigned_time: '10:00:00', selected_course: 'מקהלה 60 דקות', status: 'שובץ', registration_status: null, group_id: 'g1' },
        ],
        error: null,
      }],
      groups: [{ data: [], error: null }],
    });

    const map = await buildUsedMinutesMap(supabase);

    expect(map['דנה כהן'][1]).toBe(60);
  });
});
