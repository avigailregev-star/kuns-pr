# Netanel Yahya Per-Course Day Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registration form shows the teacher נתנאל יחיא's correct availability days for the course chosen — Sunday/Thursday for drums, Monday/Tuesday for guitar — instead of his full day list, and his stray Wednesday availability row is removed from the database.

**Architecture:** A new pure helper module (`lib/teacherCourseDayFilter.js`) holds a scoped, hardcoded map from this teacher's two course names to their allowed `day_of_week` values, plus a filter function. `components/RegistrationForm.jsx` calls this helper wherever it reads `teacher_availability_ranges`, so the filtering is a no-op for every other teacher/course. Separately, the stray Wednesday row is deleted directly in Supabase — a one-time data correction, not a code change.

**Tech Stack:** Next.js 14, React, Jest (`testEnvironment: 'node'`, no component-rendering test infra in this repo — see `lib/paymentLinks.test.js` for the existing pure-function test pattern), Supabase (`@supabase/supabase-js`).

## Global Constraints

- Scoped fix only — do not add a general "instrument per availability day" schema/feature. No other teacher's behavior may change.
- No new column on `teacher_availability_ranges`; no schema migration.
- `TEACHER_COURSE_DAY_FILTER` keys must match course names exactly as they appear in `lib/paymentLinks.js` (`"תופים- נתנאל יחיא 45 דק'"`, `"גיטרה- נתנאל יחיא 45 דק'"`).
- Day numbering follows the existing convention already used in `teacher_availability_ranges.day_of_week` and `DAY_NAMES_FULL`/`RANGE_DAY_NAMES` in this codebase: `0`=ראשון (Sunday) ... `4`=חמישי (Thursday), `6`=שבת (Saturday).

---

### Task 1: `lib/teacherCourseDayFilter.js` helper + tests

**Files:**
- Create: `lib/teacherCourseDayFilter.js`
- Test: `lib/teacherCourseDayFilter.test.js`

**Interfaces:**
- Produces: `TEACHER_COURSE_DAY_FILTER` (object, course name → `number[]` of allowed `day_of_week` values), `filterRangesByCourse(ranges, selectedCourse)` — `ranges` is an array of objects with at least a `day_of_week: number` field; `selectedCourse` is a `string | undefined`; returns the same array reference when `selectedCourse` has no entry in the map, otherwise a new filtered array.

- [ ] **Step 1: Write the failing test**

Create `lib/teacherCourseDayFilter.test.js`:

```js
import { filterRangesByCourse, TEACHER_COURSE_DAY_FILTER } from './teacherCourseDayFilter';

describe('filterRangesByCourse', () => {
  const allRanges = [
    { day_of_week: 0, start_time: '14:00', end_time: '20:00' },
    { day_of_week: 1, start_time: '14:00', end_time: '20:00' },
    { day_of_week: 2, start_time: '15:30', end_time: '20:00' },
    { day_of_week: 4, start_time: '14:45', end_time: '20:00' },
  ];

  test('drums course keeps only Sunday (0) and Thursday (4)', () => {
    const result = filterRangesByCourse(allRanges, "תופים- נתנאל יחיא 45 דק'");
    expect(result.map(r => r.day_of_week)).toEqual([0, 4]);
  });

  test('guitar course keeps only Monday (1) and Tuesday (2)', () => {
    const result = filterRangesByCourse(allRanges, "גיטרה- נתנאל יחיא 45 דק'");
    expect(result.map(r => r.day_of_week)).toEqual([1, 2]);
  });

  test('a course with no entry in the map returns the ranges unchanged', () => {
    const result = filterRangesByCourse(allRanges, "פסנתר- מרינה גוטמן 45 דק'");
    expect(result).toBe(allRanges);
  });

  test('undefined selectedCourse returns the ranges unchanged', () => {
    const result = filterRangesByCourse(allRanges, undefined);
    expect(result).toBe(allRanges);
  });

  test('map has exactly the two expected course keys', () => {
    expect(TEACHER_COURSE_DAY_FILTER).toEqual({
      "תופים- נתנאל יחיא 45 דק'": [0, 4],
      "גיטרה- נתנאל יחיא 45 דק'": [1, 2],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/teacherCourseDayFilter.test.js`
Expected: FAIL — `Cannot find module './teacherCourseDayFilter'`

- [ ] **Step 3: Write minimal implementation**

Create `lib/teacherCourseDayFilter.js`:

```js
// נקודתי: נתנאל יחיא מלמד תופים בימים ראשון וחמישי, וגיטרה בימים שני ושלישי.
// המפה הזו מסננת את ימי הזמינות המוצגים לפי הקורס שנבחר, רק עבורו.
export const TEACHER_COURSE_DAY_FILTER = {
  "תופים- נתנאל יחיא 45 דק'": [0, 4],
  "גיטרה- נתנאל יחיא 45 דק'": [1, 2],
};

export function filterRangesByCourse(ranges, selectedCourse) {
  const allowedDays = TEACHER_COURSE_DAY_FILTER[selectedCourse];
  if (!allowedDays) return ranges;
  return ranges.filter((r) => allowedDays.includes(r.day_of_week));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/teacherCourseDayFilter.test.js`
Expected: PASS — 5 tests passed

