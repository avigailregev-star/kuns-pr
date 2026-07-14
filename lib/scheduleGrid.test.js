import { buildScheduleGrid, timeToMins, minsToTime, SLOT_MINUTES } from './scheduleGrid';

describe('timeToMins / minsToTime', () => {
  test('timeToMins converts HH:MM:SS to minutes since midnight', () => {
    expect(timeToMins('14:30:00')).toBe(870);
  });

  test('timeToMins returns null for empty input', () => {
    expect(timeToMins(null)).toBeNull();
    expect(timeToMins('')).toBeNull();
  });

  test('minsToTime converts minutes back to HH:MM', () => {
    expect(minsToTime(870)).toBe('14:30');
    expect(minsToTime(90)).toBe('01:30');
  });
});

describe('buildScheduleGrid', () => {
  const baseRow = {
    id: 1,
    teacher: 'דנה כהן',
    assigned_day: 1,
    assigned_time: '15:00:00',
    assigned_end_time: '15:45:00',
    student_name: 'יוסי כהן',
    selected_course: "כינור 45 דק'",
    status: 'שובץ',
  };

  test('only includes rows for the selected teacher with an assigned day and time', () => {
    const rows = [
      baseRow,
      { ...baseRow, id: 2, teacher: 'מורה אחר' },
      { ...baseRow, id: 3, assigned_day: null },
      { ...baseRow, id: 4, assigned_time: null },
    ];
    const grid = buildScheduleGrid(rows, { teacherName: 'דנה כהן' });
    expect(grid.lessons.map((l) => l.id)).toEqual([1]);
  });

  test('excludes rows with a blocked status', () => {
    const rows = [baseRow, { ...baseRow, id: 2, status: 'בוטל' }];
    const grid = buildScheduleGrid(rows, {
      teacherName: 'דנה כהן',
      blockedStatuses: ['נדחה', 'בוטל', 'רשימת המתנה'],
    });
    expect(grid.lessons.map((l) => l.id)).toEqual([1]);
  });

  test('excludes Saturday (day 6)', () => {
    const rows = [baseRow, { ...baseRow, id: 2, assigned_day: 6 }];
    const grid = buildScheduleGrid(rows, { teacherName: 'דנה כהן' });
    expect(grid.lessons.map((l) => l.id)).toEqual([1]);
  });

  test('uses assigned_end_time when present for duration', () => {
    const grid = buildScheduleGrid([baseRow], { teacherName: 'דנה כהן' });
    expect(grid.lessons[0].startMins).toBe(900); // 15:00
    expect(grid.lessons[0].endMins).toBe(945); // 15:45
  });

  test('falls back to getLessonDuration(selected_course) when assigned_end_time is missing', () => {
    const row = { ...baseRow, assigned_end_time: null, selected_course: "פסנתר 60 דק'" };
    const grid = buildScheduleGrid([row], { teacherName: 'דנה כהן' });
    expect(grid.lessons[0].startMins).toBe(900); // 15:00
    expect(grid.lessons[0].endMins).toBe(960); // +60min
  });

  test('time range defaults to 08:00-20:00 when the teacher has no lessons', () => {
    const grid = buildScheduleGrid([], { teacherName: 'דנה כהן' });
    expect(grid.rangeStart).toBe(8 * 60);
    expect(grid.slots[0]).toBe(8 * 60);
    expect(grid.slots[grid.slots.length - 1]).toBe(20 * 60 - SLOT_MINUTES);
  });

  test('time range is derived from the earliest start and latest end, rounded to slot boundaries', () => {
    const rows = [
      { ...baseRow, id: 1, assigned_time: '15:10:00', assigned_end_time: '15:40:00' },
      { ...baseRow, id: 2, assigned_day: 2, assigned_time: '17:00:00', assigned_end_time: '17:50:00' },
    ];
    const grid = buildScheduleGrid(rows, { teacherName: 'דנה כהן' });
    expect(grid.rangeStart).toBe(15 * 60); // floored to 15:00
    expect(grid.slots[grid.slots.length - 1]).toBe(17 * 60 + 30); // last slot before 18:00 ceiling
  });

  test('non-overlapping lessons get columnCount 1 and conflict false', () => {
    const rows = [
      { ...baseRow, id: 1, assigned_time: '15:00:00', assigned_end_time: '15:45:00' },
      { ...baseRow, id: 2, assigned_time: '16:00:00', assigned_end_time: '16:45:00' },
    ];
    const grid = buildScheduleGrid(rows, { teacherName: 'דנה כהן' });
    expect(grid.lessons.every((l) => l.columnCount === 1 && l.conflict === false)).toBe(true);
  });

  test('overlapping lessons for the same teacher/day are marked as a conflict and split into columns', () => {
    const rows = [
      { ...baseRow, id: 1, assigned_time: '15:00:00', assigned_end_time: '15:45:00' },
      { ...baseRow, id: 2, assigned_time: '15:15:00', assigned_end_time: '16:00:00' },
    ];
    const grid = buildScheduleGrid(rows, { teacherName: 'דנה כהן' });
    const [a, b] = grid.lessons.sort((x, y) => x.id - y.id);
    expect(a.conflict).toBe(true);
    expect(b.conflict).toBe(true);
    expect(a.columnCount).toBe(2);
    expect(b.columnCount).toBe(2);
    expect(new Set([a.columnIndex, b.columnIndex])).toEqual(new Set([0, 1]));
  });

  describe('group-linked schedule resolution', () => {
    // A registration assigned via the "existing lesson" group picker has no
    // assigned_day/assigned_time of its own — the real schedule lives on the
    // linked group's group_schedules (same source of truth as TeachersTab's
    // getEffectiveSchedule).
    const groupRow = {
      id: 5,
      teacher: 'דנה כהן',
      assigned_day: null,
      assigned_time: null,
      assigned_end_time: null,
      group_id: 'g1',
      student_name: 'קורן קולטקר',
      selected_course: "פסנתר 45 דק'",
      status: 'שובץ',
    };

    test('resolves day/time from the linked group schedule when the registration has none of its own', () => {
      const groupsById = { g1: { group_schedules: [{ day_of_week: 0, start_time: '16:15', end_time: null }] } };
      const grid = buildScheduleGrid([groupRow], { teacherName: 'דנה כהן', groupsById });
      expect(grid.lessons.map((l) => l.id)).toEqual([5]);
      expect(grid.lessons[0].day).toBe(0);
      expect(grid.lessons[0].startMins).toBe(16 * 60 + 15);
    });

    test('falls back to getLessonDuration when the group schedule has no end_time', () => {
      const groupsById = { g1: { group_schedules: [{ day_of_week: 0, start_time: '16:15', end_time: null }] } };
      const grid = buildScheduleGrid([groupRow], { teacherName: 'דנה כהן', groupsById });
      expect(grid.lessons[0].endMins).toBe(16 * 60 + 15 + 45); // getLessonDuration("פסנתר 45 דק'") = 45
    });

    test('uses the group schedule end_time when present', () => {
      const groupsById = { g1: { group_schedules: [{ day_of_week: 0, start_time: '16:15', end_time: '17:15' }] } };
      const grid = buildScheduleGrid([groupRow], { teacherName: 'דנה כהן', groupsById });
      expect(grid.lessons[0].endMins).toBe(17 * 60 + 15);
    });

    test('falls back to the registration own day/time when group_id has no matching group', () => {
      const grid = buildScheduleGrid([groupRow], { teacherName: 'דנה כהן', groupsById: {} });
      expect(grid.lessons).toEqual([]);
    });

    test('falls back to the registration own day/time when the group has no schedules', () => {
      const groupsById = { g1: { group_schedules: [] } };
      const grid = buildScheduleGrid([groupRow], { teacherName: 'דנה כהן', groupsById });
      expect(grid.lessons).toEqual([]);
    });

    test('ignores group linkage for rows without a group_id (direct assignment still works)', () => {
      const groupsById = { g1: { group_schedules: [{ day_of_week: 0, start_time: '16:15', end_time: null }] } };
      const grid = buildScheduleGrid([baseRow], { teacherName: 'דנה כהן', groupsById });
      expect(grid.lessons.map((l) => l.id)).toEqual([1]);
      expect(grid.lessons[0].startMins).toBe(900); // baseRow's own 15:00, unaffected by unrelated group g1
    });
  });
});
