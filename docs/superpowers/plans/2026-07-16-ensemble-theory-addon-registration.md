# Ensemble/Theory Add-on Registration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let office staff add an ensemble (הרכב) and/or theory (תיאוריה) placement to a student who is already registered as individual (פרטני), directly from that student's row in `AdminTable.jsx`, reusing the existing group/attendance-sync mechanism instead of building new attendance or teacher UI.

**Architecture:** A new registration row is created per add-on (mirrors how every other lesson type is represented — one `registrations` row = one teacher/day/time/group slot). A new `linked_registration_id` column ties the add-on row back to the student's original registration for auto-fill, duplicate prevention, and the theory-scheduling hint. A new API route (`POST /api/registrations/addon`) creates that row — either attaching it to an existing group (teacher/day/time copied from the group's own schedule) or leaving it unassigned for the office to schedule manually via the existing "שיבוץ"/"צור שיעור" UI, unchanged. `AdminTable.jsx` gains the trigger buttons, an inline group picker, a small lesson-type badge, and a scheduling hint box.

**Tech Stack:** Next.js App Router API routes, React (client component), Supabase, Jest (`next/jest`).

## Global Constraints

- No new attendance-marking or teacher-facing UI — attendance continues to be handled entirely by the separate attendance app, which reads the same `groups`/`group_schedules`/`students` tables this app already writes to via `lib/syncToAttendance.js`. That file is not modified.
- No changes to the public registration form (`app/page.js`, `app/api/register/route.js`) — this feature is 100% admin-initiated from `AdminTable.jsx`.
- No assignment/confirmation email or Make webhook call is sent when an add-on registration is created — this is an internal office action on an existing student, not a new lead. (Existing `sendAssignmentEmail`/`sendToMake` calls live only in `app/api/update-status/route.js` and are untouched; the new route does not call them.)
- Ensemble label choices for "create a brand-new group" are restricted to the existing fixed set in `lib/groupNaming.js` (`ENSEMBLE_LABELS`, derived from `LESSON_TYPE_OPTIONS`); theory has exactly one label, `'תיאוריה'`. No free-text group naming is introduced by this feature.
- Deleting the original (source) registration must not delete its linked add-on rows — `linked_registration_id` uses `ON DELETE SET NULL`, never cascade.
- A student may have more than one active ensemble add-on, but at most one active (non-`נדחה`/`בוטל`) theory add-on at a time.

---

## Spec Reference

`docs/superpowers/specs/2026-07-16-ensemble-theory-addon-registration-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/groupNaming.js` | Modified. Adds `THEORY_LABEL`, `ENSEMBLE_LABELS`, and `getAddonBadge()` — pure helpers reused by both the API route and `AdminTable.jsx`. |
| `lib/groupNaming.test.js` | Modified. Tests for the three new exports. |
| `supabase-schema.sql` | Modified. Adds the `linked_registration_id` migration line. |
| `app/api/registrations/addon/route.js` | New. `POST` handler that creates the linked add-on registration row, optionally attaching it to an existing group. |
| `app/api/registrations/addon/route.test.js` | New. Unit tests using the project's existing queue-per-table Supabase mock pattern. |
| `components/AdminTable.jsx` | Modified. Add-on buttons, inline group picker, lesson-type badge, theory scheduling hint. |

---

## Task 1: `linked_registration_id` helpers in `lib/groupNaming.js`

**Files:**
- Modify: `lib/groupNaming.js`
- Test: `lib/groupNaming.test.js`

**Interfaces:**
- Produces: `THEORY_LABEL` — the string `'תיאוריה'`.
- Produces: `ENSEMBLE_LABELS` — `string[]`, the 8 labels from `LESSON_TYPE_OPTIONS` whose value is `'orchestra'` or `'choir'`, in the order they appear in `LESSON_TYPE_OPTIONS`.
- Produces: `getAddonBadge(selectedCourse: string): { emoji: string, label: string } | null` — `{ emoji: '📘', label: 'תיאוריה' }` when `selectedCourse` resolves (via `getLessonTypeValue`) to `'theory'`; `{ emoji: '🎻', label: 'הרכב' }` when it resolves to `'orchestra'` or `'choir'`; `null` otherwise (including individual/melodies/unknown courses).