- [ ] **Step 5: Commit**

```bash
git add lib/teacherCourseDayFilter.js lib/teacherCourseDayFilter.test.js
git commit -m "feat: add per-course day filter helper for נתנאל יחיא"
```

---

### Task 2: Wire the filter into `RegistrationForm.jsx`

**Files:**
- Modify: `components/RegistrationForm.jsx:10` (imports)
- Modify: `components/RegistrationForm.jsx:155` (`selectedTeacherAllFull` computation)
- Modify: `components/RegistrationForm.jsx:625-626` (`availRanges` computation)

**Interfaces:**
- Consumes: `filterRangesByCourse(ranges, selectedCourse)` from Task 1 (`../lib/teacherCourseDayFilter`).

- [ ] **Step 1: Add the import**

In `components/RegistrationForm.jsx`, after the existing `teacherCapacity` import (line 10):

```js
import { freeMinutesOnDay } from '../lib/teacherCapacity';
import { filterRangesByCourse } from '../lib/teacherCourseDayFilter';
```

- [ ] **Step 2: Apply the filter in `selectedTeacherAllFull`**

Find (around line 155):

```js
    const ranges = teacher.teacher_availability_ranges || [];
```

Replace with:

```js
    const ranges = filterRangesByCourse(teacher.teacher_availability_ranges || [], form.selectedCourse);
```

- [ ] **Step 3: Apply the filter in the day-picker's `availRanges`**

Find (around lines 624-626):

```js
                // New system: teacher_availability_ranges
                const availRanges = (teacher?.teacher_availability_ranges || [])
                  .slice().sort((a, b) => a.day_of_week - b.day_of_week);
```

Replace with:

```js
                // New system: teacher_availability_ranges
                const availRanges = filterRangesByCourse(teacher?.teacher_availability_ranges || [], form.selectedCourse)
                  .slice().sort((a, b) => a.day_of_week - b.day_of_week);
```

- [ ] **Step 4: Run the existing test suite to confirm nothing broke**

Run: `npx jest`
Expected: PASS — all existing suites (`lib/paymentLinks.test.js`, `lib/teacherCourseDayFilter.test.js`) still pass.

- [ ] **Step 5: Manual verification in the browser**

Run: `npm run dev`

In the browser, open the registration form and drive it far enough to reach course selection for an existing/new student flow (`type` = `continue` or `new` with `attendedOpenDay = true`):
1. Select course **"תופים- נתנאל יחיא 45 דק'"** → the day-picker under "יום השיעור הקבוע" must show exactly two buttons: יום ראשון and יום חמישי (no שני/שלישי/רביעי).
2. Go back and select course **"גיטרה- נתנאל יחיא 45 דק'"** instead → the day-picker must show exactly יום שני and יום שלישי (no ראשון/חמישי).
3. Select a course taught by a different teacher (e.g. any פסנתר course) → confirm its day-picker is unaffected (still shows that teacher's full set of days, same as before this change).

- [ ] **Step 6: Commit**

```bash
git add components/RegistrationForm.jsx
git commit -m "fix: filter נתנאל יחיא's shown lesson days by selected course"
```

---

### Task 3: Data fix — remove the stray Wednesday row in Supabase

**Files:** None (production data change via Supabase client, no repo file changes)

**Interfaces:** None

- [ ] **Step 1: Re-confirm the exact row to delete**

Run:

```bash
node -e "
const fs = require('fs');
const env = fs.readFileSync('.env.local','utf8');
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
(async () => {
  const { data } = await supabase.from('teachers').select('id, teacher_availability_ranges(*)').eq('name', 'נתנאל יחיא').single();
  console.log(JSON.stringify(data.teacher_availability_ranges, null, 2));
})();
"
```

Expected: 5 rows, one with `day_of_week: 3` (Wednesday) and `id: "4d254bdd-d065-46e7-9856-dcb1566c2d8c"`. If the id differs from a prior check (e.g. the row was already edited), use the id returned here, not the one from this plan.

- [ ] **Step 2: Delete the Wednesday row**

Run (substitute the id confirmed in Step 1 if it changed):

```bash
node -e "
const fs = require('fs');
const env = fs.readFileSync('.env.local','utf8');
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
(async () => {
  const { error } = await supabase.from('teacher_availability_ranges').delete().eq('id', '4d254bdd-d065-46e7-9856-dcb1566c2d8c');
  console.log(error ? 'ERROR: ' + error.message : 'deleted');
})();
"
```

Expected: `deleted`

- [ ] **Step 3: Verify final state**

Re-run the query from Step 1.
Expected: 4 rows remaining, with `day_of_week` values `[0, 1, 2, 4]` (ראשון, שני, שלישי, חמישי) and no `day_of_week: 3`.

---

## Self-Review Notes

- Spec coverage: Part 1 (data fix) → Task 3. Part 2 (code fix, both call sites) → Task 2, Steps 2–3. Out-of-scope items (schema change, other teachers, melodies flow) are untouched by all three tasks.
- No placeholders: every step has literal code/commands and expected output.
- Type consistency: `filterRangesByCourse(ranges, selectedCourse)` signature and `TEACHER_COURSE_DAY_FILTER` name are identical across Task 1's implementation and Task 2's usage.
