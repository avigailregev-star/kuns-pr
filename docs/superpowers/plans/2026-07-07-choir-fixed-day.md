# Choir Fixed Day Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make choir courses ("מקהלת צעירים ב-ו" and "הזמיר") show a fixed day+time instead of a day-picker, in both the public registration form and the admin assignment table, and remove a stray non-existent choir label from the internal lesson-type list.

**Architecture:** A new shared `lib/fixedCourseDays.js` module holds the course→day map plus a pure filter helper, replacing the module-local copy that today only lives in `components/RegistrationForm.jsx`. Both `RegistrationForm.jsx` (public registration) and `components/AdminTable.jsx` (admin manual assignment) import from it. This mirrors the existing `lib/teacherCourseDayFilter.js` pattern used for the Netanel Yahya per-course day filter.

**Tech Stack:** Next.js, React (JSX components), Jest for unit tests.

## Global Constraints

- `day_of_week` convention across the codebase: 0=ראשון, 1=שני, 2=שלישי, 3=רביעי, 4=חמישי, 5=שישי, 6=שבת.
- Fixed days: "מקהלת צעירים ב-ו" → 3 (רביעי, already existing behavior — must not regress). "הזמיר" → 1 (שני, new).
- Hours shown next to the fixed day must come from the teacher's real `teacher_availability_ranges` entry for that day, not a hardcoded string — so they never drift out of sync with the teacher's actual profile.
- "מקהלת קולות הנגב" is out of scope — do not add it anywhere in this plan.

---

### Task 1: Create the shared fixed-day module

**Files:**
- Create: `lib/fixedCourseDays.js`
- Test: `lib/fixedCourseDays.test.js`

**Interfaces:**
- Produces: `FIXED_COURSE_DAYS` (object, course name string → `day_of_week` integer), `filterRangesToFixedDay(ranges, selectedCourse)` (function, returns filtered array of range objects `{ day_of_week, start_time, end_time, ... }`, unchanged reference if course has no fixed day).

- [ ] **Step 1: Write the failing test**

Create `lib/fixedCourseDays.test.js`:

```js
import { FIXED_COURSE_DAYS, filterRangesToFixedDay } from './fixedCourseDays';

describe('FIXED_COURSE_DAYS', () => {
  test('מקהלת צעירים ב-ו is fixed to Wednesday (3)', () => {
    expect(FIXED_COURSE_DAYS['מקהלת צעירים ב-ו']).toBe(3);
  });

  test('הזמיר is fixed to Monday (1)', () => {
    expect(FIXED_COURSE_DAYS['הזמיר']).toBe(1);
  });
});

describe('filterRangesToFixedDay', () => {
  const allRanges = [
    { day_of_week: 0, start_time: '14:00', end_time: '20:00' },
    { day_of_week: 1, start_time: '17:00', end_time: '19:00' },
    { day_of_week: 3, start_time: '17:00', end_time: '18:30' },
  ];

  test('הזמיר keeps only the Monday (1) range', () => {
    const result = filterRangesToFixedDay(allRanges, 'הזמיר');
    expect(result).toEqual([{ day_of_week: 1, start_time: '17:00', end_time: '19:00' }]);
  });

  test('מקהלת צעירים ב-ו keeps only the Wednesday (3) range', () => {
    const result = filterRangesToFixedDay(allRanges, 'מקהלת צעירים ב-ו');
    expect(result).toEqual([{ day_of_week: 3, start_time: '17:00', end_time: '18:30' }]);
  });

  test('a course with no fixed day returns the ranges unchanged', () => {
    const result = filterRangesToFixedDay(allRanges, "כינור- אביגיל לויץ 45 דק'");
    expect(result).toBe(allRanges);
  });

  test('undefined selectedCourse returns the ranges unchanged', () => {
    const result = filterRangesToFixedDay(allRanges, undefined);
    expect(result).toBe(allRanges);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/fixedCourseDays.test.js`
Expected: FAIL — `Cannot find module './fixedCourseDays'`

- [ ] **Step 3: Write minimal implementation**

Create `lib/fixedCourseDays.js`:

```js
export const FIXED_COURSE_DAYS = {
  "מקהלת צעירים ב-ו": 3, // יום רביעי
  "הזמיר": 1,             // יום שני
};

export function filterRangesToFixedDay(ranges, selectedCourse) {
  const fixedDay = FIXED_COURSE_DAYS[selectedCourse];
  if (fixedDay == null) return ranges;
  return ranges.filter((r) => r.day_of_week === fixedDay);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/fixedCourseDays.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/fixedCourseDays.js lib/fixedCourseDays.test.js
git commit -m "feat: add shared fixed-course-day map for choirs"
```