- [ ] **Step 1: Write the failing tests**

In `lib/groupNaming.test.js`, change the import on line 1 from:

```js
import { LESSON_TYPE_OPTIONS, getLessonTypeValue, computeGroupName, matchesLessonType } from './groupNaming';
```

to:

```js
import { LESSON_TYPE_OPTIONS, getLessonTypeValue, computeGroupName, matchesLessonType, THEORY_LABEL, ENSEMBLE_LABELS, getAddonBadge } from './groupNaming';
```

Then append to the end of the file:

```js
describe('THEORY_LABEL', () => {
  test('is the exact theory label', () => {
    expect(THEORY_LABEL).toBe('תיאוריה');
  });
});

describe('ENSEMBLE_LABELS', () => {
  test('lists exactly the 8 orchestra/choir labels, in LESSON_TYPE_OPTIONS order', () => {
    expect(ENSEMBLE_LABELS).toEqual([
      'מקהלה צעירה',
      'הזמיר- מקהלה ייצוגית',
      'מקהלת קולות הנגב',
      'תזמורת נשיפה',
      'תזמורת כלי קשת',
      'אנסמבל מוזיקה מן המזרח א',
      'אנסמבל מוזיקה מן המזרח ב',
      'תזמורת מקאם דימונה',
    ]);
  });
});

describe('getAddonBadge', () => {
  test('returns the theory badge for the theory course', () => {
    expect(getAddonBadge('תיאוריה')).toEqual({ emoji: '📘', label: 'תיאוריה' });
  });

  test('returns the ensemble badge for orchestra and choir courses', () => {
    expect(getAddonBadge('תזמורת כלי קשת')).toEqual({ emoji: '🎻', label: 'הרכב' });
    expect(getAddonBadge('מקהלה צעירה')).toEqual({ emoji: '🎻', label: 'הרכב' });
  });

  test('returns null for individual, melodies, and unknown courses', () => {
    expect(getAddonBadge('פרטני 45 דקות')).toBeNull();
    expect(getAddonBadge('מנגינות שנה ב')).toBeNull();
    expect(getAddonBadge('לא קיים')).toBeNull();
    expect(getAddonBadge(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest lib/groupNaming.test.js`
Expected: FAIL — `THEORY_LABEL`/`ENSEMBLE_LABELS`/`getAddonBadge` are not exported.

- [ ] **Step 3: Implement the additions**

Append to `lib/groupNaming.js`:

```js
export const THEORY_LABEL = 'תיאוריה';

export const ENSEMBLE_LABELS = LESSON_TYPE_OPTIONS
  .filter(o => o.value === 'orchestra' || o.value === 'choir')
  .map(o => o.label);

export function getAddonBadge(selectedCourse) {
  const value = getLessonTypeValue(selectedCourse);
  if (value === 'theory') return { emoji: '📘', label: 'תיאוריה' };
  if (value === 'orchestra' || value === 'choir') return { emoji: '🎻', label: 'הרכב' };
  return null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest lib/groupNaming.test.js`
Expected: PASS — all tests in the file pass, including the new ones.

- [ ] **Step 5: Commit**

```bash
git add lib/groupNaming.js lib/groupNaming.test.js
git commit -m "feat: add ensemble/theory label helpers for add-on registrations"
```

---

## Task 2: `linked_registration_id` schema migration

**Files:**
- Modify: `supabase-schema.sql`

**Interfaces:**
- Produces: `registrations.linked_registration_id` — nullable `uuid`, `REFERENCES registrations(id) ON DELETE SET NULL`. Consumed by Task 3's API route and Task 4's UI.

This is a schema-only change with no application code to unit-test (matches this repo's existing convention — `supabase-schema.sql`'s own migrations, e.g. lines 53-61, have no accompanying test). It is verified by running the statement against Supabase and confirming the column exists (Task 5).

- [ ] **Step 1: Add the migration line**

