# Teacher Schedule Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only "מערכת שעות" (schedule) tab to the admin dashboard that shows, per selected teacher, a weekly day×hour grid of their assigned private lessons.

**Architecture:** A pure, unit-tested data module (`lib/scheduleGrid.js`) turns the flat `registrations` rows into a grid model (time slots + positioned lesson blocks, with overlap/conflict detection and side-by-side column packing). A new client component (`components/ScheduleGrid.jsx`) fetches teachers and registrations from the existing `/api/teachers` and `/api/registrations` endpoints, lets the admin pick a teacher, and renders the grid model. The existing admin tab-nav in `app/admin/(protected)/page.js` gets a third `?tab=schedule` entry.

**Tech Stack:** Next.js 14 (App Router), React 18 client components, Tailwind CSS, Jest (via `next/jest`) for the pure-logic unit tests.

## Global Constraints

- No new API routes — reuse the existing `/api/teachers` (returns `{ data: [...] }`, each teacher has `id`, `name`) and `/api/registrations` (returns `{ data: [...] }`, each row has `teacher`, `assigned_day` (0–6, string or number), `assigned_time` ("HH:MM:SS"), `assigned_end_time`, `student_name`, `selected_course`, `status`).
- Tab navigation stays query-param based (`/admin?tab=schedule`), matching the existing `registrations`/`teachers` tabs in `app/admin/(protected)/page.js` — do not create a separate route folder.
- Grid covers only individual lessons (teacher + `assigned_day` + `assigned_time`) — no orchestra/choir/theory.
- Days shown: ראשון–שישי only (`assigned_day` 0–5); exclude שבת (6).
- Exclude rows whose `status` is in `['נדחה', 'בוטל', 'רשימת המתנה']` (same list as `LOCKED_ASSIGNMENT_STATUSES` in `components/AdminTable.jsx:14`), matching how blocked statuses are already treated elsewhere.
- Read-only view — no click handlers on lesson cells.
- All UI copy in Hebrew, consistent with the rest of the admin dashboard.
- Per existing repo convention, only pure logic in `lib/*.js` gets Jest unit tests (see `lib/fixedCourseDays.test.js`); React components (`components/*.jsx`) are verified manually via the dev server, not unit-tested.

---

### Task 1: Pure schedule-grid data module

**Files:**
- Create: `lib/scheduleGrid.js`
- Test: `lib/scheduleGrid.test.js`

**Interfaces:**
- Consumes: `getLessonDuration(courseName)` from `lib/lessonDuration.js` (returns `45`/`60`/`90`, already exists).
- Produces (used by Task 2):
  - `SLOT_MINUTES` (number, `30`)
  - `timeToMins(t: string | null | undefined): number | null`
  - `minsToTime(mins: number): string` (`"HH:MM"`)
  - `buildScheduleGrid(registrations: Array<object>, { teacherName: string, blockedStatuses?: string[] }): { slots: number[], rangeStart: number, lessons: Array<{ id, day, startMins, endMins, studentName, course, columnIndex, columnCount, conflict }> }`

- [ ] **Step 1: Write the failing tests**

Create `lib/scheduleGrid.test.js`:

```js
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest lib/scheduleGrid.test.js`
Expected: FAIL — `Cannot find module './scheduleGrid'`

- [ ] **Step 3: Write the implementation**

Create `lib/scheduleGrid.js`:

```js
import { getLessonDuration } from './lessonDuration';

export const SLOT_MINUTES = 30;
const DEFAULT_RANGE_START = 8 * 60;
const DEFAULT_RANGE_END = 20 * 60;

export function timeToMins(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minsToTime(mins) {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

function floorToSlot(mins) {
  return Math.floor(mins / SLOT_MINUTES) * SLOT_MINUTES;
}

function ceilToSlot(mins) {
  return Math.ceil(mins / SLOT_MINUTES) * SLOT_MINUTES;
}

function assignColumnsForDay(dayLessons) {
  const sorted = [...dayLessons].sort((a, b) => a.startMins - b.startMins);
  const groups = [];
  let currentGroup = [];
  let currentEnd = -Infinity;

  for (const lesson of sorted) {
    if (currentGroup.length > 0 && lesson.startMins >= currentEnd) {
      groups.push(currentGroup);
      currentGroup = [];
      currentEnd = -Infinity;
    }
    currentGroup.push(lesson);
    currentEnd = Math.max(currentEnd, lesson.endMins);
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  const result = [];
  for (const group of groups) {
    const columnCount = group.length;
    const conflict = columnCount > 1;
    group.forEach((lesson, index) => {
      result.push({ ...lesson, columnIndex: index, columnCount, conflict });
    });
  }
  return result;
}

export function buildScheduleGrid(registrations, { teacherName, blockedStatuses = [] }) {
  const lessons = registrations
    .filter((r) => r.teacher === teacherName)
    .filter((r) => r.assigned_day != null && r.assigned_day !== '' && r.assigned_time)
    .filter((r) => !blockedStatuses.includes(r.status))
    .map((r) => {
      const startMins = timeToMins(r.assigned_time);
      const durationMins = r.assigned_end_time
        ? timeToMins(r.assigned_end_time) - startMins
        : getLessonDuration(r.selected_course);
      return {
        id: r.id,
        day: Number(r.assigned_day),
        startMins,
        endMins: startMins + durationMins,
        studentName: r.student_name,
        course: r.selected_course,
      };
    })
    .filter((l) => l.day >= 0 && l.day <= 5);

  let rangeStart = DEFAULT_RANGE_START;
  let rangeEnd = DEFAULT_RANGE_END;
  if (lessons.length > 0) {
    rangeStart = floorToSlot(Math.min(...lessons.map((l) => l.startMins)));
    rangeEnd = ceilToSlot(Math.max(...lessons.map((l) => l.endMins)));
  }

  const slots = [];
  for (let m = rangeStart; m < rangeEnd; m += SLOT_MINUTES) slots.push(m);

  const lessonsWithColumns = [];
  for (let day = 0; day <= 5; day++) {
    const dayLessons = lessons.filter((l) => l.day === day);
    lessonsWithColumns.push(...assignColumnsForDay(dayLessons));
  }

  return { slots, rangeStart, lessons: lessonsWithColumns };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest lib/scheduleGrid.test.js`
