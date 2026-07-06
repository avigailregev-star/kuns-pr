# Individual Lesson Matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "הוסף שיעור בנוכחות" (attach to existing lesson) picker find individual (single-student) lessons, whose names are always `"<type label> - <student name>"`, when the admin selects the base type label — not just bare-label group lessons.

**Architecture:** A new pure function `matchesLessonType(groupName, selectedType)` in `lib/groupNaming.js` (same module as `LESSON_TYPE_OPTIONS`), unit-tested directly, then wired into `components/AdminTable.jsx`'s existing `matchingGroups` filter in place of the current exact-equality check.

**Tech Stack:** Plain JS (no framework deps for the new function), Jest.

## Global Constraints

- A group/lesson matches a selected type label if its name is **exactly equal** to the label, **or starts with** `"<label> - "` (label, space, hyphen, space) — copied verbatim from the spec.
- Do not match on a bare "starts with the label" (no separator) — this would cause a false match between `"מקהלה צעירה"` and real lessons named `"מקהלה צעירה ייצוגית"`, which are a different type entirely.
- Do not change `computeGroupName` or `getLessonTypeValue` — this is a new, separate function.
- Do not touch `app/api/groups/route.js` or `app/api/update-status/route.js` — unrelated to this fix.

---

## Spec Reference

`docs/superpowers/specs/2026-07-06-individual-lesson-match-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/groupNaming.js` | Modified. Adds `matchesLessonType(groupName, selectedType)`. |
| `lib/groupNaming.test.js` | Modified. Adds tests for the new function, including the prefix-collision case. |
| `components/AdminTable.jsx` | Modified. Uses `matchesLessonType` instead of `===` in the `matchingGroups` filter. |

---

## Task 1: Add `matchesLessonType` and wire it into the picker

**Files:**
- Modify: `lib/groupNaming.js`
- Test: `lib/groupNaming.test.js`
- Modify: `components/AdminTable.jsx:927-931`

**Interfaces:**
- Produces: `matchesLessonType(groupName: string, selectedType: string): boolean`, exported from `lib/groupNaming.js` alongside the existing exports.
- Consumes (in `AdminTable.jsx`): the existing `groups`, `selectedTeacherForGroups`, `selectedType` variables already in scope at the filter site — no new state.

- [ ] **Step 1: Write the failing tests**

Add this `describe` block to the end of `lib/groupNaming.test.js` (after the existing `computeGroupName` block, keep everything else in the file unchanged):

```js
describe('matchesLessonType', () => {
  test('exact match to a bare group label', () => {
    expect(matchesLessonType('מקהלה צעירה', 'מקהלה צעירה')).toBe(true);
  });

  test('matches an individual lesson named "<type> - <student>"', () => {
    expect(matchesLessonType('פרטני 45 דקות - אביגיל לויץ טסט', 'פרטני 45 דקות')).toBe(true);
  });

  test('does not match a different type', () => {
    expect(matchesLessonType('פרטני 60 דקות - דנה לוי', 'פרטני 45 דקות')).toBe(false);
  });

  test('does not false-match a label that is a text-prefix of a different real label', () => {
    // "מקהלה צעירה" is a substring-prefix of "מקהלה צעירה ייצוגית", a different type —
    // selecting the former must not pull in lessons of the latter.
    expect(matchesLessonType('מקהלה צעירה ייצוגית', 'מקהלה צעירה')).toBe(false);
  });

  test('does not match when no type is selected', () => {
    expect(matchesLessonType('פרטני 45 דקות - אביגיל לויץ טסט', '')).toBe(false);
  });
});
```

Also update the existing `import` line at the top of `lib/groupNaming.test.js` to include the new function:

```js
import { LESSON_TYPE_OPTIONS, getLessonTypeValue, computeGroupName, matchesLessonType } from './groupNaming';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest lib/groupNaming.test.js`
Expected: FAIL — `matchesLessonType` is not exported yet, so the import resolves to `undefined` and every new test throws calling a non-function.

- [ ] **Step 3: Implement `matchesLessonType`**

Add this function to `lib/groupNaming.js`, after the existing `computeGroupName` function (at the end of the file):

```js

export function matchesLessonType(groupName, selectedType) {
  if (!selectedType) return false;
  return groupName === selectedType || groupName.startsWith(`${selectedType} - `);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest lib/groupNaming.test.js`
Expected: PASS — 13 tests passed (8 existing + 5 new)

- [ ] **Step 5: Wire it into the picker**

In `components/AdminTable.jsx`, first add `matchesLessonType` to the existing import from `lib/groupNaming` (currently near the top of the file):

```js
import { LESSON_TYPE_OPTIONS, getLessonTypeValue, computeGroupName } from '../lib/groupNaming';
```

becomes:

```js
import { LESSON_TYPE_OPTIONS, getLessonTypeValue, computeGroupName, matchesLessonType } from '../lib/groupNaming';
```

Then replace this block (currently around line 927-931):

```js
                                const selectedTeacherForGroups = teachers.find(t => t.name === row.teacher);
                                const selectedType = groupTypeFilter[row.id] || '';
                                const matchingGroups = selectedType
                                  ? groups.filter(g => g.teacher_id === selectedTeacherForGroups?.id && g.name === selectedType)
                                  : [];
```

with:

```js
                                const selectedTeacherForGroups = teachers.find(t => t.name === row.teacher);
                                const selectedType = groupTypeFilter[row.id] || '';
                                const matchingGroups = selectedType
                                  ? groups.filter(g => g.teacher_id === selectedTeacherForGroups?.id && matchesLessonType(g.name, selectedType))
                                  : [];
```

(Only the filter predicate's second condition changed — `g.name === selectedType` became `matchesLessonType(g.name, selectedType)`. Everything else in this block, and the rest of the file, is unchanged.)

- [ ] **Step 6: Run the full test suite and build**

Run: `npx jest`
Expected: PASS — all suites green, including the updated `groupNaming.test.js`.

Run: `npx next build`
Expected: `✓ Compiled successfully`, no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/groupNaming.js lib/groupNaming.test.js components/AdminTable.jsx
git commit -m "fix: match individual lessons by type prefix in the existing-lesson picker"
```

---

## Task 2: Manual verification

No live-data browser testing (per team preference). Verified via the automated tests in Task 1 plus a direct re-read.

**Files:** none (verification only).

- [ ] **Step 1: Re-read the wired-in change**

Read the final `matchingGroups` line in `components/AdminTable.jsx` and confirm it calls `matchesLessonType(g.name, selectedType)` — not a reimplementation of the same logic inline.

- [ ] **Step 2: Trace the real-world scenario that motivated this fix**

Using the test data mentally: teacher "אביגיל לויץ", `selectedType = 'פרטני 45 דקות'`, and a group named `'פרטני 45 דקות - אביגיל לויץ טסט'` with `teacher_id` matching that teacher. Confirm `matchesLessonType('פרטני 45 דקות - אביגיל לויץ טסט', 'פרטני 45 דקות')` returns `true` (already covered by a Task 1 test, but re-confirm here that this is the exact scenario reported), so this lesson now appears in `matchingGroups` for that row.