At the end of `supabase-schema.sql` (after the existing migrations block, currently ending at line 61 with the `teacher_availability_ranges` migration), add:

```sql
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS linked_registration_id uuid REFERENCES registrations(id) ON DELETE SET NULL;
```

- [ ] **Step 2: Run the migration against Supabase**

Open the Supabase Dashboard SQL editor for this project and run the single `ALTER TABLE` statement above (do not re-run the whole file — the other migrations already ran previously).

- [ ] **Step 3: Verify the column exists**

In the Supabase Dashboard's Table Editor, open `registrations` and confirm a `linked_registration_id` column (type `uuid`, nullable) is present.

- [ ] **Step 4: Commit**

```bash
git add supabase-schema.sql
git commit -m "feat: add linked_registration_id column for add-on registrations"
```

---

## Task 3: `POST /api/registrations/addon`

**Files:**
- Create: `app/api/registrations/addon/route.js`
- Test: `app/api/registrations/addon/route.test.js`

**Interfaces:**
- Consumes: `THEORY_LABEL`, `ENSEMBLE_LABELS`, `getLessonTypeValue` from `lib/groupNaming.js` (Task 1); the `linked_registration_id` column from Task 2.
- Produces: `POST /api/registrations/addon` — body `{ sourceId: string, groupId?: string, newLabel?: string }` (exactly one of `groupId`/`newLabel` must be present). Returns `{ data: <new registration row> }` on success (HTTP 200), or `{ error: string }` with HTTP 400 (bad input), 401 (no session), 404 (source registration or group not found), or 409 (student already has an active theory add-on) on failure. Consumed by Task 4's `handleAddAddon`.

- [ ] **Step 1: Write the failing tests**

Create `app/api/registrations/addon/route.test.js`:

```js
import { POST } from './route';

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

// Same queue-per-table mock pattern as app/api/groups/route.test.js.
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
      insert: () => self,
      update: () => self,
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

const sourceReg = {
  student_name: 'דני כהן',
  student_phone: '050-1234567',
  parent_name: 'משה כהן',
  parent_phone: '050-7654321',
  parent_email: 'moshe@example.com',
  birthdate: '2012-01-01',
  grade: 'ו',
  school_name: 'בית ספר א',
  has_accommodations: false,
  type: 'continue',
  instruments: ['גיטרה'],
};

describe('POST /api/registrations/addon — validation', () => {
  test('rejects when neither groupId nor newLabel is given', async () => {
    const res = await POST(makeRequest({ sourceId: 'r1' }));
    expect(res.status).toBe(400);
  });

  test('rejects when both groupId and newLabel are given', async () => {
    const res = await POST(makeRequest({ sourceId: 'r1', groupId: 'g1', newLabel: 'תיאוריה' }));
    expect(res.status).toBe(400);
  });

  test('rejects an unrecognized newLabel', async () => {
    const res = await POST(makeRequest({ sourceId: 'r1', newLabel: 'משהו לא קיים' }));
    expect(res.status).toBe(400);
  });

  test('rejects when the source registration does not exist', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [{ data: null, error: null }],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({ sourceId: 'missing', newLabel: 'תיאוריה' }));
    expect(res.status).toBe(404);
  });
});

describe('POST /api/registrations/addon — create a new (unscheduled) add-on', () => {
  test('creates a theory add-on with status חדש and no teacher/day/time', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { data: sourceReg, error: null },       // source fetch
        { data: [], error: null },               // existing-theory check
        { data: { id: 'new1', ...sourceReg, selected_course: 'תיאוריה', linked_registration_id: 'r1', status: 'חדש' }, error: null }, // insert
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({ sourceId: 'r1', newLabel: 'תיאוריה' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.selected_course).toBe('תיאוריה');
    expect(json.data.status).toBe('חדש');
    expect(json.data.linked_registration_id).toBe('r1');
  });
});

describe('POST /api/registrations/addon — attach to an existing group', () => {
  test('copies teacher/day/time from the group schedule and adds the student to it', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { data: sourceReg, error: null }, // source fetch
        { data: { id: 'new2', ...sourceReg, selected_course: 'תזמורת כלי קשת', linked_registration_id: 'r1', status: 'שובץ', teacher: 'רותם לוי', assigned_day: 2, assigned_time: '17:00', group_id: 'g1' }, error: null }, // insert
      ],
      groups: [
        { data: { id: 'g1', name: 'תזמורת כלי קשת', teacher_id: 't1', lesson_type: 'orchestra', group_schedules: [{ day_of_week: 2, start_time: '17:00', end_time: '18:00' }] }, error: null },
      ],
      teachers: [
        { data: { name: 'רותם לוי' }, error: null },
      ],
      students: [
        { data: null, error: null }, // existing-student check: not found
        { error: null },              // insert
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({ sourceId: 'r1', groupId: 'g1' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.selected_course).toBe('תזמורת כלי קשת');
    expect(json.data.status).toBe('שובץ');
    expect(json.data.teacher).toBe('רותם לוי');
  });
});

describe('POST /api/registrations/addon — duplicate theory guard', () => {
  test('rejects with 409 when the student already has an active theory add-on', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { data: sourceReg, error: null }, // source fetch
        { data: [{ id: 'existing-theory', status: 'שובץ', selected_course: 'תיאוריה' }], error: null }, // existing-theory check
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({ sourceId: 'r1', newLabel: 'תיאוריה' }));
    expect(res.status).toBe(409);

    // No insert was attempted.
    expect(mockSupabase.from.mock.calls.map(c => c[0])).toEqual(['registrations', 'registrations']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest app/api/registrations/addon/route.test.js`
