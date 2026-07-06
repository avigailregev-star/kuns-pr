# Schedule Conflict Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block saving a teacher+day+time assignment on a registration when it overlaps another student's assignment or an existing group's schedule for the same teacher — closing the gap where two students could be double-booked with the same teacher via the normal per-row assignment flow (only the "צור שיעור" form currently has this protection).

**Architecture:** A single new guard block added to `app/api/update-status/route.js`'s `POST` handler, placed before the registration is updated. It queries other registrations for the same teacher and that teacher's existing groups/schedules, using the same overlap-math pattern already used in `app/api/groups/route.js`. On conflict, it returns HTTP 409 with an error message — the client's existing `alert(json.error)` handling in `saveAssignment` (`components/AdminTable.jsx`) needs no changes to display it.

**Tech Stack:** Next.js App Router API routes, Supabase, Jest (`next/jest`) with a mocked Supabase client (same pattern as `app/api/groups/route.test.js`).

## Global Constraints

- The check runs only when `teacher`, `assignedDay`, and `assignedTime` are all present in the request body — untouched for requests that don't change the assignment (status-only or notes-only updates).
- The check must run and return its error response *before* the registration is updated in the database — a rejected request must not modify anything.
- Two independent conflict sources, both must be checked: (1) other `registrations` rows for the same teacher (by `teacher` name, excluding the current `id`, excluding cancelled/rejected/waitlisted/pending-intro statuses), and (2) that teacher's `groups` + `group_schedules`.
- Reuse `getLessonDuration` from `lib/lessonDuration.js` for a compared registration's duration when it has no `assigned_end_time` stored. Do not reimplement duration logic.
- The existing overlap check in `app/api/groups/route.js` is not touched by this plan — it already works and is out of scope.
- Excluded statuses (copied verbatim from `lib/syncToAttendance.js`): `['בוטל', 'נדחה', 'רשימת המתנה', 'ממתין לשיחת היכרות']`.

---

## Spec Reference

`docs/superpowers/specs/2026-07-06-schedule-conflict-check-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `app/api/update-status/route.js` | Modified. Adds the conflict-check guard block before the registration update. |
| `app/api/update-status/route.test.js` | New. Mocked-Supabase tests for the new guard (registration conflict, group conflict, no-conflict pass-through). |

---

## Task 1: Add the schedule conflict check

**Files:**
- Modify: `app/api/update-status/route.js:23-25` (insert point)
- Test: `app/api/update-status/route.test.js` (new)

**Interfaces:**
- Consumes: `getLessonDuration(courseName)` from `../../../lib/lessonDuration` (existing, returns a number of minutes — 45 default, 60 if the name contains "60", 90 if it contains "90" or starts with "CUBASE").
- Produces: no new exports. `POST` now returns an additional possible response: `NextResponse.json({ error: '<message>' }, { status: 409 })` when a conflict is found, before any database write happens.

- [ ] **Step 1: Write the failing tests**

Create `app/api/update-status/route.test.js`:

```js
import { POST } from './route';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));
jest.mock('../auth/[...nextauth]/route', () => ({ authOptions: {} }));
jest.mock('../../../lib/supabase', () => ({
  getSupabaseClient: jest.fn(),
}));
jest.mock('../../../lib/makeWebhook', () => ({
  sendToMake: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../lib/email', () => ({
  sendAssignmentEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../lib/syncToAttendance', () => ({
  syncRegistrationToAttendance: jest.fn().mockResolvedValue(undefined),
}));

import { getServerSession } from 'next-auth';
import { getSupabaseClient } from '../../../lib/supabase';

function makeRequest(body) {
  return { json: async () => body };
}

// Same queue-per-table mock pattern as app/api/groups/route.test.js: every
// call chain on a table (whether it ends in .single()/.maybeSingle() or is
// awaited directly) consumes the next queued response for that table, in
// call order.
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
      eq: () => self,
      neq: () => self,
      in: () => self,
      insert: () => self,
      update: () => self,
      order: () => self,
      single: () => Promise.resolve(nextResponse(table)),
      maybeSingle: () => Promise.resolve(nextResponse(table)),
      then: (resolve, reject) => Promise.resolve(nextResponse(table)).then(resolve, reject),
    };
    return self;
  }
  const from = jest.fn(table => builder(table));
  return { from };
}

beforeEach(() => {
  getServerSession.mockResolvedValue({ user: { name: 'admin' } });
});

