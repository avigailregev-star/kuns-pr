# Close a Teacher's Day to New Registrations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins can mark any teacher's individual day-of-week availability row as "סגור להרשמות חדשות" (closed to new registrations) without deleting it. Closed days behave exactly like capacity-full days on the public registration form (and are blocked server-side too), while the admin "שיבוץ" flow for already-registered students in `AdminTable.jsx` is completely unaffected.

**Architecture:** A new `closed_for_registration boolean` column on `teacher_availability_ranges` carries the flag per teacher+day row. It flows: `TeacherForm.jsx` (admin sets it) → `PUT /api/teachers/[id]` / `POST /api/teachers` (persist) → `GET /api/teachers` (admin re-reads it when editing) and `GET /api/teachers/public` (parent-facing form reads it) → `RegistrationForm.jsx` (treats closed days as "מלא") → `POST /api/register` (server-side re-check, can't be bypassed). `AdminTable.jsx` never reads this flag — untouched by design.

**Tech Stack:** Next.js 14 App Router, React, Jest (`testEnvironment: 'node'`, no component-rendering test infra in this repo — UI changes are verified manually in the browser, following the pattern in `lib/paymentLinks.test.js` / `docs/superpowers/plans/2026-07-02-netanel-yahya-day-filter.md`), Supabase (`@supabase/supabase-js`).

## Global Constraints

- Column name is exactly `closed_for_registration`, type `boolean`, `NOT NULL DEFAULT false`, on `teacher_availability_ranges`.
- `AdminTable.jsx` (the "שיבוץ" assignment flow for already-registered students) must not be modified and must not read this flag — its day availability stays based purely on real capacity (`used_minutes_per_day`).
- Day numbering follows the existing convention already used in `teacher_availability_ranges.day_of_week`: `0`=ראשון (Sunday) ... `6`=שבת (Saturday).
- No schema/migration tooling exists in this repo — DDL (`ALTER TABLE`) is applied manually via the Supabase Dashboard SQL editor, same as every prior column addition (see `supabase-schema.sql` header comment).
- No component-rendering test infra exists — `TeacherForm.jsx` and `RegistrationForm.jsx` changes are verified by manual browser walkthroughs, not Jest. `lib/` and `app/api/**/route.js` changes get real Jest tests, following the mock pattern in `app/api/update-status/route.test.js` and `app/api/groups/route.test.js`.

---

### Task 1: Schema migration

**Files:**
- Modify: `supabase-schema.sql:59-60`

**Interfaces:** None (no code depends on this task directly; later tasks assume the column exists in the real database before their code is exercised against production data — Jest tests use mocked Supabase clients and don't require it).

- [ ] **Step 1: Add the migration line**

In `supabase-schema.sql`, after the existing `max_students`/`weekly_hours_quota` migration lines (59-60):

```sql
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS max_students integer;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS weekly_hours_quota numeric;
ALTER TABLE teacher_availability_ranges ADD COLUMN IF NOT EXISTS closed_for_registration boolean NOT NULL DEFAULT false;
```

- [ ] **Step 2: Commit**

```bash
git add supabase-schema.sql
git commit -m "docs: add closed_for_registration migration for teacher_availability_ranges"
```

- [ ] **Step 3: Run the migration in Supabase (manual, one-time)**

This step cannot be automated from the repo — it must be run by a human with access to the Supabase Dashboard for this project:

1. Open the Supabase Dashboard → SQL Editor.
2. Run:
   ```sql
   ALTER TABLE teacher_availability_ranges ADD COLUMN IF NOT EXISTS closed_for_registration boolean NOT NULL DEFAULT false;
   ```
3. Confirm no error, and that `teacher_availability_ranges` now has the column (Table Editor → `teacher_availability_ranges` → columns list should show `closed_for_registration`, type `bool`, default `false`).

Flag this step to the user explicitly if you are executing this plan autonomously — do not attempt to run DDL through the app's Supabase client (it uses the data API, not a SQL execution channel).

---

### Task 2: Expose `closed_for_registration` from `GET /api/teachers/public`

**Files:**
- Modify: `app/api/teachers/public/route.js:21` (select), `:31` (mapped range object)
- Test: `app/api/teachers/public/route.test.js`

**Interfaces:**
- Produces: each object in a teacher's `teacher_availability_ranges` array returned by this endpoint now has a `closed_for_registration: boolean` field (alongside the existing `day_of_week`, `start_time`, `end_time`).

- [ ] **Step 1: Write the failing test**

Create `app/api/teachers/public/route.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/api/teachers/public/route.test.js`
Expected: FAIL — `toEqual` mismatch, `closed_for_registration` missing from the actual objects.

- [ ] **Step 3: Implement**

In `app/api/teachers/public/route.js`, find (line 21):

```js
    supabase.from('teacher_availability_ranges').select('teacher_id, day_of_week, start_time, end_time'),
```

Replace with:

```js
    supabase.from('teacher_availability_ranges').select('teacher_id, day_of_week, start_time, end_time, closed_for_registration'),
```

Find (line 31):

```js
    rangesMap[r.teacher_id].push({ day_of_week: r.day_of_week, start_time: r.start_time, end_time: r.end_time });
```

Replace with:

```js
    rangesMap[r.teacher_id].push({ day_of_week: r.day_of_week, start_time: r.start_time, end_time: r.end_time, closed_for_registration: r.closed_for_registration });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/api/teachers/public/route.test.js`
Expected: PASS — 1 test passed.

- [ ] **Step 5: Commit**

```bash
git add app/api/teachers/public/route.js app/api/teachers/public/route.test.js
git commit -m "feat: expose closed_for_registration from teachers public API"
```

---

### Task 3: Persist `closed_for_registration` in teacher CRUD routes

**Files:**
- Modify: `app/api/teachers/[id]/route.js:41-46` (PUT — insert mapping)
- Modify: `app/api/teachers/route.js:14` (GET — select), `:58-63` (POST — insert mapping)
- Test: `app/api/teachers/[id]/route.test.js`
- Test: `app/api/teachers/route.test.js`

**Interfaces:**
- Consumes: `availability_ranges` array in the request body, where each entry may include `closed_for_registration: boolean` (produced by Task 4's `TeacherForm.jsx` — but these routes must handle it being absent too, defaulting to `false`, since Task 3 ships before Task 4 wires up the UI).
- Produces: rows inserted into `teacher_availability_ranges` now include `closed_for_registration`. `GET /api/teachers` now selects it back out (nested under `teacher_availability_ranges`) for `TeacherForm.jsx` to read when editing.

- [ ] **Step 1: Write the failing test for PUT (edit)**

Create `app/api/teachers/[id]/route.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest "app/api/teachers/\[id\]/route.test.js"`
Expected: FAIL — both `toEqual` checks mismatch (`closed_for_registration` missing from captured rows).

- [ ] **Step 3: Implement PUT + GET**

In `app/api/teachers/[id]/route.js`, find (lines 41-46):

```js
        .insert(availability_ranges.map((r) => ({
          teacher_id: teacherId,
          day_of_week: r.day_of_week,
          start_time: r.start_time,
          end_time: r.end_time,
        })));
```

Replace with:

```js
        .insert(availability_ranges.map((r) => ({
          teacher_id: teacherId,
          day_of_week: r.day_of_week,
          start_time: r.start_time,
          end_time: r.end_time,
          closed_for_registration: r.closed_for_registration ?? false,
        })));
```

In `app/api/teachers/route.js`, find (line 14):

```js
    .select('*, teacher_availability_ranges(day_of_week, start_time, end_time)')
```

Replace with:

```js
    .select('*, teacher_availability_ranges(day_of_week, start_time, end_time, closed_for_registration)')
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest "app/api/teachers/\[id\]/route.test.js"`
Expected: PASS — 2 tests passed.

- [ ] **Step 5: Write the failing test for POST (create)**

Create `app/api/teachers/route.test.js`:

```js
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
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx jest app/api/teachers/route.test.js`
Expected: FAIL — `toEqual` mismatch, `closed_for_registration` missing from the captured row.

- [ ] **Step 7: Implement POST**

In `app/api/teachers/route.js`, find (lines 58-63):

```js
    await supabase.from('teacher_availability_ranges').insert(
      availability_ranges.map((r) => ({
        teacher_id: data.id,
        day_of_week: r.day_of_week,
        start_time: r.start_time,
        end_time: r.end_time,
      }))
    );
```

Replace with:

```js
    await supabase.from('teacher_availability_ranges').insert(
      availability_ranges.map((r) => ({
        teacher_id: data.id,
        day_of_week: r.day_of_week,
        start_time: r.start_time,
        end_time: r.end_time,
        closed_for_registration: r.closed_for_registration ?? false,
      }))
    );
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx jest app/api/teachers/route.test.js`
Expected: PASS — 1 test passed.

- [ ] **Step 9: Commit**

```bash
git add app/api/teachers/[id]/route.js app/api/teachers/[id]/route.test.js app/api/teachers/route.js app/api/teachers/route.test.js
git commit -m "feat: persist and expose closed_for_registration in teacher CRUD routes"
```

---

### Task 4: `TeacherForm.jsx` — per-day "סגור להרשמות חדשות" checkbox

**Files:**
- Modify: `components/TeacherForm.jsx:36-45` (initial state), `:78-88` (toggle helpers), `:106-108` (submit payload), `:175-204` (render)

**Interfaces:**
- Consumes: `initial.teacher_availability_ranges[].closed_for_registration` (from Task 3's `GET /api/teachers`).
- Produces: `availability_ranges[].closed_for_registration` in the `onSave(...)` payload (consumed by Task 3's `PUT`/`POST` handlers — already implemented and tested).

- [ ] **Step 1: Read `closed_for_registration` into initial state**

Find (lines 36-45):

```js
  const [availabilityRanges, setAvailabilityRanges] = useState(() => {
    const map = {};
    for (const r of (initial.teacher_availability_ranges || [])) {
      map[r.day_of_week] = {
        start_time: (r.start_time || '').slice(0, 5),
        end_time: (r.end_time || '').slice(0, 5),
      };
    }
    return map;
  });
```

Replace with:

```js
  const [availabilityRanges, setAvailabilityRanges] = useState(() => {
    const map = {};
    for (const r of (initial.teacher_availability_ranges || [])) {
      map[r.day_of_week] = {
        start_time: (r.start_time || '').slice(0, 5),
        end_time: (r.end_time || '').slice(0, 5),
        closed_for_registration: !!r.closed_for_registration,
      };
    }
    return map;
  });
```

- [ ] **Step 2: Initialize the flag when a day is turned on, and add a toggle helper**

Find (lines 78-88):

```js
  function toggleDayRange(day) {
    setAvailabilityRanges((prev) => {
      const next = { ...prev };
      if (next[day]) { delete next[day]; } else { next[day] = { start_time: '', end_time: '' }; }
      return next;
    });
  }

  function setRangeTime(day, field, value) {
    setAvailabilityRanges((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  }
```

Replace with:

```js
  function toggleDayRange(day) {
    setAvailabilityRanges((prev) => {
      const next = { ...prev };
      if (next[day]) { delete next[day]; } else { next[day] = { start_time: '', end_time: '', closed_for_registration: false }; }
      return next;
    });
  }

  function setRangeTime(day, field, value) {
    setAvailabilityRanges((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  }

  function toggleClosedForRegistration(day) {
    setAvailabilityRanges((prev) => ({
      ...prev,
      [day]: { ...prev[day], closed_for_registration: !prev[day]?.closed_for_registration },
    }));
  }
```

- [ ] **Step 3: Include the flag in the save payload**

Find (lines 106-108):

```js
        availability_ranges: Object.entries(availabilityRanges)
          .filter(([, t]) => t.start_time && t.end_time)
          .map(([day, t]) => ({ day_of_week: Number(day), start_time: t.start_time, end_time: t.end_time })),
```

Replace with:

```js
        availability_ranges: Object.entries(availabilityRanges)
          .filter(([, t]) => t.start_time && t.end_time)
          .map(([day, t]) => ({
            day_of_week: Number(day),
            start_time: t.start_time,
            end_time: t.end_time,
            closed_for_registration: !!t.closed_for_registration,
          })),
```

- [ ] **Step 4: Add the checkbox to the day row**

Find (lines 189-199):

```js
                {isOn && (
                  <>
                    <input type="time" dir="ltr" className="admin-input py-1 text-sm"
                      value={availabilityRanges[day].start_time}
                      onChange={(e) => setRangeTime(day, 'start_time', e.target.value)} />
                    <span className="text-gray-400 text-sm">עד</span>
                    <input type="time" dir="ltr" className="admin-input py-1 text-sm"
                      value={availabilityRanges[day].end_time}
                      onChange={(e) => setRangeTime(day, 'end_time', e.target.value)} />
                  </>
                )}
```

Replace with:

```js
                {isOn && (
                  <>
                    <input type="time" dir="ltr" className="admin-input py-1 text-sm"
                      value={availabilityRanges[day].start_time}
                      onChange={(e) => setRangeTime(day, 'start_time', e.target.value)} />
                    <span className="text-gray-400 text-sm">עד</span>
                    <input type="time" dir="ltr" className="admin-input py-1 text-sm"
                      value={availabilityRanges[day].end_time}
                      onChange={(e) => setRangeTime(day, 'end_time', e.target.value)} />
                    <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="accent-red-500 cursor-pointer"
                        checked={!!availabilityRanges[day].closed_for_registration}
                        onChange={() => toggleClosedForRegistration(day)}
                      />
                      סגור להרשמות חדשות
                    </label>
                  </>
                )}
```

- [ ] **Step 5: Run the existing test suite to confirm nothing broke**

Run: `npx jest`
Expected: PASS — all suites, including the new ones from Tasks 2-3, still pass (no test targets `TeacherForm.jsx` directly — this is a regression check on everything else).

- [ ] **Step 6: Manual verification in the browser**

Run: `npm run dev`

In the admin panel (Teachers tab):
1. Open an existing teacher for editing. Under "זמינות מדויקת", each active day row now shows a "סגור להרשמות חדשות" checkbox after the time fields.
2. Check the box for one day (e.g. Sunday), save. Re-open the same teacher for editing — the checkbox for that day must still be checked (confirms Task 3's `GET` round-trip works).
3. Turn a day off entirely (click its day button to remove the range) — confirm the checkbox disappears along with the time fields, and re-enabling the day resets the checkbox to unchecked.

- [ ] **Step 7: Commit**

```bash
git add components/TeacherForm.jsx
git commit -m "feat: add per-day \"closed to new registrations\" toggle in TeacherForm"
```

---

### Task 5: `RegistrationForm.jsx` — treat closed days as full

**Files:**
- Modify: `components/RegistrationForm.jsx:160` (`selectedTeacherAllFull`), `:652` (day-picker `isFull`)

**Interfaces:**
- Consumes: `closed_for_registration` on each entry of `teacher.teacher_availability_ranges` (from Task 2's `GET /api/teachers/public`).

- [ ] **Step 1: Apply the flag in `selectedTeacherAllFull`**

Find (lines 154-161):

```js
    if (ranges.length > 0) {
      return ranges.every(s => {
        const used = teacher.used_minutes_per_day?.[s.day_of_week] || 0;
        if (!s.start_time || !s.end_time) return false;
        const [sh, sm] = s.start_time.split(':').map(Number);
        const [eh, em] = s.end_time.split(':').map(Number);
        return ((eh * 60 + em) - (sh * 60 + sm) - used) < dur;
      });
    }
```

Replace with:

```js
    if (ranges.length > 0) {
      return ranges.every(s => {
        if (s.closed_for_registration) return true;
        const used = teacher.used_minutes_per_day?.[s.day_of_week] || 0;
        if (!s.start_time || !s.end_time) return false;
        const [sh, sm] = s.start_time.split(':').map(Number);
        const [eh, em] = s.end_time.split(':').map(Number);
        return ((eh * 60 + em) - (sh * 60 + sm) - used) < dur;
      });
    }
```

- [ ] **Step 2: Apply the flag in the day-picker buttons**

Find (lines 650-652):

```js
                          const freeMins = totalMins - usedMins;
                          const isFull = freeMins < lessonDuration;
```

Replace with:

```js
                          const freeMins = totalMins - usedMins;
                          const isFull = freeMins < lessonDuration || !!s.closed_for_registration;
```

- [ ] **Step 3: Run the existing test suite to confirm nothing broke**

Run: `npx jest`
Expected: PASS — all suites still pass.

- [ ] **Step 4: Manual verification in the browser**

Prerequisite: complete Task 4's Step 6 first so at least one teacher has a day marked `closed_for_registration = true`.

Run: `npm run dev`

On the public registration page (`/register`):
1. Start a registration flow that reaches the day-picker for that teacher (`type` = `continue` or `new` with `attendedOpenDay = true`, course matching that teacher).
2. The day you closed in Task 4 must render as a disabled, greyed-out button labeled "מלא" — identical in appearance to a genuinely capacity-full day, not clickable.
3. Any other open day for that teacher must remain selectable as normal.
4. If you close every active day for that teacher, the "⚠️ כל הימים אצל המורה תפוסים כרגע" waiting-list message must appear.

- [ ] **Step 5: Commit**

```bash
git add components/RegistrationForm.jsx
git commit -m "feat: treat closed_for_registration days as full in the registration form"
```

---

### Task 6: Server-side enforcement in `POST /api/register`

**Files:**
- Modify: `app/api/register/route.js:154-181` (day-specific check), `:184-223` (all-days-full check)
- Test: `app/api/register/route.test.js`

**Interfaces:**
- Consumes: `closed_for_registration` on `teacher_availability_ranges` rows fetched directly from Supabase within this route (independent of Tasks 2-3's API layer — this route queries Supabase itself).

This mirrors the existing capacity double-check described in `docs/superpowers/specs/2026-05-02-day-capacity-design.md` Part 3: even if the UI is bypassed (a raw POST to `/api/register`), a closed day must still route the registration to `רשימת המתנה`. A closed day gets a distinct admin note ("סגור להרשמות חדשות") instead of the generic "מלא" one, so staff can tell the two cases apart when reviewing `admin_notes`.

- [ ] **Step 1: Write the failing tests**

Create `app/api/register/route.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest app/api/register/route.test.js`
Expected: FAIL — the first and third tests expect `'רשימת המתנה'` but get `'חדש'` (the route doesn't know about `closed_for_registration` yet); the second test should already pass (behavior unchanged for the open-day case).

- [ ] **Step 3: Implement the day-specific check**

Find (lines 154-180):

```js
      const { data: teacherRow } = await supabase
        .from('teachers')
        .select('available_hours, teacher_availability_ranges(day_of_week, start_time, end_time)')
        .eq('name', selectedTeacher)
        .single();

      const dayNum = Number(selectedDay);
      const isNumericDay = !isNaN(dayNum) && String(dayNum) === String(selectedDay);
      let free;

      if (isNumericDay) {
        const range = (teacherRow?.teacher_availability_ranges || [])
          .find(r => r.day_of_week === dayNum);
        if (range?.start_time && range?.end_time) {
          const [sh, sm] = range.start_time.split(':').map(Number);
          const [eh, em] = range.end_time.split(':').map(Number);
          free = (eh * 60 + em) - (sh * 60 + sm) - usedMins;
        }
      } else {
        free = freeMinutesOnDay(teacherRow?.available_hours || {}, selectedDay, usedMins);
      }

      if (free != null && free < lessonDuration) {
        initialStatus = 'רשימת המתנה';
        adminNotes = (adminNotes ? adminNotes + ' | ' : '') +
          `⚠️ יום ${selectedDay} מלא אצל ${selectedTeacher} — הוכנס לרשימת המתנה`;
      }
    }
```

Replace with:

```js
      const { data: teacherRow } = await supabase
        .from('teachers')
        .select('available_hours, teacher_availability_ranges(day_of_week, start_time, end_time, closed_for_registration)')
        .eq('name', selectedTeacher)
        .single();

      const dayNum = Number(selectedDay);
      const isNumericDay = !isNaN(dayNum) && String(dayNum) === String(selectedDay);
      let free;
      let dayClosed = false;

      if (isNumericDay) {
        const range = (teacherRow?.teacher_availability_ranges || [])
          .find(r => r.day_of_week === dayNum);
        if (range?.start_time && range?.end_time) {
          const [sh, sm] = range.start_time.split(':').map(Number);
          const [eh, em] = range.end_time.split(':').map(Number);
          free = (eh * 60 + em) - (sh * 60 + sm) - usedMins;
        }
        dayClosed = !!range?.closed_for_registration;
      } else {
        free = freeMinutesOnDay(teacherRow?.available_hours || {}, selectedDay, usedMins);
      }

      if (dayClosed) {
        initialStatus = 'רשימת המתנה';
        adminNotes = (adminNotes ? adminNotes + ' | ' : '') +
          `⚠️ יום ${selectedDay} סגור להרשמות חדשות אצל ${selectedTeacher} — הוכנס לרשימת המתנה`;
      } else if (free != null && free < lessonDuration) {
        initialStatus = 'רשימת המתנה';
        adminNotes = (adminNotes ? adminNotes + ' | ' : '') +
          `⚠️ יום ${selectedDay} מלא אצל ${selectedTeacher} — הוכנס לרשימת המתנה`;
      }
    }
```

- [ ] **Step 4: Implement the all-days-full check**

Find (lines 186-207):

```js
      const { data: teacherFull } = await supabase
        .from('teachers')
        .select('available_days, available_hours, teacher_availability_ranges(day_of_week, start_time, end_time)')
        .eq('name', selectedTeacher)
        .single();

      if (teacherFull) {
        const usedMapFull = await buildUsedMinutesMap(supabase);
        const lessonDur = getLessonDuration(selectedCourse);
        const ranges = teacherFull.teacher_availability_ranges || [];
        const oldDays = teacherFull.available_days || [];

        if (ranges.length > 0 || oldDays.length > 0) {
          let allFull = true;
          if (ranges.length > 0) {
            for (const r of ranges) {
              const used = (usedMapFull[selectedTeacher] || {})[r.day_of_week] || 0;
              if (!r.start_time || !r.end_time) { allFull = false; break; }
              const [sh, sm] = r.start_time.split(':').map(Number);
              const [eh, em] = r.end_time.split(':').map(Number);
              if ((eh * 60 + em) - (sh * 60 + sm) - used >= lessonDur) { allFull = false; break; }
            }
          } else {
```

Replace with:

```js
      const { data: teacherFull } = await supabase
        .from('teachers')
        .select('available_days, available_hours, teacher_availability_ranges(day_of_week, start_time, end_time, closed_for_registration)')
        .eq('name', selectedTeacher)
        .single();

      if (teacherFull) {
        const usedMapFull = await buildUsedMinutesMap(supabase);
        const lessonDur = getLessonDuration(selectedCourse);
        const ranges = teacherFull.teacher_availability_ranges || [];
        const oldDays = teacherFull.available_days || [];

        if (ranges.length > 0 || oldDays.length > 0) {
          let allFull = true;
          if (ranges.length > 0) {
            for (const r of ranges) {
              if (r.closed_for_registration) continue; // closed days can't make allFull false
              const used = (usedMapFull[selectedTeacher] || {})[r.day_of_week] || 0;
              if (!r.start_time || !r.end_time) { allFull = false; break; }
              const [sh, sm] = r.start_time.split(':').map(Number);
              const [eh, em] = r.end_time.split(':').map(Number);
              if ((eh * 60 + em) - (sh * 60 + sm) - used >= lessonDur) { allFull = false; break; }
            }
          } else {
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest app/api/register/route.test.js`
Expected: PASS — 3 tests passed.

- [ ] **Step 6: Run the full test suite**

Run: `npx jest`
Expected: PASS — every suite in the repo passes.

- [ ] **Step 7: Commit**

```bash
git add app/api/register/route.js app/api/register/route.test.js
git commit -m "feat: enforce closed_for_registration server-side in /api/register"
```

---

### Task 7: End-to-end manual verification

**Files:** None (verification only, no code changes).

**Interfaces:** None.

- [ ] **Step 1: Full flow walkthrough**

Run: `npm run dev`

1. Admin panel → Teachers → pick a teacher with at least two active days and at least one existing assigned student. Mark one day "סגור להרשמות חדשות" and save.
2. Public registration form (`/register`) → drive a flow to that teacher's day-picker → confirm the closed day shows as "מלא" and cannot be selected, while other days remain selectable (Task 5's checks).
3. Admin panel → open a registration row for a student **already assigned** to that teacher on the closed day (or create one via `AdminTable`'s שיבוץ) → confirm the day still appears as a selectable option in the assignment picker there, based only on real capacity — proving `AdminTable.jsx` is unaffected by the closed flag, per Task Global Constraints.
4. Re-open the teacher in TeacherForm → confirm the checkbox is still checked for that day (persistence round-trip across Tasks 3-4).

- [ ] **Step 2: Confirm no regressions in the full test suite**

Run: `npx jest`
Expected: PASS — all suites (pre-existing plus the five new/updated ones from Tasks 2, 3, 3, 6) pass.

---

## Self-Review Notes

- **Spec coverage:** Part 1 (data model) → Task 1. Part 2 (admin UI) → Task 4. Part 3 (persistence) → Task 3. Part 4 (public form) → Task 2 + Task 5. Part 5 (server-side enforcement) → Task 6. Part 6 (AdminTable unchanged) → verified behaviorally in Task 7, Step 1.3, and enforced as a hard constraint (no AdminTable.jsx file touched by any task).
- **No placeholders:** every step has literal code, exact commands, and expected output; Task 1's manual Supabase step is explicitly called out as non-automatable rather than glossed over.
- **Type/name consistency:** `closed_for_registration` (boolean) is the identical field name across the schema (Task 1), all four API routes (Tasks 2-3, 6), and both UI files (Tasks 4-5) — verified by re-reading every occurrence above.
- **Ordering:** API-layer tasks (2, 3) precede the UI tasks that consume their output (4, 5), and both precede the independent server-enforcement task (6), which precedes the full end-to-end check (7).