Expected: FAIL — `Cannot find module './route'`.

- [ ] **Step 3: Implement `app/api/registrations/addon/route.js`**

```js
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { getSupabaseClient } from '../../../../lib/supabase';
import { getLessonTypeValue, THEORY_LABEL, ENSEMBLE_LABELS } from '../../../../lib/groupNaming';

const EXCLUDED_STATUSES = ['נדחה', 'בוטל'];

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });
  }

  try {
    const { sourceId, groupId, newLabel } = await request.json();

    if (!sourceId) {
      return NextResponse.json({ error: 'חסר מזהה תלמיד/ה' }, { status: 400 });
    }
    if (!groupId && !newLabel) {
      return NextResponse.json({ error: 'יש לבחור קבוצה קיימת או סוג שיעור חדש' }, { status: 400 });
    }
    if (groupId && newLabel) {
      return NextResponse.json({ error: 'יש לבחור אפשרות אחת בלבד' }, { status: 400 });
    }
    if (newLabel && newLabel !== THEORY_LABEL && !ENSEMBLE_LABELS.includes(newLabel)) {
      return NextResponse.json({ error: 'סוג שיעור לא מוכר' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    const { data: source, error: sourceErr } = await supabase
      .from('registrations')
      .select('student_name, student_phone, parent_name, parent_phone, parent_email, birthdate, grade, school_name, has_accommodations, type, instruments')
      .eq('id', sourceId)
      .maybeSingle();
    if (sourceErr || !source) {
      return NextResponse.json({ error: 'תלמיד/ה לא נמצא/ה' }, { status: 404 });
    }

    // An existing group's own name is the source of truth for selected_course
    // when attaching to it — never trust a client-supplied label for that path.
    let group = null;
    if (groupId) {
      const { data: g, error: groupErr } = await supabase
        .from('groups')
        .select('id, name, teacher_id, lesson_type, group_schedules(day_of_week, start_time, end_time)')
        .eq('id', groupId)
        .maybeSingle();
      if (groupErr || !g) {
        return NextResponse.json({ error: 'קבוצה לא נמצאה' }, { status: 404 });
      }
      group = g;
    }

    const selectedCourse = group ? group.name : newLabel;
    const lessonCategory = group ? group.lesson_type : getLessonTypeValue(newLabel);

    if (lessonCategory === 'theory') {
      const { data: existingLinked, error: existingErr } = await supabase
        .from('registrations')
        .select('id, status, selected_course')
        .eq('linked_registration_id', sourceId);
      if (existingErr) console.error('addon: existing-theory check error', existingErr.message);
      const hasActiveTheory = (existingLinked || []).some(r =>
        getLessonTypeValue(r.selected_course) === 'theory' && !EXCLUDED_STATUSES.includes(r.status)
      );
      if (hasActiveTheory) {
        return NextResponse.json({ error: 'לתלמיד/ה כבר יש שיבוץ תיאוריה פעיל' }, { status: 409 });
      }
    }

    const insertData = {
      student_name: source.student_name,
      student_phone: source.student_phone,
      parent_name: source.parent_name,
      parent_phone: source.parent_phone,
      parent_email: source.parent_email,
      birthdate: source.birthdate,
      grade: source.grade,
      school_name: source.school_name,
      has_accommodations: source.has_accommodations || false,
      type: source.type,
      instruments: source.instruments || [],
      selected_course: selectedCourse,
      linked_registration_id: sourceId,
      status: 'חדש',
    };

    let teacherName = null;

    if (group) {
      if (group.teacher_id != null) {
        const { data: teacherRow, error: teacherErr } = await supabase
          .from('teachers')
          .select('name')
          .eq('id', group.teacher_id)
          .maybeSingle();
        if (teacherErr) console.error('addon: teacher lookup error', teacherErr.message);
        teacherName = teacherRow?.name || null;
      }

      const schedules = (group.group_schedules || [])
        .filter(s => s.start_time)
        .sort((a, b) => a.day_of_week - b.day_of_week);
      const first = schedules[0] || null;

      insertData.status = 'שובץ';
      insertData.teacher = teacherName;
      insertData.assigned_day = first ? first.day_of_week : null;
      insertData.assigned_time = first ? first.start_time : null;
      insertData.assigned_end_time = first ? (first.end_time || null) : null;
      insertData.group_id = group.id;
    }

    const { data: newReg, error: insertErr } = await supabase
      .from('registrations')
      .insert(insertData)
      .select('*')
      .single();
    if (insertErr || !newReg) {
      console.error('addon: insert error', insertErr?.message);
      return NextResponse.json({ error: 'שגיאה ביצירת רישום' }, { status: 500 });
    }

    if (group) {
      const { data: existingStudent, error: existingStudentErr } = await supabase
        .from('students')
        .select('id')
        .eq('group_id', group.id)
        .eq('name', source.student_name)
        .maybeSingle();
      if (existingStudentErr) console.error('addon: existing student check error', existingStudentErr.message);
      if (!existingStudent) {
        const { error: studentErr } = await supabase.from('students').insert({
          group_id: group.id,
          name: source.student_name,
          instrument: Array.isArray(source.instruments) ? source.instruments[0] : source.instruments || null,
          parent_phone: source.parent_phone || null,
          is_active: true,
        });
        if (studentErr) console.error('addon: student insert error', studentErr.message);
      }
    }

    return NextResponse.json({ data: newReg });
  } catch (err) {
    console.error('Registrations addon API error:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest app/api/registrations/addon/route.test.js`