Expected: PASS (all 11 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/scheduleGrid.js lib/scheduleGrid.test.js
git commit -m "feat: add pure schedule-grid data module for teacher weekly view"
```

---

### Task 2: Schedule tab UI

**Files:**
- Create: `components/ScheduleGrid.jsx`
- Modify: `app/admin/(protected)/page.js`

**Interfaces:**
- Consumes: `buildScheduleGrid`, `minsToTime`, `SLOT_MINUTES` from `lib/scheduleGrid.js` (Task 1); `GET /api/teachers` → `{ data: [{ id, name, ... }] }`; `GET /api/registrations` → `{ data: [...] }`.
- Produces: default-exported `ScheduleGrid` React component, rendered from `app/admin/(protected)/page.js` when `tab === 'schedule'`.

- [ ] **Step 1: Create the component**

Create `components/ScheduleGrid.jsx`:

```jsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { buildScheduleGrid, minsToTime, SLOT_MINUTES } from '../lib/scheduleGrid';

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
const BLOCKED_STATUSES = ['נדחה', 'בוטל', 'רשימת המתנה'];
const SLOT_HEIGHT = 28; // px

export default function ScheduleGrid() {
  const [teachers, setTeachers] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [teachersRes, registrationsRes] = await Promise.all([
          fetch('/api/teachers'),
          fetch('/api/registrations'),
        ]);
        const teachersJson = await teachersRes.json();
        const registrationsJson = await registrationsRes.json();
        if (teachersJson.error) throw new Error(teachersJson.error);
        if (registrationsJson.error) throw new Error(registrationsJson.error);
        setTeachers(teachersJson.data || []);
        setRegistrations(registrationsJson.data || []);
        if (teachersJson.data?.length > 0) setSelectedTeacher(teachersJson.data[0].name);
      } catch (err) {
        setError(err.message || 'שגיאה בטעינת הנתונים');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const grid = useMemo(() => {
    if (!selectedTeacher) return null;
    return buildScheduleGrid(registrations, { teacherName: selectedTeacher, blockedStatuses: BLOCKED_STATUSES });
  }, [registrations, selectedTeacher]);

  if (loading) return <p className="text-gray-500">טוען...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">מערכת שעות</h1>

      <select
        value={selectedTeacher}
        onChange={(e) => setSelectedTeacher(e.target.value)}
        className="mb-4 border border-gray-300 rounded px-3 py-2 text-sm"
      >
        {teachers.map((t) => (
          <option key={t.id} value={t.name}>{t.name}</option>
        ))}
      </select>

      {teachers.length === 0 && <p className="text-gray-500">אין מורים במערכת.</p>}

      {grid && (
        <div className="flex border border-gray-200 text-xs w-fit">
          <div className="w-16 shrink-0">
            <div className="h-10 border-b border-gray-200 bg-gray-50" />
            {grid.slots.map((slotMins) => (
              <div
                key={slotMins}
                className="border-b border-gray-100 flex items-center justify-center text-gray-400"
                style={{ height: SLOT_HEIGHT }}
              >
                {minsToTime(slotMins)}
              </div>
            ))}
          </div>

          {DAY_NAMES.map((name, dayIdx) => (
            <div key={name} className="w-40 border-r border-gray-200 relative">
              <div className="h-10 border-b border-gray-200 bg-gray-50 flex items-center justify-center font-medium text-gray-700">
                {name}
              </div>
              <div className="relative" style={{ height: grid.slots.length * SLOT_HEIGHT }}>
                {grid.slots.map((slotMins) => (
                  <div key={slotMins} className="border-b border-gray-100" style={{ height: SLOT_HEIGHT }} />
                ))}
                {grid.lessons
                  .filter((l) => l.day === dayIdx)
                  .map((lesson) => (
                    <div
                      key={lesson.id}
                      className={`absolute rounded px-1 py-0.5 overflow-hidden text-[11px] ${
                        lesson.conflict
                          ? 'bg-red-50 border-2 border-red-400'
                          : 'bg-green-50 border border-green-300'
                      }`}
                      style={{
                        top: ((lesson.startMins - grid.rangeStart) / SLOT_MINUTES) * SLOT_HEIGHT,
                        height: Math.max(1, (lesson.endMins - lesson.startMins) / SLOT_MINUTES) * SLOT_HEIGHT,
                        left: `${(lesson.columnIndex / lesson.columnCount) * 100}%`,
                        width: `${100 / lesson.columnCount}%`,
                      }}
                    >
                      <div className="font-medium text-gray-800 truncate">{lesson.studentName}</div>
                      <div className="text-gray-500 truncate">
                        {minsToTime(lesson.startMins)}–{minsToTime(lesson.endMins)}
                      </div>
                      <div className="text-gray-500 truncate">{lesson.course}</div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire the tab into the admin nav**

Modify `app/admin/(protected)/page.js` — full new contents:

```jsx
import AdminTable from '../../../components/AdminTable';
import TeachersTab from '../../../components/TeachersTab';
import ScheduleGrid from '../../../components/ScheduleGrid';

export const metadata = {
  title: 'לוח בקרה | ניהול קונסרבטוריון',
};

export default function AdminDashboard({ searchParams }) {
  const tab = searchParams?.tab || 'registrations';

  return (
    <div>
      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <a
          href="/admin"
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            tab === 'registrations'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          רישומים
        </a>
        <a
          href="/admin?tab=teachers"
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            tab === 'teachers'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          מורים
        </a>
        <a
          href="/admin?tab=schedule"
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            tab === 'schedule'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          מערכת שעות
        </a>
      </div>

      {tab === 'registrations' && (
        <>
          <h1 className="text-2xl font-bold text-gray-800 mb-6">ניהול רישומים</h1>
          <AdminTable />
        </>
      )}

      {tab === 'teachers' && <TeachersTab />}

      {tab === 'schedule' && <ScheduleGrid />}
    </div>
  );
}
```

- [ ] **Step 3: Verify manually**

Run: `npm run dev`

Then in the browser:
1. Sign in and open `/admin?tab=schedule`.
2. Confirm the "מערכת שעות" tab is highlighted and a teacher selector + grid render.
3. Switch teachers in the dropdown and confirm the grid's time range and lesson blocks update.
4. Pick a teacher with at least one assigned individual lesson and confirm the block shows student name, time range, and course, sized to its duration.
5. Pick a teacher with no assigned lessons and confirm the grid still renders with the 08:00–20:00 default range and no blocks.
6. (Optional, if test data allows) Confirm that two overlapping lessons for the same teacher render side by side with a red border.

Expected: all checks pass with no console errors.

- [ ] **Step 4: Commit**

```bash
git add components/ScheduleGrid.jsx "app/admin/(protected)/page.js"
git commit -m "feat: add teacher schedule grid tab to admin dashboard"
```