describe('POST /api/update-status — schedule conflict check', () => {
  test('rejects with 409 when another registration for the same teacher overlaps', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        {
          data: [
            {
              id: 'r2',
              student_name: 'שרה לוי',
              assigned_day: 1,
              assigned_time: '15:00',
              assigned_end_time: '16:00',
              selected_course: null,
              status: 'שובץ',
            },
          ],
          error: null,
        }, // the "other registrations for this teacher" fetch
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({
      id: 'r1',
      newStatus: 'שובץ',
      teacher: 'דנה כהן',
      assignedDay: 1,
      assignedTime: '15:30',
      assignedEndTime: '16:15',
    }));

    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.error).toContain('שרה לוי');

    // No table other than the conflict-check's own registrations fetch was touched —
    // in particular, no registrations.update ran.
    expect(mockSupabase.from.mock.calls.map(c => c[0])).toEqual(['registrations']);
  });

  test('rejects with 409 when an existing group for the same teacher overlaps', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { data: [], error: null }, // no conflicting individual registrations
      ],
      teachers: [
        { data: { id: 't1' }, error: null },
      ],
      groups: [
        {
          data: [
            { name: 'מקהלה צעירה', group_schedules: [{ day_of_week: 1, start_time: '15:00', end_time: '16:00' }] },
          ],
          error: null,
        },
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({
      id: 'r1',
      newStatus: 'שובץ',
      teacher: 'דנה כהן',
      assignedDay: 1,
      assignedTime: '15:30',
      assignedEndTime: '16:15',
    }));

    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.error).toContain('מקהלה צעירה');

    expect(mockSupabase.from.mock.calls.map(c => c[0])).toEqual(['registrations', 'teachers', 'groups']);
  });

  test('proceeds to save when there is no conflict', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { data: [], error: null }, // no conflicting individual registrations
        { error: null }, // the main registrations.update
        { data: { student_name: 'יוסי כהן', teacher: 'דנה כהן', assigned_day: 1, assigned_time: '15:30', selected_course: null, status: 'ממתין', registration_status: null, group_id: null, id: 'r1' }, error: null }, // post-update select for attendance sync
      ],
      teachers: [
        { data: { id: 't1' }, error: null },
      ],
      groups: [
        { data: [], error: null }, // no groups at all for this teacher
      ],
      message_log: [
        { error: null },
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({
      id: 'r1',
      newStatus: 'ממתין',
      teacher: 'דנה כהן',
      assignedDay: 1,
      assignedTime: '15:30',
      assignedEndTime: '16:15',
    }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest app/api/update-status/route.test.js`
Expected: FAIL — all three tests fail because the conflict-check code doesn't exist yet (the first two expect a 409 but get whatever the current unguarded flow produces; the mock queues also won't line up with the current call sequence).

- [ ] **Step 3: Implement the conflict check**

In `app/api/update-status/route.js`, add this import alongside the existing ones (after line 7):

```js
import { getLessonDuration } from '../../../lib/lessonDuration';
```

Then, replace this block:

```js
    const supabase = getSupabaseClient();

    const updateData = {
```

with:

```js
    const supabase = getSupabaseClient();

    // Block overlapping schedules for the same teacher on the same day
    if (teacher && assignedDay != null && assignedDay !== '' && assignedTime) {
      const toM = t => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
      const dayNum = Number(assignedDay);
      const newStart = toM(assignedTime);
      const newEnd = assignedEndTime ? toM(assignedEndTime) : newStart + getLessonDuration(undefined);

      if (!isNaN(dayNum)) {
        const excludedStatuses = ['בוטל', 'נדחה', 'רשימת המתנה', 'ממתין לשיחת היכרות'];

        const { data: otherRegs } = await supabase
          .from('registrations')
          .select('id, student_name, assigned_day, assigned_time, assigned_end_time, selected_course, status')
          .eq('teacher', teacher)
          .neq('id', id);

        for (const reg of (otherRegs || [])) {
          if (excludedStatuses.includes(reg.status)) continue;
          if (reg.assigned_day == null || reg.assigned_day === '' || !reg.assigned_time) continue;
          if (Number(reg.assigned_day) !== dayNum) continue;
          const regStart = toM(reg.assigned_time);
          const regEnd = reg.assigned_end_time ? toM(reg.assigned_end_time) : regStart + getLessonDuration(reg.selected_course);
          if (newStart < regEnd && regStart < newEnd) {
            return NextResponse.json(
              { error: `חיפוף בזמנים עם ${reg.student_name} באותו יום (${reg.assigned_time.slice(0, 5)})` },
              { status: 409 }
            );
          }
        }

        const { data: teacherRow } = await supabase
          .from('teachers')
          .select('id')
          .eq('name', teacher)
          .maybeSingle();

        if (teacherRow?.id) {
          const { data: teacherGroups } = await supabase
            .from('groups')
            .select('name, group_schedules(day_of_week, start_time, end_time)')
            .eq('teacher_id', teacherRow.id);

          for (const g of (teacherGroups || [])) {
            for (const sched of (g.group_schedules || [])) {
              if (Number(sched.day_of_week) !== dayNum || !sched.start_time) continue;
              const schedStart = toM(sched.start_time);
              const schedEnd = sched.end_time ? toM(sched.end_time) : schedStart + 60;
              if (newStart < schedEnd && schedStart < newEnd) {
                return NextResponse.json(
                  { error: `חיפוף בזמנים עם הקבוצה "${g.name}" באותו יום (${sched.start_time})` },
                  { status: 409 }
                );
              }
            }
          }
        }
      }
    }

    const updateData = {
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest app/api/update-status/route.test.js`
Expected: PASS — 3 tests passed

- [ ] **Step 5: Run the full test suite and build**

Run: `npx jest`
Expected: PASS — 5 suites now (the 4 existing plus this new one), all green.

Run: `npx next build`
Expected: `✓ Compiled successfully`, no errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/update-status/route.js app/api/update-status/route.test.js
git commit -m "fix: block overlapping teacher schedules on direct assignment save"
```

---

## Task 2: Manual verification

No live-data browser testing (per team preference — this touches the same production database the earlier features do). Verified via the automated tests in Task 1 plus a direct code re-read.

**Files:** none (verification only).

- [ ] **Step 1: Re-read the final diff**

Read the committed change in `app/api/update-status/route.js` once more end to end. Confirm: the guard returns before `updateData` is built (so a rejected request never reaches `supabase.from('registrations').update(...)`), and that requests without `teacher`+`assignedDay`+`assignedTime` together (e.g., a pure status change or a notes edit) skip the guard entirely and behave exactly as before.

- [ ] **Step 2: Confirm the error surfaces in the UI without any client change**

Read `components/AdminTable.jsx`'s `saveAssignment` function. Confirm its existing `if (!res.ok) { ... alert(json.error || 'שגיאה בשמירה — נסה שוב'); return; }` branch (already present, unmodified by this plan) will display this new 409's `error` message verbatim when it fires.