Expected: PASS — all tests pass.

- [ ] **Step 5: Run the full test suite to confirm no regressions**

Run: `npx jest`
Expected: PASS — all existing tests still pass alongside the new ones.

- [ ] **Step 6: Commit**

```bash
git add app/api/registrations/addon/route.js app/api/registrations/addon/route.test.js
git commit -m "feat: add POST /api/registrations/addon for ensemble/theory add-ons"
```

---

## Task 4: Add-on buttons, picker, badge, and theory hint in `AdminTable.jsx`

**Files:**
- Modify: `components/AdminTable.jsx`

**Interfaces:**
- Consumes: `THEORY_LABEL`, `ENSEMBLE_LABELS`, `getAddonBadge` from `lib/groupNaming.js` (Task 1); `POST /api/registrations/addon` from Task 3; `row.linked_registration_id` from Task 2.
- Produces: no new exports — this is a leaf UI change.

No automated test harness exists for this component (confirmed by the existing `docs/superpowers/plans/2026-07-06-create-lesson-form-rework.md`, whose equivalent AdminTable task was also build-verified only). This task is verified by `next build` here and manually end-to-end in Task 5.

- [ ] **Step 1: Import the new helpers**

In `components/AdminTable.jsx`, change line 9 from:

```js
import { LESSON_TYPE_OPTIONS, getLessonTypeValue, computeGroupName, matchesLessonType } from '../lib/groupNaming';
```

