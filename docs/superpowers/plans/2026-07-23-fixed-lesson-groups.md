# Fixed Lesson Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the office pre-build "fixed lesson" groups (teacher + day + time, for theory sub-types and ensembles) in the Teachers tab, and turn the "+ תיאוריה"/"+ הרכב" buttons on each student row into pure pick-from-list selectors — no more ad-hoc, unscheduled group creation from a student's row.

**Architecture:** No schema changes. Reuses the existing `groups`/`group_schedules`/`students` tables and the existing `POST /api/groups` (already supports creating a group with zero students) and `POST /api/registrations/addon` (attaches one student to one existing group) endpoints. Three new theory sub-types get added to the shared lesson-type list; a new auto-numbered naming convention (`"<label> <n>"`) distinguishes several groups of the same type; group creation moves from the student row to the Teachers tab; the student-row picker is simplified to selection-only.

**Tech Stack:** Next.js 14 (App Router) API routes, React client components, Supabase (via `getSupabaseClient()`), Jest (`testEnvironment: 'node'`) for `lib/` and `app/api/` unit tests — no component-level (jsdom) tests exist in this repo, so UI tasks end in manual browser verification instead of a jest run.

## Global Constraints

- No database schema changes — everything is built on `groups`, `group_schedules`, `students`, `registrations.group_id`, `registrations.linked_registration_id`, all pre-existing.
- Individual instrument lessons (the student's own teacher/day/time assignment in `AssignmentPanel`) are untouched — this plan only changes the "+ תיאוריה"/"+ הרכב" add-on flow in `AdminTable.jsx` and adds new UI in `TeachersTab.jsx`.
- New theory sub-type labels (exact Hebrew strings, must match exactly): `פיתוח קשב`, `קצב לכולם`, `קומפוזיציה`. These join the existing `תיאוריה` label, all with `value: 'theory'`.
- New group names use the format `"<label> <n>"` (space + integer, no leading zeros, 1-indexed) — e.g. `"פיתוח קשב 1"`. Numbering is global per label, not per teacher.
- A student can be attached to more than one theory sub-type at once (e.g. both `קצב לכולם` and `קומפוזיציה`), but not to two groups of the *same* sub-type at once — duplicate guard is per-label, not per-category.
- Group creation for "+ תיאוריה"/"+ הרכב" happens **only** in the Teachers tab from now on; the student-row picker never creates a group.

---

## File Map

- **Modify `lib/groupNaming.js`** — add 3 `LESSON_TYPE_OPTIONS` entries, add `THEORY_LABELS`, `nextNumberedGroupName`, `matchesGroupLabel`, `groupBaseLabel`.
- **Modify `lib/groupNaming.test.js`** — update the options-count test, add tests for the new exports.
- **Modify `app/api/registrations/addon/route.js`** — drop the `newLabel` (unscheduled) path entirely; require `groupId`; change the duplicate-theory guard from "any active theory" to "active theory of the same label".
- **Modify `app/api/registrations/addon/route.test.js`** — rewrite to match the new `groupId`-only contract.
- **Modify `components/TeachersTab.jsx`** — new `FixedLessonsSection` component (list + create + delete fixed lessons for one teacher), wired into `TeacherCard`; `TeachersTab` now tracks a `groups` array and per-group student counts.
- **Modify `components/AdminTable.jsx`** — "+ תיאוריה"/"+ הרכב" picker gains a type dropdown, filters existing groups by the chosen label, and drops the "➕ צור שיעור חדש" sub-flow and its state (`addonNewLabel`).

---

### Task 1: `lib/groupNaming.js` — new lesson types and naming helpers

**Files:**
- Modify: `lib/groupNaming.js`
- Test: `lib/groupNaming.test.js`

**Interfaces:**
- Produces: `THEORY_LABELS: string[]` (all labels with `value: 'theory'`, in `LESSON_TYPE_OPTIONS` order), `nextNumberedGroupName(label: string, existingGroupNames: string[]): string`, `matchesGroupLabel(groupName: string, label: string): boolean`, `groupBaseLabel(groupName: string): string`.
- Consumes: nothing new (pure functions, no imports beyond what's already in the file).

- [ ] **Step 1: Write the failing tests**

Open `lib/groupNaming.test.js` and replace the `LESSON_TYPE_OPTIONS` describe block (lines 3–23) with the updated 18-option list, and append new describe blocks at the end of the file (after the existing `getAddonBadge` block):

```js
describe('LESSON_TYPE_OPTIONS', () => {
  test('has exactly 18 options in the required order', () => {
    expect(LESSON_TYPE_OPTIONS.map(o => o.label)).toEqual([
      'פרטני 45 דקות',
      'פרטני 60 דקות',
      'שיעור זוגי אליטה',
      'מנגינות שנה ב',
      'מנגינות שנה ג',
      'מנגינות שנה ד',
      'תיאוריה',
      'פיתוח קשב',
      'קצב לכולם',
      'קומפוזיציה',
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
```

Also update the `getLessonTypeValue` describe block — add a new test right after `'maps theory and elite duet'`:

```js
  test('maps the three new theory sub-types to "theory"', () => {
    expect(getLessonTypeValue('פיתוח קשב')).toBe('theory');
    expect(getLessonTypeValue('קצב לכולם')).toBe('theory');
    expect(getLessonTypeValue('קומפוזיציה')).toBe('theory');
  });
```

Append these new describe blocks at the end of the file:

```js
describe('THEORY_LABELS', () => {
  test('lists exactly the 4 theory labels, in LESSON_TYPE_OPTIONS order', () => {
    expect(THEORY_LABELS).toEqual([
      'תיאוריה',
      'פיתוח קשב',
      'קצב לכולם',
      'קומפוזיציה',
    ]);
  });
});

describe('nextNumberedGroupName', () => {
  test('starts at 1 when there are no existing groups of this label', () => {
    expect(nextNumberedGroupName('פיתוח קשב', [])).toBe('פיתוח קשב 1');
  });

  test('continues from the highest existing number for this label', () => {
    expect(nextNumberedGroupName('פיתוח קשב', ['פיתוח קשב 1', 'פיתוח קשב 2'])).toBe('פיתוח קשב 3');
  });

  test('ignores groups of a different label, including ones with the same prefix', () => {
    expect(nextNumberedGroupName('קשב', ['פיתוח קשב 5', 'קשב 1'])).toBe('קשב 2');
  });

  test('ignores a non-numbered group with the exact same name', () => {
    expect(nextNumberedGroupName('תיאוריה', ['תיאוריה'])).toBe('תיאוריה 1');
  });
});

describe('matchesGroupLabel', () => {
  test('matches an exact bare label', () => {
    expect(matchesGroupLabel('תיאוריה', 'תיאוריה')).toBe(true);
  });

  test('matches a numbered instance of the label', () => {
    expect(matchesGroupLabel('פיתוח קשב 2', 'פיתוח קשב')).toBe(true);
  });

  test('does not match a different label', () => {
    expect(matchesGroupLabel('קצב לכולם 1', 'פיתוח קשב')).toBe(false);
  });

  test('does not false-match a label that is a text-prefix superstring', () => {
    expect(matchesGroupLabel('פיתוח קשביבי 1', 'פיתוח קשב')).toBe(false);
  });
});

describe('groupBaseLabel', () => {
  test('strips a trailing number', () => {
    expect(groupBaseLabel('פיתוח קשב 2')).toBe('פיתוח קשב');
  });

  test('returns the name unchanged when there is no trailing number', () => {
    expect(groupBaseLabel('תיאוריה')).toBe('תיאוריה');
  });

  test('returns the name unchanged for the old "<label> - <student>" convention', () => {
    expect(groupBaseLabel('מקהלה צעירה - יוסי כהן')).toBe('מקהלה צעירה - יוסי כהן');
  });
});
```

Update the import line at the top of the test file to pull in the new exports:

```js
import {
  LESSON_TYPE_OPTIONS, getLessonTypeValue, computeGroupName, matchesLessonType,
  THEORY_LABEL, ENSEMBLE_LABELS, THEORY_LABELS, getAddonBadge,
  nextNumberedGroupName, matchesGroupLabel, groupBaseLabel,
} from './groupNaming';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/groupNaming.test.js`
Expected: FAIL — `THEORY_LABELS`/`nextNumberedGroupName`/`matchesGroupLabel`/`groupBaseLabel` are `undefined`, and the 18-option test fails against the current 15-option list.

- [ ] **Step 3: Implement in `lib/groupNaming.js`**

Replace the full file content with:

```js
export const LESSON_TYPE_OPTIONS = [
  { label: 'פרטני 45 דקות', value: 'individual_45' },
  { label: 'פרטני 60 דקות', value: 'individual_60' },
  { label: 'שיעור זוגי אליטה', value: 'elite_duet' },
  { label: 'מנגינות שנה ב', value: 'melodies_individual' },
  { label: 'מנגינות שנה ג', value: 'melodies_individual' },
  { label: 'מנגינות שנה ד', value: 'melodies_individual' },
  { label: 'תיאוריה', value: 'theory' },
  { label: 'פיתוח קשב', value: 'theory' },
  { label: 'קצב לכולם', value: 'theory' },
  { label: 'קומפוזיציה', value: 'theory' },
  { label: 'מקהלה צעירה', value: 'choir' },
  { label: 'הזמיר- מקהלה ייצוגית', value: 'choir' },
  { label: 'מקהלת קולות הנגב', value: 'choir' },
  { label: 'תזמורת נשיפה', value: 'orchestra' },
  { label: 'תזמורת כלי קשת', value: 'orchestra' },
  { label: 'אנסמבל מוזיקה מן המזרח א', value: 'orchestra' },
  { label: 'אנסמבל מוזיקה מן המזרח ב', value: 'orchestra' },
  { label: 'תזמורת מקאם דימונה', value: 'orchestra' },
];

export function getLessonTypeValue(label) {
  return LESSON_TYPE_OPTIONS.find(o => o.label === label)?.value ?? null;
}

export function computeGroupName(label, studentNames) {
  const names = (studentNames || []).filter(Boolean);
  if (names.length === 1) return `${label} - ${names[0]}`;
  return label;
}

export function matchesLessonType(groupName, selectedType) {
  if (!selectedType) return false;
  return groupName === selectedType || groupName.startsWith(`${selectedType} - `);
}

export const THEORY_LABEL = 'תיאוריה';

export const ENSEMBLE_LABELS = LESSON_TYPE_OPTIONS
  .filter(o => o.value === 'orchestra' || o.value === 'choir')
  .map(o => o.label);

export const THEORY_LABELS = LESSON_TYPE_OPTIONS
  .filter(o => o.value === 'theory')
  .map(o => o.label);

export function getAddonBadge(selectedCourse) {
  const value = getLessonTypeValue(selectedCourse);
  if (value === 'theory') return { emoji: '📘', label: 'תיאוריה' };
  if (value === 'orchestra' || value === 'choir') return { emoji: '🎻', label: 'הרכב' };
  return null;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Fixed-lesson groups (created in the Teachers tab) are named "<label> <n>"
// — e.g. "פיתוח קשב 1", "פיתוח קשב 2" — to tell apart several groups of the
// same type. These three helpers work with that convention; they are
// independent of computeGroupName/matchesLessonType above, which serve the
// older "<label> - <student name>" convention used by the individual-lesson
// group flow (AssignmentPanel's "צור שיעור חדש").
export function nextNumberedGroupName(label, existingGroupNames) {
  const re = new RegExp(`^${escapeRegExp(label)} (\\d+)$`);
  let max = 0;
  for (const name of existingGroupNames) {
    const m = re.exec(name);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${label} ${max + 1}`;
}

export function matchesGroupLabel(groupName, label) {
  return groupName === label || new RegExp(`^${escapeRegExp(label)} \\d+$`).test(groupName);
}

export function groupBaseLabel(groupName) {
  const m = /^(.*) \d+$/.exec(groupName);
  return m ? m[1] : groupName;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/groupNaming.test.js`
Expected: PASS — all tests in the file green.

- [ ] **Step 5: Commit**

```bash
git add lib/groupNaming.js lib/groupNaming.test.js
git commit -m "feat: add theory sub-types and numbered-group naming helpers"
```

---

### Task 2: `app/api/registrations/addon/route.js` — groupId-only, per-label duplicate guard

**Files:**
- Modify: `app/api/registrations/addon/route.js`
- Test: `app/api/registrations/addon/route.test.js`

**Interfaces:**
- Consumes: `matchesGroupLabel(groupName, label): boolean`, `groupBaseLabel(groupName): string` from `lib/groupNaming.js` (Task 1).
- Produces: `POST` now requires `{ sourceId, groupId }` in the request body (the `newLabel` field is no longer accepted or needed); on success returns `{ data: <new registration row> }` exactly as before. `400` if `groupId` is missing. `409` if the target group is a theory group and the source student already has an active registration whose `selected_course` matches the same base label (via `matchesGroupLabel`).

- [ ] **Step 1: Write the failing tests**

Replace the full content of `app/api/registrations/addon/route.test.js`:

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
  test('rejects when groupId is missing', async () => {
    const res = await POST(makeRequest({ sourceId: 'r1' }));
    expect(res.status).toBe(400);
  });

  test('rejects when sourceId is missing', async () => {
    const res = await POST(makeRequest({ groupId: 'g1' }));
    expect(res.status).toBe(400);
  });

  test('rejects when the source registration does not exist', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [{ data: null, error: null }],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({ sourceId: 'missing', groupId: 'g1' }));
    expect(res.status).toBe(404);
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

  test('returns 404 when the given groupId does not match any group', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { data: sourceReg, error: null }, // source fetch
      ],
      groups: [
        { data: null, error: null }, // group not found
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({ sourceId: 'r1', groupId: 'missing-group' }));
    expect(res.status).toBe(404);
  });

  test('still creates the registration when the teacher lookup errors, falling back to a null teacher name', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { data: sourceReg, error: null }, // source fetch
        { data: { id: 'new3', ...sourceReg, selected_course: 'תזמורת כלי קשת', linked_registration_id: 'r1', status: 'שובץ', teacher: null, assigned_day: 2, assigned_time: '17:00', group_id: 'g1' }, error: null }, // insert
      ],
      groups: [
        { data: { id: 'g1', name: 'תזמורת כלי קשת', teacher_id: 't1', lesson_type: 'orchestra', group_schedules: [{ day_of_week: 2, start_time: '17:00', end_time: '18:00' }] }, error: null },
      ],
      teachers: [
        { data: null, error: { message: 'teacher lookup boom' } },
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
    expect(json.data.teacher).toBe(null);
  });

  test('does not attempt a students insert when the existence check errors (fails closed)', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { data: sourceReg, error: null }, // source fetch
        { data: { id: 'new4', ...sourceReg, selected_course: 'תזמורת כלי קשת', linked_registration_id: 'r1', status: 'שובץ', teacher: 'רותם לוי', assigned_day: 2, assigned_time: '17:00', group_id: 'g1' }, error: null }, // insert
      ],
      groups: [
        { data: { id: 'g1', name: 'תזמורת כלי קשת', teacher_id: 't1', lesson_type: 'orchestra', group_schedules: [{ day_of_week: 2, start_time: '17:00', end_time: '18:00' }] }, error: null },
      ],
      teachers: [
        { data: { name: 'רותם לוי' }, error: null },
      ],
      students: [
        { data: null, error: { message: 'boom' } }, // existing-student check errors
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({ sourceId: 'r1', groupId: 'g1' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.id).toBe('new4');

    // Only one students call (the failed existence check) — no insert attempted.
    const studentsCalls = mockSupabase.from.mock.calls.filter(c => c[0] === 'students');
    expect(studentsCalls.length).toBe(1);
  });
});

describe('POST /api/registrations/addon — per-label duplicate guard', () => {
  test('rejects with 409 when the student already has an active registration of the exact same numbered group', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { data: sourceReg, error: null }, // source fetch
        { data: [{ id: 'existing', status: 'שובץ', selected_course: 'פיתוח קשב 1' }], error: null }, // existing-linked check
      ],
      groups: [
        { data: { id: 'g-2', name: 'פיתוח קשב 2', teacher_id: null, lesson_type: 'theory', group_schedules: [] }, error: null },
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({ sourceId: 'r1', groupId: 'g-2' }));
    expect(res.status).toBe(409);

    // No insert was attempted.
    expect(mockSupabase.from.mock.calls.map(c => c[0])).toEqual(['registrations', 'groups', 'registrations']);
  });

  test('allows joining a different theory label even with an existing active theory add-on', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { data: sourceReg, error: null }, // source fetch
        { data: [{ id: 'existing', status: 'שובץ', selected_course: 'פיתוח קשב 1' }], error: null }, // existing-linked check
        { data: { id: 'new5', ...sourceReg, selected_course: 'קומפוזיציה 1', linked_registration_id: 'r1', status: 'שובץ', teacher: null, assigned_day: null, assigned_time: null, group_id: 'g-comp' }, error: null }, // insert
      ],
      groups: [
        { data: { id: 'g-comp', name: 'קומפוזיציה 1', teacher_id: null, lesson_type: 'theory', group_schedules: [] }, error: null },
      ],
      students: [
        { data: null, error: null }, // existing-student check: not found
        { error: null },              // insert
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({ sourceId: 'r1', groupId: 'g-comp' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.selected_course).toBe('קומפוזיציה 1');
  });

  test('rejects with 500 when the existing-linked check query errors', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { data: sourceReg, error: null }, // source fetch
        { data: null, error: { message: 'Database connection error' } }, // existing-linked check fails
      ],
      groups: [
        { data: { id: 'g-1', name: 'תיאוריה 1', teacher_id: null, lesson_type: 'theory', group_schedules: [] }, error: null },
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await POST(makeRequest({ sourceId: 'r1', groupId: 'g-1' }));
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- app/api/registrations/addon/route.test.js`
Expected: FAIL — current route still accepts/expects `newLabel`, still guards by category not by label, so several of the new assertions (status codes, call sequences) won't match.

- [ ] **Step 3: Implement in `app/api/registrations/addon/route.js`**

Replace the full file content:

```js
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { getSupabaseClient } from '../../../../lib/supabase';
import { matchesGroupLabel, groupBaseLabel } from '../../../../lib/groupNaming';

const EXCLUDED_STATUSES = ['נדחה', 'בוטל'];

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });
  }

  try {
    const { sourceId, groupId } = await request.json();

    if (!sourceId) {
      return NextResponse.json({ error: 'חסר מזהה תלמיד/ה' }, { status: 400 });
    }
    if (!groupId) {
      return NextResponse.json({ error: 'יש לבחור קבוצה' }, { status: 400 });
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

    const { data: group, error: groupErr } = await supabase
      .from('groups')
      .select('id, name, teacher_id, lesson_type, group_schedules(day_of_week, start_time, end_time)')
      .eq('id', groupId)
      .maybeSingle();
    if (groupErr || !group) {
      return NextResponse.json({ error: 'קבוצה לא נמצאה' }, { status: 404 });
    }

    if (group.lesson_type === 'theory') {
      const baseLabel = groupBaseLabel(group.name);
      const { data: existingLinked, error: existingErr } = await supabase
        .from('registrations')
        .select('id, status, selected_course')
        .eq('linked_registration_id', sourceId);
      if (existingErr) {
        console.error('addon: existing-linked check error', existingErr.message);
        return NextResponse.json({ error: 'שגיאה בבדיקת רישום' }, { status: 500 });
      }
      const hasActiveSameLabel = (existingLinked || []).some(r =>
        !EXCLUDED_STATUSES.includes(r.status) && matchesGroupLabel(r.selected_course, baseLabel)
      );
      if (hasActiveSameLabel) {
        return NextResponse.json({ error: 'לתלמיד/ה כבר יש שיבוץ פעיל מסוג זה' }, { status: 409 });
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
      selected_course: group.name,
      linked_registration_id: sourceId,
      status: 'חדש',
    };

    let teacherName = null;
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

    const { data: newReg, error: insertErr } = await supabase
      .from('registrations')
      .insert(insertData)
      .select('*')
      .single();
    if (insertErr || !newReg) {
      console.error('addon: insert error', insertErr?.message);
      return NextResponse.json({ error: 'שגיאה ביצירת רישום' }, { status: 500 });
    }

    const { data: existingStudent, error: existingStudentErr } = await supabase
      .from('students')
      .select('id')
      .eq('group_id', group.id)
      .eq('name', source.student_name)
      .maybeSingle();
    if (existingStudentErr) console.error('addon: existing student check error', existingStudentErr.message);
    if (!existingStudentErr && !existingStudent) {
      const { error: studentErr } = await supabase.from('students').insert({
        group_id: group.id,
        name: source.student_name,
        instrument: Array.isArray(source.instruments) ? source.instruments[0] : source.instruments || null,
        parent_phone: source.parent_phone || null,
        is_active: true,
      });
      if (studentErr) console.error('addon: student insert error', studentErr.message);
    }

    return NextResponse.json({ data: newReg });
  } catch (err) {
    console.error('Registrations addon API error:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- app/api/registrations/addon/route.test.js`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add app/api/registrations/addon/route.js app/api/registrations/addon/route.test.js
git commit -m "fix: simplify addon route to groupId-only with per-label duplicate guard"
```

---

### Task 3: `components/TeachersTab.jsx` — manage fixed lessons per teacher

**Files:**
- Modify: `components/TeachersTab.jsx`

**Interfaces:**
- Consumes: `LESSON_TYPE_OPTIONS`, `getLessonTypeValue`, `nextNumberedGroupName` from `lib/groupNaming.js` (Task 1); existing `POST /api/groups` and `DELETE /api/groups` endpoints (unchanged, already support this — see `app/api/groups/route.js`).
- Produces: `FixedLessonsSection` (new local component, not exported outside this file) — used only inside `TeacherCard`.

No jest test for this task: this repo's jest config runs with `testEnvironment: 'node'` and has no component-level tests anywhere (confirmed: no `*.test.jsx` files exist). Verification for this task is manual, folded into Task 5.

- [ ] **Step 1: Add the import and the type-label constant**

In `components/TeachersTab.jsx`, after the existing imports (line 5, `import ImportAssignments from './ImportAssignments';`), add:

```js
import { LESSON_TYPE_OPTIONS, getLessonTypeValue, nextNumberedGroupName } from '../lib/groupNaming';
```

After the `HEBREW_TO_NUM` constant (line 8), add:

```js
const FIXED_GROUP_TYPE_LABELS = LESSON_TYPE_OPTIONS
  .filter(o => ['theory', 'orchestra', 'choir'].includes(o.value))
  .map(o => o.label);
```

- [ ] **Step 2: Add the `FixedLessonsSection` component**

Insert this new function directly before `function TeacherCard(...)` (i.e., right after the `hasSharedGroupSchedule` function, before line 49):

```js
function FixedLessonsSection({ t, groups, groupStudentCounts, onChanged }) {
  const [label, setLabel] = useState('');
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');
  const [saving, setSaving] = useState(false);

  const teacherGroups = groups.filter(g => g.teacher_id === t.id);
  const ranges = t.teacher_availability_ranges || [];

  async function handleSave() {
    if (!label || day === '' || !time) return;
    setSaving(true);
    try {
      const name = nextNumberedGroupName(label, groups.map(g => g.name));
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          lesson_type: getLessonTypeValue(label),
          teacher_id: t.id,
          assigned_day: day,
          assigned_time: time,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || 'שגיאה ביצירת שיעור קבוע');
        return;
      }
      setLabel('');
      setDay('');
      setTime('');
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(g) {
    if (!confirm(`למחוק את הקבוצה "${g.name}"?\nתלמידי הקבוצה יוסרו גם כן מאפליקציית הנוכחות.`)) return;
    const res = await fetch('/api/groups', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: g.id }),
    });
    if (res.ok) {
      onChanged();
    } else {
      const json = await res.json();
      alert(json.error || 'שגיאה במחיקה');
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <h5 className="text-sm font-semibold text-gray-700 mb-2">שיעורים קבועים</h5>
      {teacherGroups.length === 0 ? (
        <p className="text-xs text-gray-400 mb-2">אין שיעורים קבועים עדיין</p>
      ) : (
        <div className="space-y-1 mb-2">
          {teacherGroups.map(g => {
            const sched = (g.group_schedules || []).find(s => s.start_time);
            return (
              <div key={g.id} className="flex items-center justify-between text-xs bg-white border border-gray-200 rounded px-2 py-1">
                <span>
                  {g.name}
                  {sched ? ` · יום ${DAY_NAMES_TEACHER[sched.day_of_week]} ${sched.start_time.slice(0, 5)}` : ' · ללא שעה קבועה'}
                  {` · ${groupStudentCounts[g.id] || 0} תלמידים`}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(g)}
                  className="text-red-400 hover:text-red-600"
                >
                  מחק
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={label}
          onChange={e => { setLabel(e.target.value); setDay(''); setTime(''); }}
          className="border border-gray-300 rounded px-2 py-1 text-xs"
          dir="rtl"
        >
          <option value="">— סוג —</option>
          {FIXED_GROUP_TYPE_LABELS.map(l => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        {label && ranges.map(r => (
          <button
            key={r.day_of_week}
            type="button"
            onClick={() => { setDay(String(r.day_of_week)); setTime(r.start_time || ''); }}
            className={`text-xs px-2 py-1 rounded border ${
              String(day) === String(r.day_of_week)
                ? 'border-purple-500 bg-purple-50 text-purple-700'
                : 'border-gray-300 text-gray-600'
            }`}
          >
            יום {DAY_NAMES_TEACHER[r.day_of_week]}
          </button>
        ))}
        {label && day !== '' && (
          <input
            type="time"
            dir="ltr"
            value={time}
            onChange={e => setTime(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-xs"
          />
        )}
        <button
          type="button"
          disabled={!label || day === '' || !time || saving}
          onClick={handleSave}
          className="text-xs bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 disabled:opacity-40"
        >
          + הוסף שיעור קבוע
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire it into `TeacherCard`**

Change the `TeacherCard` function signature (currently `function TeacherCard({ t, registrations, groupsById, onEdit, onDelete, onStudentUpdated }) {`) to:

```js
function TeacherCard({ t, registrations, groupsById, groups, groupStudentCounts, onEdit, onDelete, onStudentUpdated, onGroupsChanged }) {
```

Find the block that renders the expanded card body:

```jsx
      {open && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
          {students.length === 0 ? (
            <p className="text-sm text-gray-400">אין תלמידים משובצים עדיין</p>
          ) : (
            <div className="space-y-2">
              ...
            </div>
          )}
        </div>
      )}
```

Add the new section right after the `{students.length === 0 ? ... : (...)}` block, still inside the outer `<div>`:

```jsx
      {open && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
          {students.length === 0 ? (
            <p className="text-sm text-gray-400">אין תלמידים משובצים עדיין</p>
          ) : (
            <div className="space-y-2">
              ...
            </div>
          )}
          <FixedLessonsSection t={t} groups={groups} groupStudentCounts={groupStudentCounts} onChanged={onGroupsChanged} />
        </div>
      )}
```

- [ ] **Step 4: Track a `groups` array and per-group student counts in `TeachersTab`**

In the `TeachersTab` function, find:

```js
  const [groupsById, setGroupsById] = useState({});
```

Add a sibling state right after it:

```js
  const [groups, setGroups] = useState([]);
```

In `fetchAll`, find:

```js
    setGroupsById(Object.fromEntries((gJson.data || []).map(g => [g.id, g])));
```

Add right after it:

```js
    setGroups(gJson.data || []);
```

Find `if (loading) return <p className="text-gray-500 text-sm">טוען מורים...</p>;` and add this right after it, before the `return (`:

```js
  const groupStudentCounts = {};
  for (const r of registrations) {
    if (r.group_id != null) groupStudentCounts[r.group_id] = (groupStudentCounts[r.group_id] || 0) + 1;
  }
```

- [ ] **Step 5: Pass the new props at the `TeacherCard` call site**

Find:

```jsx
              <TeacherCard
                t={t}
                registrations={registrations}
                groupsById={groupsById}
                onEdit={() => setEditing(t)}
                onDelete={() => handleDelete(t.id)}
                onStudentUpdated={fetchAll}
              />
```

Replace with:

```jsx
              <TeacherCard
                t={t}
                registrations={registrations}
                groupsById={groupsById}
                groups={groups}
                groupStudentCounts={groupStudentCounts}
                onEdit={() => setEditing(t)}
                onDelete={() => handleDelete(t.id)}
                onStudentUpdated={fetchAll}
                onGroupsChanged={fetchAll}
              />
```

- [ ] **Step 6: Commit**

```bash
git add components/TeachersTab.jsx
git commit -m "feat: manage fixed lesson groups from the Teachers tab"
```

(Manual verification for this task happens together with Task 4, in Task 5.)

---

### Task 4: `components/AdminTable.jsx` — addon picker becomes pick-only, with a type dropdown

**Files:**
- Modify: `components/AdminTable.jsx`

**Interfaces:**
- Consumes: `THEORY_LABELS`, `matchesGroupLabel` from `lib/groupNaming.js` (Task 1); the simplified `POST /api/registrations/addon` contract (Task 2) — body is now `{ sourceId, groupId }` only.

No jest test for this task (same reasoning as Task 3). Verification is manual, in Task 5.

- [ ] **Step 1: Update the import line**

Find (line 9):

```js
import { getLessonTypeValue, computeGroupName, THEORY_LABEL, ENSEMBLE_LABELS } from '../lib/groupNaming';
```

Replace with:

```js
import { getLessonTypeValue, computeGroupName, ENSEMBLE_LABELS, THEORY_LABELS, matchesGroupLabel } from '../lib/groupNaming';
```

- [ ] **Step 2: Remove the now-unused `addonNewLabel` state**

Find and delete this line (currently around line 181):

```js
  const [addonNewLabel, setAddonNewLabel] = useState('');
```

(`addonPickerFor` and `addonSaving`, declared next to it, stay as-is.)

- [ ] **Step 3: Simplify `handleAddAddon`'s signature**

Find:

```js
  async function handleAddAddon(row, { groupId, newLabel } = {}) {
    setAddonSaving(true);
    try {
      const res = await fetch('/api/registrations/addon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: row.id, groupId, newLabel }),
      });
```

Replace with:

```js
  async function handleAddAddon(row, groupId) {
    setAddonSaving(true);
    try {
      const res = await fetch('/api/registrations/addon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: row.id, groupId }),
      });
```

(The rest of the function body — reading the JSON response, alerting on error, refetching, expanding the row — stays unchanged.)

- [ ] **Step 4: Update the "+ הוסף" button's `onClick`**

Find (currently around line 899–905):

```jsx
                                <button
                                  type="button"
                                  onClick={() => { setAddonPickerFor({ rowId: contactRow.id, kind: section.addonKind === 'ensemble' ? 'ensemble' : 'theory' }); setAddonNewLabel(''); }}
                                  className="text-xs px-3 py-1.5 rounded-lg border border-dashed border-indigo-300 text-indigo-700 hover:bg-indigo-50 w-full"
                                >
                                  + הוסף {section.addonKind === 'ensemble' ? 'הרכב' : 'תיאוריה'}
                                </button>
```

Replace with:

```jsx
                                <button
                                  type="button"
                                  onClick={() => setAddonPickerFor({ rowId: contactRow.id, kind: section.addonKind === 'ensemble' ? 'ensemble' : 'theory', label: '' })}
                                  className="text-xs px-3 py-1.5 rounded-lg border border-dashed border-indigo-300 text-indigo-700 hover:bg-indigo-50 w-full"
                                >
                                  + הוסף {section.addonKind === 'ensemble' ? 'הרכב' : 'תיאוריה'}
                                </button>
```

- [ ] **Step 5: Replace the picker panel — type dropdown, filtered list, no create-new**

Find the whole IIFE block starting at `{addonPickerFor?.rowId === contactRow.id && addonPickerFor.kind === section.addonKind && (() => {` (currently lines 910–976) and ending at the matching `})()}`. Replace the entire block with:

```jsx
                                {addonPickerFor?.rowId === contactRow.id && addonPickerFor.kind === section.addonKind && (() => {
                                  const wantedTypes = addonPickerFor.kind === 'theory' ? ['theory'] : ['orchestra', 'choir'];
                                  const labelOptions = addonPickerFor.kind === 'theory' ? THEORY_LABELS : ENSEMBLE_LABELS;
                                  const label = addonPickerFor.label || '';
                                  const matching = label
                                    ? groups.filter(g => wantedTypes.includes(g.lesson_type) && matchesGroupLabel(g.name, label))
                                    : [];
                                  return (
                                    <div className="border border-gray-200 rounded-lg p-2 space-y-1 max-h-56 overflow-y-auto mt-2">
                                      <select
                                        className="admin-input w-full"
                                        value={label}
                                        onChange={e => setAddonPickerFor(prev => ({ ...prev, label: e.target.value }))}
                                      >
                                        <option value="">— בחר/י סוג —</option>
                                        {labelOptions.map(l => (
                                          <option key={l} value={l}>{l}</option>
                                        ))}
                                      </select>
                                      {label && matching.map(g => {
                                        const teacherName = teachers.find(t => t.id === g.teacher_id)?.name || '—';
                                        const sched = (g.group_schedules || [])
                                          .filter(s => s.start_time)
                                          .sort((a, b) => a.day_of_week - b.day_of_week)[0];
                                        return (
                                          <button
                                            key={g.id}
                                            type="button"
                                            disabled={addonSaving}
                                            onClick={() => handleAddAddon(contactRow, g.id)}
                                            className="block w-full text-right px-2 py-1.5 text-sm rounded-lg hover:bg-indigo-50 disabled:opacity-40"
                                          >
                                            {g.name} · {teacherName}
                                            {sched ? ` · יום ${DAY_NAMES[sched.day_of_week]} ${sched.start_time.slice(0, 5)}` : ' · ללא שעה קבועה'}
                                          </button>
                                        );
                                      })}
                                      {label && matching.length === 0 && (
                                        <p className="text-xs text-gray-400 px-2 py-1">אין שיעורים קבועים מסוג זה — יש להוסיף בטאב מורים</p>
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
```

- [ ] **Step 6: Commit**

```bash
git add components/AdminTable.jsx
git commit -m "fix: turn the +תיאוריה/+הרכב picker into selection-only with a type filter"
```

---

### Task 5: Full test suite + manual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — all suites green, including the updated `lib/groupNaming.test.js` and `app/api/registrations/addon/route.test.js` from Tasks 1–2, and no regressions in unrelated suites (`app/api/groups/route.test.js`, `lib/teacherCapacity.test.js`, etc., are untouched by this plan and should still pass as-is).

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`
Expected: server starts on `http://localhost:3000` (or the next free port it reports).

- [ ] **Step 3: Create two fixed lessons in the Teachers tab**

In the browser, sign in to the admin, open the "מורים" tab, expand any teacher card, and under "שיעורים קבועים":
1. Choose "פיתוח קשב" from the type dropdown, pick a day the teacher is available, set a time, click "+ הוסף שיעור קבוע".
2. Confirm it now appears in the list as "פיתוח קשב 1" with the chosen day/time and "0 תלמידים".
3. Repeat with the same type ("פיתוח קשב") and a different day/time. Confirm it appears as "פיתוח קשב 2".

Expected: both fixed lessons show up in the list, correctly numbered, with the right day/time.

- [ ] **Step 4: Assign two students to those fixed lessons from the registrations tab**

Open the student registrations tab, expand a student row that has an active individual registration, and:
1. Click "+ תיאוריה", choose "פיתוח קשב" from the dropdown — confirm "פיתוח קשב 1" and "פיתוח קשב 2" both show up with their teacher/day/time, and there is no "צור שיעור חדש" option anywhere in the panel.
2. Pick "פיתוח קשב 1" — confirm the student is now attached (badge/row shows "📘 תיאוריה", day/time match the fixed lesson).
3. Open a second student's row, repeat, and pick "פיתוח קשב 1" again — confirm both students now share that same fixed lesson.
4. Go back to the Teachers tab and confirm "פיתוח קשב 1" now shows "2 תלמידים".

Expected: selection-only flow works end-to-end; student/teacher/day/time all populate correctly; no ability to create a group from the student row.

- [ ] **Step 5: Confirm the per-label duplicate guard**

On one of the two students from Step 4, click "+ תיאוריה" again, choose "פיתוח קשב" again, and try to pick either "פיתוח קשב 1" or "פיתוח קשב 2".

Expected: rejected with an alert containing "לתלמיד/ה כבר יש שיבוץ פעיל מסוג זה" (409 from the API).

- [ ] **Step 6: Confirm a different theory sub-type is still allowed**

On the same student, click "+ תיאוריה" again, choose "קומפוזיציה" this time. If no "קומפוזיציה" fixed lesson exists yet, go create one in the Teachers tab first (repeat Step 3 with that type), then come back and pick it.

Expected: succeeds — the student now has both a "פיתוח קשב" and a "קומפוזיציה" add-on active at once.

- [ ] **Step 7: Confirm individual lesson assignment is unaffected**

On any student row, use the normal teacher/day/time picker (the one that is not behind "+ תיאוריה"/"+ הרכב") to assign or change their individual lesson.

Expected: behaves exactly as before this plan — no visible change.
