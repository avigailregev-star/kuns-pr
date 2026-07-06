# Create-Lesson Form Rework — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the free-text "שם קבוצה" + generic 8-option "סוג שיעור" fields in the in-row "צור שיעור" form (`components/AdminTable.jsx`) with a fixed 11-option lesson-type dropdown and a multi-student picker, so the resulting group name is always consistent (and readable in the attendance app sync).

**Architecture:** Pure naming/mapping logic lives in a new `lib/groupNaming.js` module (unit-testable, no framework deps). `AdminTable.jsx`'s existing "create group" mini-form UI and `handleCreateGroup` function are updated to use it. `app/api/groups` POST gains an optional `student_registration_ids` param so all selected students are attached to the new group server-side in one request — this avoids reusing `/api/update-status` (which would re-send "assigned" emails/webhooks for students whose status doesn't actually change).

**Tech Stack:** Next.js App Router API routes, React (client component), Supabase, Jest (`next/jest`).

## Global Constraints

- The existing overlap-prevention check in `app/api/groups/route.js` (lines ~22-48: rejects a new group's day/time if it overlaps another group of the same teacher, returning HTTP 409) must keep working unmodified after this change — this is the "מניעת כפילויות בזמנים" (double-booking prevention) logic and must not be touched or bypassed.
- No new database tables or columns. `groups.lesson_type` and `groups.name` remain plain text columns.
- Lesson type internal values reuse existing values where the categories match (`individual_45`, `individual_60`, `orchestra`, `choir`, `theory`, `melodies_individual`); introduce exactly one new value, `elite_duet`, for "שיעור זוגי אליטה" (no existing value fits).
- Group name computation rule (already agreed in the spec): exactly 1 student selected → `"<type label> - <student name>"`; 2+ students selected → `"<type label>"` alone.

---

## Spec Reference

`docs/superpowers/specs/2026-07-06-assignments-screen-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/groupNaming.js` | New. The 11-option lesson-type list, label→internal-value lookup, group-name computation. Pure functions, no React/Supabase. |
| `lib/groupNaming.test.js` | New. Unit tests for the above. |
| `app/api/groups/route.js` | Modified. `POST` handler accepts `student_registration_ids` and attaches those registrations to the newly created group. |
| `components/AdminTable.jsx` | Modified. The `creatingGroupFor` mini-form UI and `handleCreateGroup` use the new module and a multi-student picker instead of a free-text name field. |

---

## Task 1: Lesson-type options and group-naming helpers

**Files:**
- Create: `lib/groupNaming.js`
- Test: `lib/groupNaming.test.js`

**Interfaces:**
- Produces: `LESSON_TYPE_OPTIONS` — `Array<{ label: string, value: string }>`, exactly 11 entries, in the order given in the spec.
- Produces: `getLessonTypeValue(label: string): string | null` — looks up the internal `lesson_type` value for a given label; returns `null` if the label isn't recognized.
- Produces: `computeGroupName(label: string, studentNames: string[]): string` — returns `"<label> - <name>"` when exactly one non-empty name is given, otherwise returns `label` alone (covers 0 names — shouldn't happen in the UI, but the function must not throw — and 2+ names).

- [ ] **Step 1: Write the failing tests**

Create `lib/groupNaming.test.js`:

```js
import { LESSON_TYPE_OPTIONS, getLessonTypeValue, computeGroupName } from './groupNaming';

describe('LESSON_TYPE_OPTIONS', () => {
  test('has exactly 11 options in the required order', () => {
    expect(LESSON_TYPE_OPTIONS.map(o => o.label)).toEqual([
      'פרטני 45 דקות',
      'פרטני 60 דקות',
      'שיעור זוגי אליטה',
      'תזמורת',
      'מקהלה ב-ו',
      'מקהלה הזמיר',
      'מקהלה בוגרים',
      'תיאוריה',
      'מנגינות שנה ב',
      'מנגינות שנה ג',
      'מנגינות שנה ד',
    ]);
  });
});

describe('getLessonTypeValue', () => {
  test('maps individual durations to their own values', () => {
    expect(getLessonTypeValue('פרטני 45 דקות')).toBe('individual_45');
    expect(getLessonTypeValue('פרטני 60 דקות')).toBe('individual_60');
  });

  test('maps the three choir variants to the same "choir" value', () => {
    expect(getLessonTypeValue('מקהלה ב-ו')).toBe('choir');
    expect(getLessonTypeValue('מקהלה הזמיר')).toBe('choir');
    expect(getLessonTypeValue('מקהלה בוגרים')).toBe('choir');
  });

  test('maps the three melodies years to the same "melodies_individual" value', () => {
    expect(getLessonTypeValue('מנגינות שנה ב')).toBe('melodies_individual');
    expect(getLessonTypeValue('מנגינות שנה ג')).toBe('melodies_individual');
    expect(getLessonTypeValue('מנגינות שנה ד')).toBe('melodies_individual');
  });

  test('maps orchestra, theory and elite duet', () => {
    expect(getLessonTypeValue('תזמורת')).toBe('orchestra');
    expect(getLessonTypeValue('תיאוריה')).toBe('theory');
    expect(getLessonTypeValue('שיעור זוגי אליטה')).toBe('elite_duet');
  });

  test('returns null for an unknown label', () => {
    expect(getLessonTypeValue('לא קיים')).toBeNull();
  });
});

describe('computeGroupName', () => {
  test('one student: appends the student name to the type label', () => {
    expect(computeGroupName('פרטני 45 דקות', ['יוסי כהן'])).toBe('פרטני 45 דקות - יוסי כהן');
  });

  test('multiple students: returns the type label alone', () => {
    expect(computeGroupName('מקהלה ב-ו', ['יוסי כהן', 'שרה לוי', 'מיכל אברהם'])).toBe('מקהלה ב-ו');
  });

  test('no students: returns the type label alone without throwing', () => {
    expect(computeGroupName('תזמורת', [])).toBe('תזמורת');
  });

  test('filters out empty/falsy names before counting', () => {
    expect(computeGroupName('פרטני 60 דקות', ['', 'יוסי כהן', null])).toBe('פרטני 60 דקות - יוסי כהן');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest lib/groupNaming.test.js`
Expected: FAIL — `Cannot find module './groupNaming'`

- [ ] **Step 3: Implement `lib/groupNaming.js`**

```js
export const LESSON_TYPE_OPTIONS = [
  { label: 'פרטני 45 דקות', value: 'individual_45' },
  { label: 'פרטני 60 דקות', value: 'individual_60' },
  { label: 'שיעור זוגי אליטה', value: 'elite_duet' },
  { label: 'תזמורת', value: 'orchestra' },
  { label: 'מקהלה ב-ו', value: 'choir' },
  { label: 'מקהלה הזמיר', value: 'choir' },
  { label: 'מקהלה בוגרים', value: 'choir' },
  { label: 'תיאוריה', value: 'theory' },
  { label: 'מנגינות שנה ב', value: 'melodies_individual' },
  { label: 'מנגינות שנה ג', value: 'melodies_individual' },
  { label: 'מנגינות שנה ד', value: 'melodies_individual' },
];

export function getLessonTypeValue(label) {
  return LESSON_TYPE_OPTIONS.find(o => o.label === label)?.value ?? null;
}

export function computeGroupName(label, studentNames) {
  const names = (studentNames || []).filter(Boolean);
  if (names.length === 1) return `${label} - ${names[0]}`;
  return label;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest lib/groupNaming.test.js`
Expected: PASS — 12 tests passed

- [ ] **Step 5: Commit**

```bash
git add lib/groupNaming.js lib/groupNaming.test.js
git commit -m "feat: add lesson-type options and group-naming helpers"
```

---

## Task 2: Attach selected students when creating a group

**Files:**
- Modify: `app/api/groups/route.js:6-82` (the `POST` handler)

**Interfaces:**
- Consumes: none from Task 1 (this task only touches the API route; the label→value mapping already happened client-side by the time the request arrives — the route receives the final `lesson_type` internal value, same as today).
- Produces: `POST /api/groups` now accepts an optional body field `student_registration_ids: string[]` (registration UUIDs). When present and non-empty, after the group (and optional schedule) is created, the route:
  1. Looks up the teacher's name from `teacher_id` (for stamping onto the registrations).
  2. Fetches `id, student_name, instruments, parent_phone, group_id` for each id in `student_registration_ids` (the `group_id` here is whatever group that student belonged to *before* this request, if any).
  3. If a student was previously in a *different* group, deactivates their row there (`students.is_active = false` for that old `group_id` + name) — same pattern already used in `lib/syncToAttendance.js` for the "student moved to a different group" case.
  4. Updates each of those `registrations` rows: `group_id = <new group id>`, `teacher = <teacher name>`, `selected_course = <new group name>`.
  5. Inserts one row per student into `students` (attendance app table): `group_id`, `name`, `instrument` (first of `instruments` if it's an array), `parent_phone`, `is_active: true`.
  This must happen only after the existing overlap check has passed and the group row was successfully inserted — it does not change when or how that check runs.

Since there's no existing test harness for these API routes (no Supabase mocking convention in this codebase — verified via `lib/*.test.js`, which only cover pure functions), this task is verified manually in Task 4 rather than with an automated test.

- [ ] **Step 1: Read the current handler to confirm the insertion point**

The new logic goes right after the existing "Create `group_schedules` entry" block and before `return NextResponse.json({ data });` (currently around line 74-77 in `app/api/groups/route.js`).

- [ ] **Step 2: Implement the change**

In `app/api/groups/route.js`, change the destructuring on line 14 from:

```js
const { name, lesson_type, is_mangan_school, school_name, teacher_id, assigned_day, assigned_time } = body;
```

to:

```js
const { name, lesson_type, is_mangan_school, school_name, teacher_id, assigned_day, assigned_time, student_registration_ids } = body;
```

Then, replace the block:

```js
    // Create group_schedules entry if day was provided
    if (assigned_day != null && assigned_time) {
      const { error: schedErr } = await supabase.from('group_schedules').insert({
        group_id: data.id,
        day_of_week: assigned_day,
        start_time: assigned_time,
      });
      if (schedErr) console.error('group_schedules insert error:', schedErr.message);
    }

    return NextResponse.json({ data });
```

with:

```js
    // Create group_schedules entry if day was provided
    if (assigned_day != null && assigned_time) {
      const { error: schedErr } = await supabase.from('group_schedules').insert({
        group_id: data.id,
        day_of_week: assigned_day,
        start_time: assigned_time,
      });
      if (schedErr) console.error('group_schedules insert error:', schedErr.message);
    }

    // Attach selected students to the new group
    if (Array.isArray(student_registration_ids) && student_registration_ids.length > 0) {
      let teacherName = null;
      if (teacher_id != null) {
        const { data: teacherRow } = await supabase
          .from('teachers')
          .select('name')
          .eq('id', teacher_id)
          .maybeSingle();
        teacherName = teacherRow?.name || null;
      }

      const { data: regsToAttach } = await supabase
        .from('registrations')
        .select('id, student_name, instruments, parent_phone, group_id')
        .in('id', student_registration_ids);

      for (const reg of (regsToAttach || [])) {
        if (reg.group_id && reg.group_id !== data.id) {
          await supabase
            .from('students')
            .update({ is_active: false })
            .eq('group_id', reg.group_id)
            .eq('name', reg.student_name);
        }

        await supabase
          .from('registrations')
          .update({ group_id: data.id, teacher: teacherName, selected_course: data.name })
          .eq('id', reg.id);

        await supabase.from('students').insert({
          group_id: data.id,
          name: reg.student_name,
          instrument: Array.isArray(reg.instruments) ? reg.instruments[0] : reg.instruments || null,
          parent_phone: reg.parent_phone || null,
          is_active: true,
        });
      }
    }

    return NextResponse.json({ data });
```

- [ ] **Step 3: Confirm the app still builds**

Run: `npx next build`
Expected: build completes with no new errors related to `app/api/groups/route.js`.

- [ ] **Step 4: Commit**

```bash
git add app/api/groups/route.js
git commit -m "feat: attach selected students to a group at creation time"
```

---

## Task 3: Rework the create-lesson mini-form in AdminTable.jsx

**Files:**
- Modify: `components/AdminTable.jsx` (state declarations around line 124-125, `handleCreateGroup` around line 244-272, the mini-form JSX around line 902-969)

**Interfaces:**
- Consumes: `LESSON_TYPE_OPTIONS`, `getLessonTypeValue`, `computeGroupName` from `lib/groupNaming.js` (Task 1); the extended `POST /api/groups` body shape from Task 2.
- Produces: no new exports — this is a leaf UI change.

- [ ] **Step 1: Import the new helpers**

At the top of `components/AdminTable.jsx`, add to the existing import block:

```js
import { LESSON_TYPE_OPTIONS, getLessonTypeValue, computeGroupName } from '../lib/groupNaming';
```

- [ ] **Step 2: Replace the `newGroupName` state with a student-picker state**

Replace this line (currently line 124):

```js
  const [newGroupName, setNewGroupName] = useState('');
```

with:

```js
  const [newGroupStudents, setNewGroupStudents] = useState([]); // [{ id, name }]
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
```

(`newGroupType` on the next line is unchanged — it will now hold the selected **label**, e.g. `"מקהלה ב-ו"`, instead of an internal value like `"choir"`.)

- [ ] **Step 3: Rewrite `handleCreateGroup`**

Replace the whole function (currently lines 244-272):

```js
  async function handleCreateGroup(rowId, teacherName, assignedDay, assignedTime) {
    if (!newGroupName.trim() || !newGroupType) return;
    const teacher = teachers.find(t => t.name === teacherName);
    if (!teacher?.id) {
      alert('יש לבחור מורה לפני יצירת קבוצה');
      return;
    }
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newGroupName.trim(),
        lesson_type: newGroupType,
        teacher_id: teacher.id,
        assigned_day: assignedDay ?? null,
        assigned_time: assignedTime ?? null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error || 'שגיאה ביצירת קבוצה');
      return;
    }
    setGroups(prev => [...prev, json.data].sort((a, b) => a.name.localeCompare(b.name, 'he')));
    setSelectedGroups(prev => ({ ...prev, [rowId]: String(json.data.id) }));
    setCreatingGroupFor(null);
    setNewGroupName('');
    setNewGroupType('');
  }
```

with:

```js
  async function handleCreateGroup(rowId, teacherName, assignedDay, assignedTime) {
    if (!newGroupType || newGroupStudents.length === 0) return;
    const teacher = teachers.find(t => t.name === teacherName);
    if (!teacher?.id) {
      alert('יש לבחור מורה לפני יצירת קבוצה');
      return;
    }
    const groupName = computeGroupName(newGroupType, newGroupStudents.map(s => s.name));
    const lessonTypeValue = getLessonTypeValue(newGroupType);
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: groupName,
        lesson_type: lessonTypeValue,
        teacher_id: teacher.id,
        assigned_day: assignedDay ?? null,
        assigned_time: assignedTime ?? null,
        student_registration_ids: newGroupStudents.map(s => s.id),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error || 'שגיאה ביצירת קבוצה');
      return;
    }
    setGroups(prev => [...prev, json.data].sort((a, b) => a.name.localeCompare(b.name, 'he')));
    setSelectedGroups(prev => ({ ...prev, [rowId]: String(json.data.id) }));
    setCreatingGroupFor(null);
    setNewGroupStudents([]);
    setStudentSearchQuery('');
    setNewGroupType('');
    await fetchData();
  }
```

- [ ] **Step 4: Replace the mini-form JSX**

Replace this block (currently lines 902-947):

```jsx
                              {creatingGroupFor === row.id ? (
                                <div className="space-y-2">
                                  <input
                                    autoFocus
                                    type="text"
                                    className="admin-input w-full"
                                    placeholder="שם הקבוצה החדשה"
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Escape') { setCreatingGroupFor(null); setNewGroupName(''); setNewGroupType(''); }
                                    }}
                                  />
                                  <select
                                    className="admin-input w-full"
                                    value={newGroupType}
                                    onChange={(e) => setNewGroupType(e.target.value)}
                                  >
                                    <option value="">— סוג שיעור —</option>
                                    <option value="individual_45">פרטני 45 דקות</option>
                                    <option value="individual_60">פרטני 60 דקות</option>
                                    <option value="group">קבוצתי</option>
                                    <option value="orchestra">תזמורת</option>
                                    <option value="choir">מקהלה</option>
                                    <option value="theory">תיאוריה</option>
                                    <option value="melodies_individual">מנגינות פרטני</option>
                                    <option value="melodies_group">מנגינות קבוצתי</option>
                                  </select>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleCreateGroup(row.id, row.teacher, row.assigned_day, row.assigned_time)}
                                      disabled={!newGroupName.trim() || !newGroupType}
                                      className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      צור שיעור
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setCreatingGroupFor(null); setNewGroupName(''); setNewGroupType(''); }}
                                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50"
                                    >
                                      ביטול
                                    </button>
                                  </div>
                                </div>
                              ) : (
```

with:

```jsx
                              {creatingGroupFor === row.id ? (
                                <div className="space-y-2">
                                  <select
                                    autoFocus
                                    className="admin-input w-full"
                                    value={newGroupType}
                                    onChange={(e) => setNewGroupType(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Escape') {
                                        setCreatingGroupFor(null);
                                        setNewGroupStudents([]);
                                        setStudentSearchQuery('');
                                        setNewGroupType('');
                                      }
                                    }}
                                  >
                                    <option value="">— סוג שיעור —</option>
                                    {LESSON_TYPE_OPTIONS.map(o => (
                                      <option key={o.label} value={o.label}>{o.label}</option>
                                    ))}
                                  </select>

                                  <div className="flex flex-wrap gap-1">
                                    {newGroupStudents.map(s => (
                                      <span
                                        key={s.id}
                                        className="inline-flex items-center gap-1 text-xs bg-purple-50 border border-purple-200 text-purple-700 rounded-lg px-2 py-1"
                                      >
                                        {s.name}
                                        <button
                                          type="button"
                                          onClick={() => setNewGroupStudents(prev => prev.filter(x => x.id !== s.id))}
                                          className="text-purple-400 hover:text-purple-700"
                                        >
                                          ✕
                                        </button>
                                      </span>
                                    ))}
                                  </div>

                                  <input
                                    type="text"
                                    className="admin-input w-full"
                                    placeholder="הקלד/י שם תלמיד/ה להוספה..."
                                    value={studentSearchQuery}
                                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                                  />
                                  {studentSearchQuery.trim() && (
                                    <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                                      {rows
                                        .filter(r =>
                                          r.student_name?.includes(studentSearchQuery.trim()) &&
                                          !newGroupStudents.some(s => s.id === r.id)
                                        )
                                        .slice(0, 8)
                                        .map(r => (
                                          <button
                                            key={r.id}
                                            type="button"
                                            onClick={() => {
                                              setNewGroupStudents(prev => [...prev, { id: r.id, name: r.student_name }]);
                                              setStudentSearchQuery('');
                                            }}
                                            className="block w-full text-right px-2 py-1 text-sm hover:bg-gray-50"
                                          >
                                            {r.student_name}
                                          </button>
                                        ))}
                                    </div>
                                  )}

                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleCreateGroup(row.id, row.teacher, row.assigned_day, row.assigned_time)}
                                      disabled={!newGroupType || newGroupStudents.length === 0}
                                      className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      צור שיעור
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCreatingGroupFor(null);
                                        setNewGroupStudents([]);
                                        setStudentSearchQuery('');
                                        setNewGroupType('');
                                      }}
                                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50"
                                    >
                                      ביטול
                                    </button>
                                  </div>
                                </div>
                              ) : (
```

- [ ] **Step 5: Default the current row's student into the picker when opening the form**

Replace this block (currently lines 953-956):

```js
                                      if (e.target.value === '__new__') {
                                        setCreatingGroupFor(row.id);
                                        setNewGroupName('');
```

with:

```js
                                      if (e.target.value === '__new__') {
                                        setCreatingGroupFor(row.id);
                                        setNewGroupStudents([{ id: row.id, name: row.student_name }]);
                                        setStudentSearchQuery('');
```

- [ ] **Step 6: Confirm the app builds**

Run: `npx next build`
Expected: build completes with no errors in `components/AdminTable.jsx`.

- [ ] **Step 7: Commit**

```bash
git add components/AdminTable.jsx
git commit -m "feat: rework create-lesson form with fixed lesson types and multi-student picker"
```

---

## Task 4: Manual end-to-end verification

No automated test harness exists for API routes or this component (see Task 2 note), so this feature is verified by running the app and driving the real flow, per the project's UI-testing expectation.

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Golden path — group with multiple students**

In `/admin`, open a student row, expand "שיבוץ", pick a teacher and a day/time, click "➕ צור שיעור חדש". Confirm:
- The type dropdown shows exactly the 11 labels from the spec, in order.
- The current row's student already appears as a tag.
- Typing part of another student's name shows matching suggestions; clicking one adds it as a tag.
- Clicking "צור שיעור" with 3 students and type "מקהלה ב-ו" succeeds, and the group now visible in "הוסף שיעור בנוכחות" is named exactly `מקהלה ב-ו` (no student names in it).
- Re-open each of the 3 students' rows — their "הוסף שיעור בנוכחות" dropdown reflects the new group as their assignment (via `group_id`), and their "מורה" field shows the chosen teacher.

- [ ] **Step 3: Golden path — single-student individual lesson**

Repeat with type "פרטני 45 דקות" and exactly one student. Confirm the created group is named `פרטני 45 דקות - <that student's name>`.

- [ ] **Step 4: Double-booking is still rejected**

Create a group for a teacher at a day/time that already has another group scheduled for the same teacher (reuse an existing group's slot). Confirm the request is rejected with the existing "חיפוף בזמנים עם קבוצה קיימת" error and no group or student attachment happens.

- [ ] **Step 5: Cancel and Escape reset the form**

Open the create-lesson form, add a student and pick a type, then click "ביטול". Reopen it — confirm the student list is back to just the current row's student and no type is selected. Repeat, pressing Escape on the type dropdown instead of clicking "ביטול".

- [ ] **Step 6: Moving a student from one group to another deactivates the old membership**

Pick a student who is already a member of an existing group (via "הוסף שיעור בנוכחות"), then add that same student into a brand-new group created through this form. Confirm in the `students` table (or via the attendance app) that their row under the *old* group is now `is_active: false`, and their row under the *new* group is `is_active: true`.

- [ ] **Step 7: Confirm existing single-row assignment flow is untouched**

Assign a teacher/day/time to a row without creating a group, and separately pick an *existing* group from "הוסף שיעור בנוכחות" for another row — confirm both of these unrelated flows still work exactly as before.