to:

```js
import { LESSON_TYPE_OPTIONS, getLessonTypeValue, computeGroupName, matchesLessonType, THEORY_LABEL, ENSEMBLE_LABELS, getAddonBadge } from '../lib/groupNaming';
```

- [ ] **Step 2: Add state for the add-on picker**

After the `editingDetails` state declaration (currently line 149: `const [editingDetails, setEditingDetails] = useState({});`), add:

```js
  const [addonPickerFor, setAddonPickerFor] = useState(null); // { rowId, kind: 'theory' | 'ensemble' }
  const [addonNewLabel, setAddonNewLabel] = useState('');
  const [addonSaving, setAddonSaving] = useState(false);
```

- [ ] **Step 3: Add the `handleAddAddon` function**

After the `handleCreateGroup` function (currently ending at line 361 with `await fetchData();\n  }`), add:

```js
  async function handleAddAddon(row, { groupId, newLabel } = {}) {
    setAddonSaving(true);
    try {
      const res = await fetch('/api/registrations/addon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: row.id, groupId, newLabel }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || 'שגיאה בהוספת שיבוץ');
        return;
      }
      setAddonPickerFor(null);
      setAddonNewLabel('');
      await fetchData();
      setExpandedRow(json.data.id);
    } finally {
      setAddonSaving(false);
    }
  }
```

- [ ] **Step 4: Add the lesson-type badge next to the student name**

In the student-name table cell (currently lines 557-569):

```jsx
                    <td className="px-4 py-3 font-medium">
                      {row.student_name}
                      {row.attended_open_day === false && (
                        <span className="mr-1 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">
                          טרם שיחת היכרות
                        </span>
                      )}
                      {row.has_accommodations && (
                        <span className="mr-1 text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full font-medium">
                          התאמות
                        </span>
                      )}
                    </td>
```

add the badge after the `has_accommodations` block, so the cell becomes:

```jsx
                    <td className="px-4 py-3 font-medium">
                      {row.student_name}
                      {row.attended_open_day === false && (
                        <span className="mr-1 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">
                          טרם שיחת היכרות
                        </span>
                      )}
                      {row.has_accommodations && (
                        <span className="mr-1 text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full font-medium">
                          התאמות
                        </span>
                      )}
                      {(() => {
                        const badge = getAddonBadge(row.selected_course);
                        return badge ? (
                          <span className="mr-1 text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">
                            {badge.emoji} {badge.label}
                          </span>
                        ) : null;
                      })()}
                    </td>
```

- [ ] **Step 5: Add the theory scheduling hint above the teacher select**

In the "Assignment" (שיבוץ) block (currently lines 755-768):

```jsx
                          {/* Assignment */}
                          <div>
                            <h4 className="font-semibold text-gray-700 mb-2">שיבוץ</h4>
                            <div className="space-y-2">
                              <select
                                className="admin-input"
                                value={row.teacher || ''}
                                onChange={(e) => updateAssignment(row.id, 'teacher', e.target.value)}
                              >
```

insert the hint right after the `<h4>`, so the block becomes:

```jsx
                          {/* Assignment */}
                          <div>
                            <h4 className="font-semibold text-gray-700 mb-2">שיבוץ</h4>
                            {row.linked_registration_id && getLessonTypeValue(row.selected_course) === 'theory' && (() => {
                              const family = rows.filter(r =>
                                r.id !== row.id &&
                                (r.id === row.linked_registration_id || r.linked_registration_id === row.linked_registration_id) &&
                                r.teacher && r.assigned_day != null && r.assigned_day !== ''
                              );
                              if (family.length === 0) return null;
                              return (
                                <div className="mb-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
                                  שיעורים נוספים של {row.student_name}:{' '}
                                  {family.map(r =>
                                    `${r.selected_course || r.teacher} · יום ${DAY_NAMES[Number(r.assigned_day)]}${r.assigned_time ? ` ${r.assigned_time.slice(0, 5)}` : ''}`
                                  ).join(' · ')}
                                </div>
                              );
                            })()}
                            <div className="space-y-2">
                              <select
                                className="admin-input"
                                value={row.teacher || ''}
                                onChange={(e) => updateAssignment(row.id, 'teacher', e.target.value)}
                              >
```

- [ ] **Step 6: Add the "+ הרכב" / "+ תיאוריה" buttons and picker**

Immediately after the closing `</div>` of the "Assignment" (שיבוץ) block and before the "Notes" (הערות מנהל) block (currently around line 1227-1230:

```jsx
                            </div>
                          </div>

                          {/* Notes */}
```

insert a new block between them, so it becomes:

```jsx
                            </div>
                          </div>

                          {/* Add-on registrations (ensemble / theory) */}
                          {!row.linked_registration_id && (
                            <div className="sm:col-span-2">
                              <h4 className="font-semibold text-gray-700 mb-2">הוספת שיבוץ</h4>
                              <div className="flex flex-wrap gap-2 mb-2">
                                <button
                                  type="button"
                                  onClick={() => { setAddonPickerFor({ rowId: row.id, kind: 'ensemble' }); setAddonNewLabel(''); }}
                                  className="text-xs px-3 py-1.5 rounded-lg border border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                                >
                                  + הרכב
                                </button>
                                {!rows.some(r =>
                                  r.linked_registration_id === row.id &&
                                  getLessonTypeValue(r.selected_course) === 'theory' &&
                                  !['נדחה', 'בוטל'].includes(r.status)
                                ) && (
                                  <button
                                    type="button"
                                    onClick={() => { setAddonPickerFor({ rowId: row.id, kind: 'theory' }); setAddonNewLabel(''); }}
                                    className="text-xs px-3 py-1.5 rounded-lg border border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                                  >
                                    + תיאוריה
                                  </button>
                                )}
                              </div>

                              {addonPickerFor?.rowId === row.id && (() => {
                                const wantedTypes = addonPickerFor.kind === 'theory' ? ['theory'] : ['orchestra', 'choir'];
                                const matching = groups.filter(g => wantedTypes.includes(g.lesson_type));
                                return (
                                  <div className="border border-gray-200 rounded-lg p-2 space-y-1 max-h-56 overflow-y-auto">
                                    {matching.map(g => {
                                      const teacherName = teachers.find(t => t.id === g.teacher_id)?.name || '—';
                                      const sched = (g.group_schedules || [])
                                        .filter(s => s.start_time)
                                        .sort((a, b) => a.day_of_week - b.day_of_week)[0];
                                      return (
                                        <button
                                          key={g.id}
                                          type="button"
                                          disabled={addonSaving}
                                          onClick={() => handleAddAddon(row, { groupId: g.id })}
                                          className="block w-full text-right px-2 py-1.5 text-sm rounded-lg hover:bg-indigo-50 disabled:opacity-40"
                                        >
                                          {g.name} · {teacherName}
                                          {sched ? ` · יום ${DAY_NAMES[sched.day_of_week]} ${sched.start_time.slice(0, 5)}` : ' · ללא שעה קבועה'}
                                        </button>
                                      );
                                    })}
                                    {matching.length === 0 && (
                                      <p className="text-xs text-gray-400 px-2 py-1">אין קבוצות קיימות מסוג זה</p>
                                    )}

                                    {addonPickerFor.kind === 'theory' ? (
                                      <button
                                        type="button"
                                        disabled={addonSaving}
                                        onClick={() => handleAddAddon(row, { newLabel: THEORY_LABEL })}
                                        className="block w-full text-right px-2 py-1.5 text-sm rounded-lg text-purple-700 hover:bg-purple-50 disabled:opacity-40"
                                      >
                                        ➕ צור שיעור חדש
                                      </button>
                                    ) : (
                                      <div className="flex gap-2 items-center pt-1">
                                        <select
                                          className="admin-input flex-1"
                                          value={addonNewLabel}
                                          onChange={e => setAddonNewLabel(e.target.value)}
                                        >
                                          <option value="">➕ צור שיעור חדש — בחר/י סוג —</option>
                                          {ENSEMBLE_LABELS.map(label => (
                                            <option key={label} value={label}>{label}</option>
                                          ))}
                                        </select>
                                        <button
                                          type="button"
                                          disabled={addonSaving || !addonNewLabel}
                                          onClick={() => handleAddAddon(row, { newLabel: addonNewLabel })}
                                          className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40"
                                        >
                                          צור
                                        </button>
                                      </div>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => setAddonPickerFor(null)}
                                      className="block w-full text-right px-2 py-1 text-xs text-gray-400 hover:text-gray-600"
                                    >
                                      ביטול
                                    </button>
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                          {/* Notes */}
```

- [ ] **Step 7: Confirm the app builds**

Run: `npx next build`
Expected: build completes with no new errors in `components/AdminTable.jsx`.

- [ ] **Step 8: Commit**

```bash
git add components/AdminTable.jsx
git commit -m "feat: add ensemble/theory add-on buttons, picker, badge, and scheduling hint"
```

---

## Task 5: Manual end-to-end verification

No automated test harness exists for `AdminTable.jsx` or the schedule/attendance-sync side effects it triggers (see Task 4 note), so this feature is verified by running the app and driving the real flow.

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Add-on badge and buttons appear only where expected**

In `/admin`, open an individual (פרטני) student's row. Confirm:
- "+ הרכב" and "+ תיאוריה" buttons appear under a new "הוספת שיבוץ" heading.
- No lesson-type badge appears next to that student's name (their `selected_course` is an individual course).

- [ ] **Step 3: Golden path — attach to an existing ensemble group**

Click "+ הרכב". Confirm the picker lists existing orchestra/choir groups with teacher name and day/time (or "ללא שעה קבועה" if a group has no schedule yet), plus a "➕ צור שיעור חדש" option with a type dropdown. Pick an existing group. Confirm:
- A new row appears for the same student, with the "🎻 הרכב" badge and the group's name as its course.
- That row's status is "שובץ" and its teacher/day/time match the group's schedule.
- The original individual row now shows an "+ הרכב" button still available (so a second ensemble could be added) but no "+ תיאוריה" hiding yet.
- In the attendance app (or the `students` table directly), the student now appears as an active member of that group.

- [ ] **Step 4: Golden path — create a brand-new theory add-on, then see the scheduling hint**

On the same student's original row, click "+ תיאוריה", then "➕ צור שיעור חדש". Confirm:
- A new row appears with the "📘 תיאוריה" badge, status "חדש", no teacher/day/time yet.
- Expanding that row's "שיבוץ" section shows the hint box "שיעורים נוספים של <student name>: ..." listing the student's individual lesson and the ensemble from Step 3 with their days/times.
- Assigning a teacher/day/time and clicking "💾 שמור שיבוץ" works exactly as it does for any other registration (existing conflict-check and attendance-sync behavior, unmodified).

- [ ] **Step 5: Duplicate theory prevented**

Back on the original individual row, confirm the "+ תיאוריה" button is gone now that an active theory add-on exists (from Step 4). Change the theory row's status to "נדחה" and confirm the "+ תיאוריה" button reappears on the original row.

- [ ] **Step 6: Deleting the original registration does not delete its add-ons**

Delete the original individual registration (🗑 מחק רישום). Confirm the ensemble and theory rows created in Steps 3–4 remain in the table, no longer showing any connection to the deleted row (no crash, no missing data).

- [ ] **Step 7: Confirm existing flows are untouched**

For a different, unrelated student: assign a teacher/day/time directly and use the existing "🔽 הוסף שיעור בנוכחות" dropdown and "➕ צור שיעור חדש" mini-form exactly as before. Confirm both behave identically to before this change.
