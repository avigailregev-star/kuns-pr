# Unified Student Row — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat one-row-per-lesson admin table with one row per real student, showing stacked cards for each lesson category (פרטני / הרכב / תיאוריה) and a multi-panel expanded view — without touching the database, the API, or any existing scheduling/conflict-detection logic.

**Architecture:** A new pure grouping function (`lib/groupStudentRows.js`) clusters `registrations` rows in-memory (by `linked_registration_id` chains, plus by matching `student_name`+`parent_phone` for independent individual registrations) and buckets each cluster's rows into three categories. The existing ~450-line teacher/day/time/conflict/group-matching block in `AdminTable.jsx` is extracted verbatim into a new `components/AssignmentPanel.jsx` component (same logic, parameterized by `row` instead of a loop variable) so it can render once per lesson within a group. `AdminTable.jsx` itself is rewritten to group rows before rendering, render stacked category cards in the collapsed row, and render one `AssignmentPanel` per lesson in the expanded row.

**Tech Stack:** Next.js App Router, React (client component), Jest (`next/jest`). No API or schema changes.

## Global Constraints

- **No database, API, or schema changes.** This plan touches only `lib/groupStudentRows.js` (new), `components/AssignmentPanel.jsx` (new), and `components/AdminTable.jsx` (modified). If any task discovers it needs to change an API route or the schema, stop and report — that's outside this plan's scope.
- Grouping key: a cluster is the union of (a) every row reachable via `linked_registration_id` chains (the existing ensemble/theory add-on mechanism) and (b) every row sharing the exact same `student_name` and `parent_phone` as another row already in the cluster. Two real different students who happen to share both fields will be merged incorrectly — this is an accepted, explicitly approved risk, not a bug to fix in this plan.
- Category bucketing per row: `getLessonTypeValue(row.selected_course) === 'theory'` → theory bucket; `'orchestra'` or `'choir'` → ensemble bucket; anything else (including `null`/unrecognized) → individual bucket. This matches today's default (an unrecognized course is effectively "some individual-ish lesson").
- The "contact row" for a group (used for shared contact info, and as the `linked_registration_id` target when adding a new ensemble/theory add-on) is the group's **earliest-created** member (`created_at` ascending).
- Status and payment badges become **per-lesson-card**, not one column per group. The existing `StatusSelect` dropdown and the payment buttons (`✓ סמן כשולם` / `✗ בטל` / `↺ ממתין`) move from the collapsed row / bottom action bar into each `AssignmentPanel`. The single bottom `🗑 מחק רישום` button is removed — each panel gets its own `🗑 מחק שיעור זה` (this already existed for add-on rows' delete-group affordance in the old code; it becomes the only delete affordance now, for every lesson including the original individual one).
- Stats cards (סה"כ / חדשים / בבדיקה / שובצו) keep counting **registrations**, not groups — `rows.length` and `rows.filter(...)`, unchanged from today.
- Filtering (search/status/instrument/teacher/payment) is decided **per group**: a group is shown if `filterRegistrations(group.members, filters).length > 0` — i.e. at least one of its lessons matches — but once shown, **all** of its lessons render, not just the matching one. `lib/registrationFilters.js` itself is not modified.
- Excel/Google Sheets export and print stay flat (one row per registration, via the existing `buildExportRows`/`filtered` rows) — grouping is a display-only concern local to the render tree, not something `buildExportRows` needs to know about. Continue calling these with the flat filtered registration list (derived from the filtered groups' members), not with groups.
- `saveAssignment`'s status-transition and conflict-check logic is not modified — only where it's called from changes (per-panel "שמור" and the new "שמור הכל" that calls it once per changed lesson).

---

## Spec Reference

`docs/superpowers/specs/2026-07-16-unified-student-row-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/groupStudentRows.js` | New. Pure function: `registrations[]` → `groups[]`, each with a contact row, all members, and category buckets. |
| `lib/groupStudentRows.test.js` | New. Unit tests for clustering and bucketing. |
| `components/AssignmentPanel.jsx` | New. The teacher/day/time/conflict/group-matching UI, extracted verbatim from `AdminTable.jsx`, plus the status dropdown, payment buttons, and per-lesson delete button. |
| `components/AdminTable.jsx` | Modified. Groups rows before rendering; collapsed row shows stacked category cards; expanded row renders one `AssignmentPanel` per lesson plus shared contact info and a single "שמור הכל". |

---

## Task 1: `lib/groupStudentRows.js`

**Files:**
- Create: `lib/groupStudentRows.js`
- Test: `lib/groupStudentRows.test.js`

**Interfaces:**
- Produces: `groupStudentRows(rows: Registration[]): Group[]`, where `Group = { key: string, contactRow: Registration, members: Registration[], categories: { individual: Registration[], ensemble: Registration[], theory: Registration[] } }`. `key` is `contactRow.id` (stable identity for React `key` props and for the `expandedRow` state in `AdminTable.jsx`). Groups are sorted by the most recent `created_at` among their members, descending (matches today's default "newest first" table order). Within `categories.individual`/`.ensemble`, members keep their relative order from the input array. `categories.theory` has 0 or 1 entries in practice (enforced elsewhere), but the function does not itself enforce or assume that — it just buckets by lesson type.

- [ ] **Step 1: Write the failing tests**

Create `lib/groupStudentRows.test.js`:

```js
import { groupStudentRows } from './groupStudentRows';

function reg(overrides) {
  return {
    id: 'id',
    student_name: 'שם',
    parent_phone: '050-0000000',
    selected_course: null,
    linked_registration_id: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('groupStudentRows — clustering', () => {
  test('a lone individual registration becomes its own single-member group', () => {
    const rows = [reg({ id: 'r1', student_name: 'דני כהן' })];
    const groups = groupStudentRows(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toEqual([rows[0]]);
    expect(groups[0].contactRow).toBe(rows[0]);
  });

  test('rows linked via linked_registration_id join the same group', () => {
    const source = reg({ id: 'src', student_name: 'דני כהן', created_at: '2026-01-01T00:00:00Z' });
    const theoryAddon = reg({ id: 'addon1', student_name: 'דני כהן', selected_course: 'תיאוריה', linked_registration_id: 'src', created_at: '2026-01-05T00:00:00Z' });
    const ensembleAddon = reg({ id: 'addon2', student_name: 'דני כהן', selected_course: 'תזמורת כלי קשת', linked_registration_id: 'src', created_at: '2026-01-06T00:00:00Z' });
    const groups = groupStudentRows([source, theoryAddon, ensembleAddon]);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(3);
    expect(groups[0].contactRow).toBe(source);
  });

  test('two independent individual registrations with the same student_name and parent_phone are merged', () => {
    const piano = reg({ id: 'p1', student_name: 'נועה ברקאי', parent_phone: '050-3334445', selected_course: 'פסנתר 45 דקות', created_at: '2026-01-10T00:00:00Z' });
    const violin = reg({ id: 'p2', student_name: 'נועה ברקאי', parent_phone: '050-3334445', selected_course: 'כינור 45 דקות', created_at: '2026-01-08T00:00:00Z' });
    const groups = groupStudentRows([piano, violin]);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(2);
    // Earliest created_at wins as the contact row.
    expect(groups[0].contactRow).toBe(violin);
  });

  test('same student_name but different parent_phone stays as separate groups', () => {
    const a = reg({ id: 'a1', student_name: 'יוסי כהן', parent_phone: '050-1111111' });
    const b = reg({ id: 'b1', student_name: 'יוסי כהן', parent_phone: '050-2222222' });
    const groups = groupStudentRows([a, b]);
    expect(groups).toHaveLength(2);
  });

  test('a group formed by two independent individuals can still absorb a linked add-on off either one', () => {
    const piano = reg({ id: 'p1', student_name: 'נועה ברקאי', parent_phone: '050-3334445', created_at: '2026-01-08T00:00:00Z' });
    const violin = reg({ id: 'p2', student_name: 'נועה ברקאי', parent_phone: '050-3334445', created_at: '2026-01-09T00:00:00Z' });
    const theoryAddon = reg({ id: 't1', student_name: 'נועה ברקאי', selected_course: 'תיאוריה', linked_registration_id: 'p2', created_at: '2026-01-10T00:00:00Z' });
    const groups = groupStudentRows([piano, violin, theoryAddon]);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(3);
  });
});

describe('groupStudentRows — category bucketing', () => {
  test('buckets theory, orchestra/choir, and everything else correctly', () => {
    const individual = reg({ id: 'i1', selected_course: 'פסנתר 45 דקות' });
    const unrecognized = reg({ id: 'i2', selected_course: 'משהו לא מוכר', linked_registration_id: null, student_name: 'אחר', parent_phone: '050-9999999' });
    const theory = reg({ id: 't1', selected_course: 'תיאוריה', linked_registration_id: 'i1' });
    const orchestra = reg({ id: 'o1', selected_course: 'תזמורת כלי קשת', linked_registration_id: 'i1' });
    const choir = reg({ id: 'c1', selected_course: 'מקהלה צעירה', linked_registration_id: 'i1' });

    const groups = groupStudentRows([individual, theory, orchestra, choir]);
    expect(groups).toHaveLength(1);
    expect(groups[0].categories.individual).toEqual([individual]);
    expect(groups[0].categories.theory).toEqual([theory]);
    expect(groups[0].categories.ensemble).toEqual([orchestra, choir]);

    const otherGroups = groupStudentRows([unrecognized]);
    expect(otherGroups[0].categories.individual).toEqual([unrecognized]);
  });
});

describe('groupStudentRows — group ordering', () => {
  test('groups are sorted by most recent member created_at, descending', () => {
    const older = reg({ id: 'o1', student_name: 'ישן', parent_phone: '050-1', created_at: '2026-01-01T00:00:00Z' });
    const newer = reg({ id: 'n1', student_name: 'חדש', parent_phone: '050-2', created_at: '2026-01-15T00:00:00Z' });
    const groups = groupStudentRows([older, newer]);
    expect(groups.map(g => g.contactRow.id)).toEqual(['n1', 'o1']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest lib/groupStudentRows.test.js`
Expected: FAIL — `Cannot find module './groupStudentRows'`.

- [ ] **Step 3: Implement `lib/groupStudentRows.js`**

```js
import { getLessonTypeValue } from './groupNaming';

function find(parent, id) {
  let cur = id;
  while (parent.get(cur) !== cur) cur = parent.get(cur);
  return cur;
}

function union(parent, a, b) {
  const ra = find(parent, a);
  const rb = find(parent, b);
  if (ra !== rb) parent.set(ra, rb);
}

export function groupStudentRows(rows) {
  const parent = new Map();
  for (const r of rows) parent.set(r.id, r.id);

  for (const r of rows) {
    if (r.linked_registration_id && parent.has(r.linked_registration_id)) {
      union(parent, r.id, r.linked_registration_id);
    }
  }

  const byNamePhone = new Map();
  for (const r of rows) {
    const key = `${r.student_name}|||${r.parent_phone}`;
    if (byNamePhone.has(key)) {
      union(parent, r.id, byNamePhone.get(key));
    } else {
      byNamePhone.set(key, r.id);
    }
  }

  const clusters = new Map();
  for (const r of rows) {
    const root = find(parent, r.id);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(r);
  }

  const groups = [];
  for (const members of clusters.values()) {
    const byCreatedAtAsc = members.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const contactRow = byCreatedAtAsc[0];

    const categories = { individual: [], ensemble: [], theory: [] };
    for (const r of members) {
      const type = getLessonTypeValue(r.selected_course);
      if (type === 'theory') categories.theory.push(r);
      else if (type === 'orchestra' || type === 'choir') categories.ensemble.push(r);
      else categories.individual.push(r);
    }

    groups.push({ key: contactRow.id, contactRow, members, categories });
  }

  groups.sort((a, b) => {
    const aMax = Math.max(...a.members.map(m => new Date(m.created_at).getTime()));
    const bMax = Math.max(...b.members.map(m => new Date(m.created_at).getTime()));
    return bMax - aMax;
  });

  return groups;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest lib/groupStudentRows.test.js`
Expected: PASS — all tests pass.

- [ ] **Step 5: Run the full test suite to confirm no regressions**

Run: `npx jest`
Expected: PASS — all existing tests still pass alongside the new ones.

- [ ] **Step 6: Commit**

```bash
git add lib/groupStudentRows.js lib/groupStudentRows.test.js
git commit -m "feat: add pure student-row grouping/bucketing helper"
```

---

## Task 2: Extract `components/AssignmentPanel.jsx`

**Files:**
- Create: `components/AssignmentPanel.jsx`
- Modify: `components/AdminTable.jsx` (removes the extracted block, imports and renders the new component instead)

**Interfaces:**
- Produces: `<AssignmentPanel row={row} rows={rows} teachers={teachers} groups={groups} selectedGroups={selectedGroups} setSelectedGroups={setSelectedGroups} groupTypeFilter={groupTypeFilter} setGroupTypeFilter={setGroupTypeFilter} creatingGroupFor={creatingGroupFor} setCreatingGroupFor={setCreatingGroupFor} newGroupStudents={newGroupStudents} setNewGroupStudents={setNewGroupStudents} studentSearchQuery={studentSearchQuery} setStudentSearchQuery={setStudentSearchQuery} updateAssignment={updateAssignment} handleCreateGroup={handleCreateGroup} updateStatus={updateStatus} updatePaymentStatus={updatePaymentStatus} deleteRegistration={deleteRegistration} updatingIds={updatingIds} savedIds={savedIds} onSave={() => saveAssignment(row)} />` — a self-contained panel for exactly one lesson (`row`). This is a leaf UI component; it has no exports besides the default component.

**This is a mechanical extraction, not a rewrite.** The goal is to move the existing, already-correct logic into its own file with minimal semantic change — do not "improve," restructure, or simplify the extracted logic while moving it. Any behavior change beyond what's explicitly listed below is a bug in this task.

- [ ] **Step 1: Identify the exact block to extract**

In the current `components/AdminTable.jsx`, the block to move starts at the `{/* Assignment */}` comment (currently around line 788: `<div><h4 className="font-semibold text-gray-700 mb-2">שיבוץ</h4>`) and ends right before the `{/* Add-on registrations (ensemble / theory) */}` comment (currently around line 1279-1280, at the closing `</div></div>` of the Assignment block). Read the current file yourself to find the exact current line numbers — prior tasks may have shifted them slightly; anchor on the `{/* Assignment */}` and `{/* Add-on registrations */}` comment text, not the line numbers in this brief.

This block currently references these identifiers, all of which must become props (not closures) on the new component: `row`, `rows`, `teachers`, `groups`, `selectedGroups`, `setSelectedGroups`, `groupTypeFilter`, `setGroupTypeFilter`, `creatingGroupFor`, `setCreatingGroupFor`, `newGroupStudents`, `setNewGroupStudents`, `studentSearchQuery`, `setStudentSearchQuery`, `updateAssignment`, `handleCreateGroup`. It also uses module-level constants/helpers already in `AdminTable.jsx` that must be imported fresh into the new file instead of relying on closure: `DAY_NAMES`, `INDIVIDUAL_LESSON_TYPES`, `timeToMins`, `minsToTime`, `getLessonDuration` (from `lib/lessonDuration`), `freeMinutesOnDay`, `getGroupLessonDuration` (from `lib/teacherCapacity`), `LESSON_TYPE_OPTIONS`, `getLessonTypeValue`, `computeGroupName`, `matchesLessonType` (from `lib/groupNaming`), `FIXED_COURSE_TIMES`, `filterRangesToFixedDay` (from `lib/fixedCourseDays`).

`DAY_NAMES` and `INDIVIDUAL_LESSON_TYPES` are currently defined as module-level constants directly in `AdminTable.jsx` (near the top of the file, alongside `timeToMins`/`minsToTime`). Move `DAY_NAMES` and `INDIVIDUAL_LESSON_TYPES` into `AssignmentPanel.jsx` as its own module-level constants (duplicate the exact values), and also move `timeToMins`/`minsToTime` into `AssignmentPanel.jsx` (duplicate them) — `AdminTable.jsx` still needs its own copies of `DAY_NAMES`/`timeToMins`/`minsToTime` for the collapsed-row rendering and other unrelated uses elsewhere in the file (Task 3), so this is intentional duplication, not a shared import — do not create a shared constants module for this; keep each file self-contained per the plan's minimal-footprint approach.

- [ ] **Step 2: Add the new component's status/payment/delete controls**

The old code had the status dropdown (`StatusSelect`) in the collapsed row (outside the extracted block) and the payment buttons + delete button in the bottom action bar (also outside the extracted block, currently around line 1419-1456: the `{/* Save button + payment status buttons */}` div). Per this plan's Global Constraints, these move **into** `AssignmentPanel`, one instance per lesson. Add, near the top of the panel (above or beside the "שיבוץ" heading):

```jsx
<div className="flex items-center justify-between mb-2">
  <h4 className="font-semibold text-gray-700">שיבוץ</h4>
  <StatusSelect
    value={row.status}
    onChange={(val) => updateStatus(row.id, val)}
    disabled={updatingIds.includes(row.id)}
  />
</div>
```

(import `StatusSelect` from `./StatusSelect` in the new file — it is not part of the extracted block but is now needed here.)

At the bottom of the panel (replacing where the old bottom action bar's per-registration buttons were, adapted to operate on this panel's own `row`):

```jsx
<div className="flex flex-wrap items-center gap-2 justify-end mt-3">
  <button
    onClick={() => deleteRegistration(row.id, row.student_name)}
    disabled={updatingIds.includes(row.id)}
    className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-40 disabled:cursor-not-allowed ml-auto"
  >
    🗑 מחק שיעור זה
  </button>
  <button
    onClick={() => updatePaymentStatus(row.id, 'Confirmed')}
    disabled={updatingIds.includes(row.id) || row.registration_status === 'Confirmed'}
    className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
  >
    ✓ סמן כשולם
  </button>
  <button
    onClick={() => updatePaymentStatus(row.id, 'Cancelled')}
    disabled={updatingIds.includes(row.id) || row.registration_status === 'Cancelled'}
    className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
  >
    ✗ בטל
  </button>
  <button
    onClick={() => updatePaymentStatus(row.id, 'Pending')}
    disabled={updatingIds.includes(row.id) || row.registration_status === 'Pending'}
    className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-40 disabled:cursor-not-allowed"
  >
    ↺ ממתין
  </button>
  <button
    onClick={onSave}
    disabled={updatingIds.includes(row.id)}
    className={`text-sm px-4 py-2 rounded-xl font-semibold transition-colors ${savedIds.includes(row.id) ? 'bg-green-500 text-white' : 'btn-primary'}`}
  >
    {updatingIds.includes(row.id) ? '⏳ שומר...' : savedIds.includes(row.id) ? '✓ נשמר!' : '💾 שמור'}
  </button>
</div>
```

Wrap the whole panel (heading+status, the extracted assignment block, and this new footer) in an outer `<div className="border border-gray-200 rounded-lg p-3">` so panels are visually distinct when several render side by side (Task 3 will place them in a grid).

- [ ] **Step 3: Write `components/AssignmentPanel.jsx`**

Assemble the file: `'use client';` directive, the imports listed in Step 1 plus `StatusSelect` and `React` (`useState` is not needed — this component is fully controlled via props, no local state), the module-level `DAY_NAMES`/`INDIVIDUAL_LESSON_TYPES`/`timeToMins`/`minsToTime` duplicated per Step 1, then `export default function AssignmentPanel({ row, rows, teachers, groups, selectedGroups, setSelectedGroups, groupTypeFilter, setGroupTypeFilter, creatingGroupFor, setCreatingGroupFor, newGroupStudents, setNewGroupStudents, studentSearchQuery, setStudentSearchQuery, updateAssignment, handleCreateGroup, updateStatus, updatePaymentStatus, deleteRegistration, updatingIds, savedIds, onSave }) { return ( <div className="border border-gray-200 rounded-lg p-3"> ...Step 2's header... ...the extracted block from Step 1, verbatim, with its own wrapping `<div className="space-y-2">` intact... ...Step 2's footer... </div> ); }`.

- [ ] **Step 4: Remove the extracted block from `AdminTable.jsx` and render `AssignmentPanel` in its place**

This step is completed together with Task 3 (which restructures the surrounding expanded-row JSX anyway) — do not leave `AdminTable.jsx` in a half-migrated state. If you reach this point and Task 3 has not started, stop and do a minimal placeholder replacement: render a single `<AssignmentPanel row={row} .../>` exactly where the old block was, passing through all the same identifiers that were previously closures (they're all already in scope in `AdminTable.jsx` at that point), so the app is left in a working, buildable state even before Task 3's full restructuring.

Also: `AdminTable.jsx` no longer needs its own `StatusSelect`-in-collapsed-row usage or the old bottom action bar's per-row buttons once `AssignmentPanel` owns them — but do not remove those from `AdminTable.jsx` in this task if Task 3 hasn't run yet, to avoid a broken intermediate state. Coordinate: if you are the implementer for both Task 2 and Task 3 in immediate succession, do them as one continuous work session ending in a fully-consistent file; if Task 2 must be committed alone first, leave `AdminTable.jsx`'s collapsed-row `StatusSelect` and bottom action bar exactly as they are today (still functional, just now duplicated with what `AssignmentPanel` also renders) and note this explicitly in your report as a known, temporary duplication that Task 3 resolves.

- [ ] **Step 5: Confirm the app builds**

Run: `npx next build`
Expected: build completes with no errors in `components/AssignmentPanel.jsx` or `components/AdminTable.jsx`.

- [ ] **Step 6: Commit**

```bash
git add components/AssignmentPanel.jsx components/AdminTable.jsx
git commit -m "refactor: extract AssignmentPanel from AdminTable for per-lesson reuse"
```

---

## Task 3: Rewrite `AdminTable.jsx`'s table body to render grouped rows

**Files:**
- Modify: `components/AdminTable.jsx`

**Interfaces:**
- Consumes: `groupStudentRows` from `lib/groupStudentRows.js` (Task 1); `AssignmentPanel` from `components/AssignmentPanel.jsx` (Task 2).
- Produces: no new exports — leaf UI change. If Task 2 left `AdminTable.jsx` with duplicated status/payment/delete controls (per Task 2 Step 4's fallback), this task removes those duplicates as part of the rewrite described below.

This task fully replaces the collapsed-row `<td>`s and the expanded-row content described below. No automated test harness exists for this component (same as prior plans touching this file) — verified by `next build` and by manual end-to-end testing (Task 4).

- [ ] **Step 1: Compute groups and per-group filtering**

Import `groupStudentRows` at the top of the file. Replace the current:

```js
  const filtered = filterRegistrations(rows, {
    search,
    status: filterStatus,
    instrument: filterInstrument,
    teacher: filterTeacher,
    payment: filterPayment,
  });
```

with:

```js
  const allGroups = useMemo(() => groupStudentRows(rows), [rows]);
  const activeFilters = { search, status: filterStatus, instrument: filterInstrument, teacher: filterTeacher, payment: filterPayment };
  const filteredGroups = allGroups.filter(g => filterRegistrations(g.members, activeFilters).length > 0);
  const filtered = filteredGroups.flatMap(g => g.members);
```

`filtered` is kept (now derived from the filtered groups' members) because `exportToExcel(filtered)`, `handleExportToSheet` (via `buildExportRows(rows)` — note: that one already uses the unfiltered `rows`, leave it as-is), and `printTable(filtered)` all still expect a flat registration array — per Global Constraints, export/print stay flat and unaffected by grouping.

- [ ] **Step 2: Track updating/saved state as sets, not single ids**

Replace:

```js
  const [updating, setUpdating] = useState(null);
  const [saved, setSaved] = useState(null);
```

with:

```js
  const [updatingIds, setUpdatingIds] = useState([]);
  const [savedIds, setSavedIds] = useState([]);
```

Update every existing usage of `setUpdating(id)` / `setUpdating(null)` throughout the file (in `updateStatus`, `updateAssignment`'s callers, `saveAssignment`, `saveDetails`, `deleteRegistration`, `updatePaymentStatus`) to instead add/remove that specific id from the array: `setUpdatingIds(prev => [...prev, id])` to start, `setUpdatingIds(prev => prev.filter(x => x !== id))` to finish (in each function's `finally` block). Same pattern for `setSaved(row.id)` → `setSavedIds(prev => [...prev, row.id])`, and its `setTimeout(() => setSaved(null), 3000)` → `setTimeout(() => setSavedIds(prev => prev.filter(x => x !== row.id)), 3000)`. Every place that read `updating === row.id` becomes `updatingIds.includes(row.id)`; every place that read `saved === row.id` becomes `savedIds.includes(row.id)`.

This change is required because "שמור הכל" (Step 5) can trigger several concurrent per-lesson saves, and a single `updating`/`saved` id can no longer represent that.

- [ ] **Step 3: Fix `handleAddAddon` to keep the group expanded after adding a lesson**

`expandedRow` now holds a **group key** (`contactRow.id`), not an arbitrary registration id. The existing `handleAddAddon` function ends with `setExpandedRow(json.data.id)` — that sets it to the *newly created* lesson's own id, which (after this plan's changes) will never match any group's `key`, so the row would appear to collapse right after successfully adding an ensemble/theory lesson. Since every call site in the rewritten `AdminTable.jsx` (Task 3 Step 5) calls `handleAddAddon(contactRow, ...)`, fix this by changing that one line in the existing `handleAddAddon` function from:

```js
      setExpandedRow(json.data.id);
```

to:

```js
      setExpandedRow(row.id);
```

(`row` here is `handleAddAddon`'s own parameter — the contact row passed in by the caller — not the newly created lesson. `row.id` equals the group's `key` at every call site after this plan's rewrite, so the group stays expanded and the new card appears inside it.)

- [ ] **Step 4: Add a "שמור הכל" handler**

Add near `saveAssignment`:

```js
  async function saveAllInGroup(group) {
    const allLessons = [...group.categories.individual, ...group.categories.ensemble, ...group.categories.theory];
    for (const lesson of allLessons) {
      await saveAssignment(lesson);
    }
  }
```

Sequential (not `Promise.all`) deliberately — `saveAssignment` includes a same-teacher schedule-conflict check server-side that reads other registrations' current state; saving lessons for the same student one at a time avoids two of that same student's own lessons racing against a stale read of each other.

- [ ] **Step 5: Rewrite the collapsed row**

Replace the `<thead>` row (currently: תאריך, תלמיד/ה, הורה/טלפון, סוג, כלים, סטטוס, תשלום, פעולות) with:

```jsx
              <tr>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">תאריך</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">תלמיד/ה</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">הורה / טלפון</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">סוג</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">🎻 פרטני</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">🎼 הרכב</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">📘 תיאוריה</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">פעולות</th>
              </tr>
```

(the standalone "תשלום" column is removed — payment is now per-card within each of the three category columns, and per-panel in the expanded view, per Global Constraints).

Replace `{filtered.length === 0 && (...)}` to check `filteredGroups.length === 0` instead, and `colSpan={8}` stays `8` (still 8 columns, just different ones).

Replace `{filtered.map((row) => (...))}` with `{filteredGroups.map((group) => (...))}`, and inside, replace `row` with `group.contactRow` for the shared cells (date, student name, parent/phone, type), and add a small local helper for rendering one category's stacked cards:

```jsx
              {filteredGroups.map((group) => {
                const { contactRow } = group;
                const renderCategoryCell = (categoryRows, emptyLabel) => (
                  <td className="px-4 py-3">
                    {categoryRows.length === 0 ? (
                      <span className="text-gray-300">—</span>
                    ) : (
                      <div className="space-y-1.5">
                        {categoryRows.map(r => (
                          <div key={r.id} className="text-xs bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5">
                            <div className="font-medium text-gray-700">{r.selected_course || emptyLabel}</div>
                            {r.teacher && r.assigned_day != null && (
                              <div className="text-green-700">
                                {r.teacher} · יום {DAY_NAMES[Number(r.assigned_day)]}
                                {r.assigned_time ? ` ${r.assigned_time.slice(0, 5)}` : ''}
                              </div>
                            )}
                            <div className="flex gap-1 mt-1">
                              <StatusSelect value={r.status} onChange={(val) => updateStatus(r.id, val)} disabled={updatingIds.includes(r.id)} />
                              <RegistrationStatusBadge status={r.registration_status} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                );
                return (
                  <React.Fragment key={group.key}>
                    <tr className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(contactRow.created_at).toLocaleDateString('he-IL')}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {contactRow.student_name}
                        {contactRow.attended_open_day === false && (
                          <span className="mr-1 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">
                            טרם שיחת היכרות
                          </span>
                        )}
                        {contactRow.has_accommodations && (
                          <span className="mr-1 text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full font-medium">
                            התאמות
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        <div>{contactRow.parent_name}</div>
                        <div className="text-xs" dir="ltr">{contactRow.parent_phone}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{getTypeLabel(contactRow)}</td>
                      {renderCategoryCell(group.categories.individual, 'פרטני')}
                      {renderCategoryCell(group.categories.ensemble, 'הרכב')}
                      {renderCategoryCell(group.categories.theory, 'תיאוריה')}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpandedRow(expandedRow === group.key ? null : group.key)}
                          className="text-primary text-xs hover:underline"
                        >
                          {expandedRow === group.key ? '▲ סגור' : '▼ פרטים'}
                        </button>
                      </td>
                    </tr>
                    {expandedRow === group.key && (
                      /* Step 5 fills this in */
                      null
                    )}
                  </React.Fragment>
                );
              })}
```

Note the per-card badge no longer uses `getAddonBadge` — the emoji is now on the column header (🎻/🎼/📘) instead of a per-name badge, so the `getAddonBadge` import and its usage in the old student-name cell are removed as part of this rewrite (the column position already conveys the category).

- [ ] **Step 6: Rewrite the expanded row**

Replace the `null` placeholder from Step 4 with:

```jsx
                    {expandedRow === group.key && (
                      <tr className="bg-primary-50">
                        <td colSpan={8} className="px-6 py-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            {/* Contact — shown once per group, from contactRow */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold text-gray-700">פרטי קשר</h4>
                                {!editingDetails[contactRow.id] && (
                                  <button
                                    type="button"
                                    onClick={() => setEditingDetails(prev => ({ ...prev, [contactRow.id]: {
                                      student_name: contactRow.student_name,
                                      parent_name: contactRow.parent_name,
                                      parent_phone: contactRow.parent_phone,
                                      parent_email: contactRow.parent_email,
                                    }}))}
                                    className="text-xs text-blue-600 hover:underline"
                                  >
                                    ✏️ ערוך
                                  </button>
                                )}
                              </div>
                              {editingDetails[contactRow.id] ? (
                                <div className="space-y-2">
                                  <div>
                                    <label className="text-xs text-gray-500">שם תלמיד/ה</label>
                                    <input
                                      className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm"
                                      value={editingDetails[contactRow.id].student_name || ''}
                                      onChange={e => setEditingDetails(prev => ({ ...prev, [contactRow.id]: { ...prev[contactRow.id], student_name: e.target.value }}))}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-500">שם הורה</label>
                                    <input
                                      className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm"
                                      value={editingDetails[contactRow.id].parent_name || ''}
                                      onChange={e => setEditingDetails(prev => ({ ...prev, [contactRow.id]: { ...prev[contactRow.id], parent_name: e.target.value }}))}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-500">טלפון</label>
                                    <input
                                      className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm"
                                      dir="ltr"
                                      value={editingDetails[contactRow.id].parent_phone || ''}
                                      onChange={e => setEditingDetails(prev => ({ ...prev, [contactRow.id]: { ...prev[contactRow.id], parent_phone: e.target.value }}))}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-500">אימייל</label>
                                    <input
                                      className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm"
                                      dir="ltr"
                                      value={editingDetails[contactRow.id].parent_email || ''}
                                      onChange={e => setEditingDetails(prev => ({ ...prev, [contactRow.id]: { ...prev[contactRow.id], parent_email: e.target.value }}))}
                                    />
                                  </div>
                                  <div className="flex gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => saveDetails(contactRow.id)}
                                      disabled={updatingIds.includes(contactRow.id)}
                                      className="text-xs px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                                    >
                                      שמור
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingDetails(prev => { const n = { ...prev }; delete n[contactRow.id]; return n; })}
                                      className="text-xs px-3 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    >
                                      ביטול
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p className="text-sm text-gray-600">👤 {contactRow.parent_name}</p>
                                  <p className="text-sm text-gray-600" dir="ltr">📞 {contactRow.parent_phone}</p>
                                  <p className="text-sm text-gray-600">📧 {contactRow.parent_email}</p>
                                  <p className="text-sm text-gray-600">
                                    📅 שיחה טלפונית בזמן רצוי: {contactRow.preferred_slot || '—'}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    🚫 ימים לא פנויים:{' '}
                                    {Array.isArray(contactRow.unavailable_days) && contactRow.unavailable_days.length > 0
                                      ? contactRow.unavailable_days.map(d => `יום ${d}`).join(', ')
                                      : 'ללא הגבלה'}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    🏫 בית ספר: {contactRow.school_name || '—'}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    🎓 כיתה: {contactRow.grade || '—'}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    🎂 תאריך לידה: {contactRow.birthdate ? new Date(contactRow.birthdate).toLocaleDateString('he-IL') : '—'}
                                  </p>
                                </>
                              )}
                            </div>

                            {/* Notes — shared once per group, stored on the contact row */}
                            <div>
                              <h4 className="font-semibold text-gray-700 mb-2">הערות מנהל</h4>
                              <textarea
                                className="admin-input h-20 resize-none"
                                value={contactRow.admin_notes || ''}
                                onChange={(e) => updateAssignment(contactRow.id, 'admin_notes', e.target.value)}
                                onBlur={(e) => saveNotes(contactRow.id, e.target.value)}
                                placeholder="הוסף הערות פנימיות..."
                              />
                              {contactRow.availability_notes && (
                                <>
                                  <h4 className="font-semibold text-gray-700 mb-2 mt-3">הערות זמינות</h4>
                                  <div className="admin-input h-20 overflow-y-auto text-sm text-gray-600 bg-amber-50 border-amber-200">
                                    {contactRow.availability_notes}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          {/* One AssignmentPanel per lesson, grouped by category */}
                          <div className="space-y-4">
                            {[
                              { label: '🎻 פרטני', kind: 'individual', lessons: group.categories.individual, addonKind: null },
                              { label: '🎼 הרכב', kind: 'ensemble', lessons: group.categories.ensemble, addonKind: 'ensemble' },
                              { label: '📘 תיאוריה', kind: 'theory', lessons: group.categories.theory, addonKind: 'theory' },
                            ].map(section => (
                              <div key={section.kind}>
                                <h4 className="font-semibold text-gray-700 mb-2">{section.label}</h4>
                                {section.lessons.length > 0 ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {section.lessons.map(lesson => (
                                      <AssignmentPanel
                                        key={lesson.id}
                                        row={lesson}
                                        rows={rows}
                                        teachers={teachers}
                                        groups={groups}
                                        selectedGroups={selectedGroups}
                                        setSelectedGroups={setSelectedGroups}
                                        groupTypeFilter={groupTypeFilter}
                                        setGroupTypeFilter={setGroupTypeFilter}
                                        creatingGroupFor={creatingGroupFor}
                                        setCreatingGroupFor={setCreatingGroupFor}
                                        newGroupStudents={newGroupStudents}
                                        setNewGroupStudents={setNewGroupStudents}
                                        studentSearchQuery={studentSearchQuery}
                                        setStudentSearchQuery={setStudentSearchQuery}
                                        updateAssignment={updateAssignment}
                                        handleCreateGroup={handleCreateGroup}
                                        updateStatus={updateStatus}
                                        updatePaymentStatus={updatePaymentStatus}
                                        deleteRegistration={deleteRegistration}
                                        updatingIds={updatingIds}
                                        savedIds={savedIds}
                                        onSave={() => saveAssignment(lesson)}
                                      />
                                    ))}
                                  </div>
                                ) : section.addonKind ? (
                                  <button
                                    type="button"
                                    onClick={() => { setAddonPickerFor({ rowId: contactRow.id, kind: section.addonKind === 'ensemble' ? 'ensemble' : 'theory' }); setAddonNewLabel(''); }}
                                    className="text-xs px-3 py-1.5 rounded-lg border border-dashed border-indigo-300 text-indigo-700 hover:bg-indigo-50 w-full"
                                  >
                                    + הוסף {section.addonKind === 'ensemble' ? 'הרכב' : 'תיאוריה'}
                                  </button>
                                ) : (
                                  <p className="text-xs text-gray-400">אין שיעור פרטני</p>
                                )}

                                {addonPickerFor?.rowId === contactRow.id && addonPickerFor.kind === section.addonKind && (() => {
                                  const wantedTypes = addonPickerFor.kind === 'theory' ? ['theory'] : ['orchestra', 'choir'];
                                  const matching = groups.filter(g => wantedTypes.includes(g.lesson_type));
                                  return (
                                    <div className="border border-gray-200 rounded-lg p-2 space-y-1 max-h-56 overflow-y-auto mt-2">
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
                                            onClick={() => handleAddAddon(contactRow, { groupId: g.id })}
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
                                          onClick={() => handleAddAddon(contactRow, { newLabel: THEORY_LABEL })}
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
                                            onClick={() => handleAddAddon(contactRow, { newLabel: addonNewLabel })}
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
                            ))}
                          </div>

                          {contactRow.message_log && contactRow.message_log.length > 0 && (
                            <div className="mt-4">
                              <h4 className="font-semibold text-gray-700 mb-2">לוג הודעות</h4>
                              <div className="space-y-1">
                                {contactRow.message_log.map((log, i) => (
                                  <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
                                    <span className={log.status === 'sent' ? 'text-green-600' : 'text-yellow-600'}>
                                      {log.status === 'sent' ? '✓' : '⏳'}
                                    </span>
                                    <span>{log.action}</span>
                                    {log.sent_at && (
                                      <span>{new Date(log.sent_at).toLocaleString('he-IL')}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex justify-end mt-4">
                            <button
                              onClick={() => saveAllInGroup(group)}
                              className="text-sm px-4 py-2 rounded-xl font-semibold btn-primary"
                            >
                              💾 שמור הכל
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
```

Note: the `type === 'continue'` "שיבוץ אוטומטי" (auto-assignment suggestion) block from the old code, and the group-type-filter's "matchingGroups"/"הוסף שיעור בנוכחות" dropdown (the pre-existing "צור שיעור" mechanism), are now entirely inside `AssignmentPanel` (moved there in Task 2) rather than in `AdminTable.jsx` — do not duplicate them here.

- [ ] **Step 7: Remove now-dead code**

`AdminTable.jsx` no longer needs: the `RegistrationStatusBadge`-in-its-own-column usage from the old collapsed row (it's still used, just now inside `renderCategoryCell` and inside `AssignmentPanel` — keep the `RegistrationStatusBadge` function definition itself, just confirm no orphaned old usage remains), the old bottom "Save button + payment status buttons" div, the old single `StatusSelect` collapsed-row column, and the `getAddonBadge` import if nothing else in the file uses it (search the file after your edits — if `getAddonBadge` has no remaining call site, remove it from the `lib/groupNaming` import list; if `getLessonTypeValue`, `matchesLessonType`, `LESSON_TYPE_OPTIONS`, `computeGroupName`, `THEORY_LABEL`, `ENSEMBLE_LABELS` are still used directly in `AdminTable.jsx` after the rewrite, keep those specific imports — check each one individually rather than assuming the whole import line is dead).

- [ ] **Step 8: Confirm the app builds**

Run: `npx next build`
Expected: build completes with no errors or unused-variable warnings introduced by this change.

- [ ] **Step 9: Commit**

```bash
git add components/AdminTable.jsx
git commit -m "feat: render grouped student rows with stacked category cards and multi-panel details"
```

---

## Task 4: Manual end-to-end verification

No automated test harness exists for `AdminTable.jsx`/`AssignmentPanel.jsx` (confirmed in Tasks 2-3). This feature is exercised against real data in the running app, so verification is manual — and because this plan touches heavily-used existing scheduling logic, this task must be run carefully and any mutating test data cleaned up afterward, same discipline as the previous plan's Task 5.

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server and confirm a clean baseline**

Run: `npm run dev`, then load `/admin`. Confirm the table renders without console errors and the row count/stats match what they were before this change (same total registrations, just regrouped visually).

- [ ] **Step 2: Golden path — a student with only an individual lesson (the common case)**

Find a student with just one registration. Confirm: one row, a single card under "🎻 פרטני", "—" under "🎼 הרכב" and "📘 תיאוריה". Expand it — confirm one `AssignmentPanel` under "פרטני" with the exact same teacher/day/time picker behavior as before this change (pick a day, pick a time, confirm availability/conflict logic still works), and "אין שיעור פרטני" is never shown for this row (only truly-empty ensemble/theory categories get the "+ הוסף" button; an empty individual category — which shouldn't normally happen — shows plain text, not a button, per Task 3 Step 5).

- [ ] **Step 3: Golden path — a student with individual + ensemble + theory (linked via `linked_registration_id`)**

Use a student from the previous ensemble/theory add-on feature's testing (or create one via "+ הוסף הרכב"/"+ הוסף תיאוריה" the same way as before — the buttons now live inside the empty category section instead of a separate "הוספת שיבוץ" block, but call the same `handleAddAddon`/API). Confirm: one row, three cards (one per category), each with its own status. Expand — confirm three `AssignmentPanel`s, grouped under their category headings, each independently editable and saveable. Click "💾 שמור הכל" after changing two of the three panels — confirm both changes persist (check via reload) and the sequential save (Task 3 Step 3) doesn't produce a false conflict-check rejection between the student's own lessons.

- [ ] **Step 4: The two-independent-individuals case**

Find (or temporarily identify, without creating new data) one of the ~5 real students with two separate individual registrations sharing `student_name`+`parent_phone`. Confirm they now appear as **one row** with two stacked cards under "🎻 פרטני", and expanding shows two separate `AssignmentPanel`s under the "פרטני" heading, each editable independently, each with its own "🗑 מחק שיעור זה" that only removes that one lesson.

- [ ] **Step 5: Filtering**

Set the status filter to a status that only one lesson-category of a mixed student matches (e.g. the student from Step 3, filter by "חדש" if their theory is still "חדש" while individual/ensemble are "שובץ"). Confirm the row still appears, showing **all three** of its cards, not just the matching one — per the Global Constraints' "at least one match, show everything" rule.

- [ ] **Step 6: Export and print are unaffected**

Click "📊 ייצוא Excel" and "🖨️ הדפסה" with a mix of single- and multi-lesson students in the filtered view. Confirm the exported/printed output is still one row per registration (flat), exactly as before this change — not grouped.

- [ ] **Step 7: Regression check — unrelated existing flows**

For an unrelated student, run through the existing "צור שיעור"/"הוסף שיעור בנוכחות" flow inside their individual `AssignmentPanel` exactly as documented in the previous plans' manual-verification steps, to confirm the extraction in Task 2 didn't change its behavior.

- [ ] **Step 8: Clean up**

Delete any registrations created purely for this verification (via each panel's own "🗑 מחק שיעור זה"), and confirm via reload that the table returns to its pre-verification row count.
