# Netanel Yahya Melodies Day-Filter Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the day-picker in the registration form show the correct availability days for נתנאל יחיא across ALL of his courses, including the 6 מנגינות (melodies) course variants that today show all 4 of his days regardless of instrument.

**Architecture:** Replace the exact-string-match lookup in `lib/teacherCourseDayFilter.js` with keyword matching scoped to course names containing "נתנאל יחיא": "גיטרה" → Monday+Tuesday, any of "תופים"/"דג'מבה"/"כלי הקשה" → Sunday+Thursday. Any other teacher's course name is returned unchanged, exactly as before.

**Tech Stack:** Next.js 14, React 18, Jest 30 for unit tests.

## Global Constraints

- `filterRangesByCourse(ranges, selectedCourse)` must keep its exact existing signature — it's called from `components/RegistrationForm.jsx:156` and `components/RegistrationForm.jsx:626` and those call sites are NOT changed by this plan.
- Day-of-week values: Sunday=0, Monday=1, Tuesday=2, Wednesday=3, Thursday=4 (matches existing `day_of_week` values in `teacher_availability_ranges`).
- Guitar days: `[1, 2]` (Monday, Tuesday). Drums/djembe/percussion days: `[0, 4]` (Sunday, Thursday). These values are unchanged from the prior design — only the matching logic that selects between them changes.
- No changes to Supabase data, to `components/RegistrationForm.jsx`, or to how נתנאל יחיא is offered as a teacher option in the melodies flow — this plan only touches `lib/teacherCourseDayFilter.js` and its test file.

---

### Task 1: Keyword-based day filtering in `filterRangesByCourse`

**Files:**
- Modify: `lib/teacherCourseDayFilter.js` (currently 13 lines, full file replaced)
- Modify: `lib/teacherCourseDayFilter.test.js` (currently 38 lines, full file replaced)

**Interfaces:**
- Produces: `filterRangesByCourse(ranges, selectedCourse)` — `ranges` is an array of objects with at least `day_of_week: number`; `selectedCourse` is `string | undefined`. Returns the same array reference unchanged when `selectedCourse` is falsy, doesn't contain "נתנאל יחיא", or contains none of the recognized instrument keywords. Otherwise returns a new array filtered to the matching instrument's allowed days.
- No exported constant replaces the old `TEACHER_COURSE_DAY_FILTER` map — callers only ever used the function, not the map, so nothing else needs to change.

- [ ] **Step 1: Update the test file with melodies cases (failing tests first)**

Replace the full contents of `lib/teacherCourseDayFilter.test.js`:

```js
import { filterRangesByCourse } from './teacherCourseDayFilter';

describe('filterRangesByCourse', () => {
  const allRanges = [
    { day_of_week: 0, start_time: '14:00', end_time: '20:00' },
    { day_of_week: 1, start_time: '14:00', end_time: '20:00' },
    { day_of_week: 2, start_time: '15:30', end_time: '20:00' },
    { day_of_week: 4, start_time: '14:45', end_time: '20:00' },
  ];

  test('regular drums course keeps only Sunday (0) and Thursday (4)', () => {
    const result = filterRangesByCourse(allRanges, "תופים- נתנאל יחיא 45 דק'");
    expect(result.map(r => r.day_of_week)).toEqual([0, 4]);
  });

  test('regular guitar course keeps only Monday (1) and Tuesday (2)', () => {
    const result = filterRangesByCourse(allRanges, "גיטרה- נתנאל יחיא 45 דק'");
    expect(result.map(r => r.day_of_week)).toEqual([1, 2]);
  });

  test('melodies guitar course keeps only Monday (1) and Tuesday (2)', () => {
    const result = filterRangesByCourse(allRanges, "מנגינות שנה ב' - גיטרה- נתנאל יחיא");
    expect(result.map(r => r.day_of_week)).toEqual([1, 2]);
  });

  test('melodies djembe course keeps only Sunday (0) and Thursday (4)', () => {
    const result = filterRangesByCourse(allRanges, "מנגינות שנה ג' - דג'מבה- נתנאל יחיא");
    expect(result.map(r => r.day_of_week)).toEqual([0, 4]);
  });

  test('melodies djembe-and-percussion course keeps only Sunday (0) and Thursday (4)', () => {
    const result = filterRangesByCourse(allRanges, "מנגינות שנה ד' - דג'מבה וכלי הקשה- נתנאל יחיא");
    expect(result.map(r => r.day_of_week)).toEqual([0, 4]);
  });

  test('a course for a different teacher returns the ranges unchanged', () => {
    const result = filterRangesByCourse(allRanges, "פסנתר- מרינה גוטמן 45 דק'");
    expect(result).toBe(allRanges);
  });

  test('undefined selectedCourse returns the ranges unchanged', () => {
    const result = filterRangesByCourse(allRanges, undefined);
    expect(result).toBe(allRanges);
  });
});
```

- [ ] **Step 2: Run tests to verify the new melodies cases fail**

Run: `npx jest lib/teacherCourseDayFilter.test.js`

Expected: The three new "melodies" tests FAIL (the current implementation returns `allRanges` unchanged for any melodies course name, so `result.map(r => r.day_of_week)` is `[0, 1, 2, 4]`, not `[1, 2]` or `[0, 4]`). The four pre-existing cases (regular drums, regular guitar, different teacher, undefined) still PASS.

- [ ] **Step 3: Replace the implementation with keyword matching**

Replace the full contents of `lib/teacherCourseDayFilter.js`:

```js
const NETANEL_YAHYA_GUITAR_DAYS = [1, 2]; // שני, שלישי
const NETANEL_YAHYA_DRUMS_DAYS = [0, 4]; // ראשון, חמישי

export function filterRangesByCourse(ranges, selectedCourse) {
  if (!selectedCourse || !selectedCourse.includes('נתנאל יחיא')) return ranges;

  let allowedDays;
  if (selectedCourse.includes('גיטרה')) {
    allowedDays = NETANEL_YAHYA_GUITAR_DAYS;
  } else if (
    selectedCourse.includes('תופים') ||
    selectedCourse.includes("דג'מבה") ||
    selectedCourse.includes('כלי הקשה')
  ) {
    allowedDays = NETANEL_YAHYA_DRUMS_DAYS;
  }

  if (!allowedDays) return ranges;
  return ranges.filter((r) => allowedDays.includes(r.day_of_week));
}
```

- [ ] **Step 4: Run tests to verify everything passes**

Run: `npx jest lib/teacherCourseDayFilter.test.js`

Expected: All 7 tests PASS.

- [ ] **Step 5: Run the full test suite to check for unrelated regressions**

Run: `npx jest`

Expected: All suites PASS (no other file imports `TEACHER_COURSE_DAY_FILTER`, confirmed by repo-wide search before writing this plan).

- [ ] **Step 6: Commit**

```bash
git add lib/teacherCourseDayFilter.js lib/teacherCourseDayFilter.test.js
git commit -m "fix: filter נתנאל יחיא's melodies course days by instrument keyword"
```

---

## Self-Review Notes

- **Spec coverage:** The design's single code change (keyword matching in `filterRangesByCourse`) and single test change are both covered by Task 1. No other files need changes per the design's "Out of Scope" section.
- **Placeholder scan:** None — all code blocks are complete and copy-pasteable.
- **Type consistency:** `filterRangesByCourse(ranges, selectedCourse)` signature is identical to the current one in `components/RegistrationForm.jsx:156` and `:626`, so no caller changes are needed.