---

### Task 2: Use the shared module in the registration form, and show the real hours

**Files:**
- Modify: `components/RegistrationForm.jsx:8,15-17,630-637`

**Interfaces:**
- Consumes: `FIXED_COURSE_DAYS` from `lib/fixedCourseDays.js` (Task 1).

- [ ] **Step 1: Replace the local map with the shared import**

In `components/RegistrationForm.jsx`, change the import block at the top (line 8) from:

```js
import { getPaymentLink, getCurrentPriceInfo, COURSE_GROUPS, PAYMENT_LINKS } from '../lib/paymentLinks';
```

to:

```js
import { getPaymentLink, getCurrentPriceInfo, COURSE_GROUPS, PAYMENT_LINKS } from '../lib/paymentLinks';
import { FIXED_COURSE_DAYS } from '../lib/fixedCourseDays';
```

Then delete the local map at lines 15-17:

```js
const FIXED_COURSE_DAYS = {
  "מקהלת צעירים ב-ו": 3, // יום רביעי
};
```

(Just remove these three lines — the `import` added above now provides `FIXED_COURSE_DAYS`, and every existing reference to `FIXED_COURSE_DAYS[form.selectedCourse]` in this file keeps working unchanged.)

- [ ] **Step 2: Show the real start/end time next to the fixed day**

Find this block (around line 630-637):

```js
                if (availRanges.length > 0) {
                  const fixedDay = FIXED_COURSE_DAYS[form.selectedCourse];
                  return (
                    <div className="space-y-3 pt-2 border-t border-white/10">
                      <label className="field-label">יום השיעור הקבוע</label>
                      {fixedDay != null ? (
                        <div className="p-3 rounded-xl border border-purple-400/40 bg-purple-500/10 text-center">
                          <span className="text-sm text-white font-semibold">יום {DAY_NAMES_FULL[fixedDay]}</span>
                        </div>
                      ) : (
```

Replace it with:

```js
                if (availRanges.length > 0) {
                  const fixedDay = FIXED_COURSE_DAYS[form.selectedCourse];
                  const fixedRange = fixedDay != null ? availRanges.find(r => r.day_of_week === fixedDay) : null;
                  return (
                    <div className="space-y-3 pt-2 border-t border-white/10">
                      <label className="field-label">יום השיעור הקבוע</label>
                      {fixedDay != null ? (
                        <div className="p-3 rounded-xl border border-purple-400/40 bg-purple-500/10 text-center">
                          <span className="text-sm text-white font-semibold">
                            יום {DAY_NAMES_FULL[fixedDay]}
                            {fixedRange?.start_time && (
                              <> · {fixedRange.start_time.slice(0, 5)}{fixedRange.end_time ? `–${fixedRange.end_time.slice(0, 5)}` : ''}</>
                            )}
                          </span>
                        </div>
                      ) : (
```

Leave everything after this (the `)}` closing the ternary, and the rest of the function) untouched.

- [ ] **Step 3: Run the existing lib test suite to confirm nothing else broke**

Run: `npx jest lib/`
Expected: PASS (no test targets `RegistrationForm.jsx` directly — this step is a regression guard on the modules it imports)

- [ ] **Step 4: Commit**

```bash
git add components/RegistrationForm.jsx
git commit -m "feat: use shared fixed-course-day map and show real hours in registration form"
```

---

### Task 3: Collapse the admin assignment picker to the fixed day for choirs

**Files:**
- Modify: `components/AdminTable.jsx:8,668-670`

**Interfaces:**
- Consumes: `filterRangesToFixedDay` from `lib/fixedCourseDays.js` (Task 1).

- [ ] **Step 1: Add the import**

In `components/AdminTable.jsx`, change line 8 from:

```js
import { LESSON_TYPE_OPTIONS, getLessonTypeValue, computeGroupName, matchesLessonType } from '../lib/groupNaming';
```

to:

```js
import { LESSON_TYPE_OPTIONS, getLessonTypeValue, computeGroupName, matchesLessonType } from '../lib/groupNaming';
import { filterRangesToFixedDay } from '../lib/fixedCourseDays';
```

- [ ] **Step 2: Filter the availability ranges before they're rendered as day buttons**

Find this block (around line 667-670):

```js
                                // Days from attendance app via teacher_availability_ranges
                                const availRanges = (selectedTeacher?.teacher_availability_ranges || [])
                                  .slice()
                                  .sort((a, b) => a.day_of_week - b.day_of_week);
```

Replace it with:

```js
                                // Days from attendance app via teacher_availability_ranges
                                const availRanges = filterRangesToFixedDay(
                                  (selectedTeacher?.teacher_availability_ranges || [])
                                    .slice()
                                    .sort((a, b) => a.day_of_week - b.day_of_week),
                                  row.selected_course
                                );
```

Everything below this (capacity calculation, button rendering) reads `availRanges` and needs no further changes — for a fixed-day course it now receives an array with just the one matching entry, so exactly one day button renders, with its real hours and fullness state computed exactly as before.

- [ ] **Step 3: Run the lib test suite as a regression guard**

Run: `npx jest lib/`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/AdminTable.jsx
git commit -m "feat: collapse admin day picker to the fixed day for choir courses"
```

---

### Task 4: Remove the stray "מקהלה צעירה ייצוגית" label

**Files:**
- Modify: `lib/groupNaming.js:10`
- Modify: `lib/groupNaming.test.js:4-23,32-37`

- [ ] **Step 1: Update the test file first (TDD — this test should fail against the current code)**

In `lib/groupNaming.test.js`, replace the `LESSON_TYPE_OPTIONS` describe block (lines 3-24):

```js
describe('LESSON_TYPE_OPTIONS', () => {
  test('has exactly 16 options in the required order', () => {
    expect(LESSON_TYPE_OPTIONS.map(o => o.label)).toEqual([
      'פרטני 45 דקות',
      'פרטני 60 דקות',
      'שיעור זוגי אליטה',
      'מנגינות שנה ב',
      'מנגינות שנה ג',
      'מנגינות שנה ד',
      'תיאוריה',
      'מקהלה צעירה',
      'מקהלה צעירה ייצוגית',
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

with:

```js
describe('LESSON_TYPE_OPTIONS', () => {
  test('has exactly 15 options in the required order', () => {
    expect(LESSON_TYPE_OPTIONS.map(o => o.label)).toEqual([
      'פרטני 45 דקות',
      'פרטני 60 דקות',
      'שיעור זוגי אליטה',
      'מנגינות שנה ב',
      'מנגינות שנה ג',
      'מנגינות שנה ד',
      'תיאוריה',
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

Then replace the choir mapping test (lines 32-37):

```js
  test('maps all four choir groups to the same "choir" value', () => {
    expect(getLessonTypeValue('מקהלה צעירה')).toBe('choir');
    expect(getLessonTypeValue('מקהלה צעירה ייצוגית')).toBe('choir');
    expect(getLessonTypeValue('הזמיר- מקהלה ייצוגית')).toBe('choir');
    expect(getLessonTypeValue('מקהלת קולות הנגב')).toBe('choir');
  });
```

with:

```js
  test('maps all three choir groups to the same "choir" value', () => {
    expect(getLessonTypeValue('מקהלה צעירה')).toBe('choir');
    expect(getLessonTypeValue('הזמיר- מקהלה ייצוגית')).toBe('choir');
    expect(getLessonTypeValue('מקהלת קולות הנגב')).toBe('choir');
  });
```

Leave the rest of the file (including the `matchesLessonType` prefix-collision test at line 94-98) untouched — it tests the string-matching function in isolation and doesn't assert anything about `LESSON_TYPE_OPTIONS` membership.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest lib/groupNaming.test.js`
Expected: FAIL — the "has exactly 15 options" test fails because the source still has 16 entries including `'מקהלה צעירה ייצוגית'`.

- [ ] **Step 3: Remove the entry from the source file**

In `lib/groupNaming.js`, delete line 10:

```js
  { label: 'מקהלה צעירה ייצוגית', value: 'choir' },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest lib/groupNaming.test.js`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add lib/groupNaming.js lib/groupNaming.test.js
git commit -m "fix: remove stray non-existent 'מקהלה צעירה ייצוגית' lesson-type label"
```

---

### Task 5: Full regression check

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx jest`
Expected: PASS, all suites green (including `lib/fixedCourseDays.test.js`, `lib/groupNaming.test.js`, `lib/teacherCourseDayFilter.test.js`, `lib/paymentLinks.test.js`, and the others already in the repo).

- [ ] **Step 2: Manually verify in the dev server**

Run: `npm run dev`, open the registration form, select "קבוצות והרכבים" → "הזמיר" and a teacher who has a Monday range in `teacher_availability_ranges`. Confirm the box shows "יום שני · <start>–<end>" with no clickable day buttons. Repeat for "מקהלת צעירים ב-ו" and confirm it still shows "יום רביעי · <start>–<end>". Then open the admin table, find a registration for either course, and confirm the day-assignment picker shows only the one matching day button instead of the teacher's full availability list.
