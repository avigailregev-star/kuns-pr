# Registrations Search Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add filter dropdowns for instrument, teacher, and payment status to the registrations table in the admin panel, and fix the existing status dropdown to show all 6 status values.

**Architecture:** Extract the row-matching predicate that currently lives inline inside `AdminTable.jsx` into a pure, unit-tested function in `lib/registrationFilters.js`. Export the two option lists (`STATUS_OPTIONS`, `INSTRUMENTS`) that already exist as private constants in `StatusSelect.jsx` and `InstrumentPicker.jsx` so `AdminTable.jsx` can reuse them instead of duplicating option lists. Wire three new `<select>` filters into the existing filter row in `AdminTable.jsx`, backed by new `useState` values.

**Tech Stack:** Next.js (React, client components), Jest (`testEnvironment: 'node'`) for pure-function tests in `lib/`.

**Design doc:** `docs/superpowers/specs/2026-07-14-registrations-search-filters-design.md`

## Global Constraints

- Payment status values are exactly `Confirmed` / `Pending` / `Cancelled` (matches `lib/excelExport.js` `PAYMENT_STATUS_LABELS`). A missing/falsy `registration_status` must be treated as `'Pending'` for filtering, matching how the existing badge renders it.
- Status values are exactly the 6 strings already defined in `StatusSelect.jsx`: `['חדש', 'בבדיקה', 'שובץ', 'נדחה', 'רשימת המתנה', 'ממתין לשיחת היכרות']`. Do not invent new status strings.
- Instrument filter values must be the internal codes from `InstrumentPicker.jsx` (e.g. `'piano'`), matched against `row.instruments` (an array of these same codes) — not against `row.selected_course` (free text, out of scope per design doc).
- All filters combine with AND logic (a row must satisfy every active filter), consistent with the existing `matchSearch && matchStatus` behavior.
- Do not change the table's "כלים" column rendering (`AdminTable.jsx` lines ~540-543) — that's explicitly out of scope per the design doc.

---

### Task 1: Export existing option lists (no new logic)

**Files:**
- Modify: `components/StatusSelect.jsx:3`
- Modify: `components/InstrumentPicker.jsx:3-54`

**Interfaces:**
- Produces: `export const STATUS_OPTIONS` (array of 6 Hebrew strings) from `components/StatusSelect.jsx`.
- Produces: `export const INSTRUMENTS` (array of `{ value, label, img }`) from `components/InstrumentPicker.jsx`.

These constants already exist as unexported `const`s. This task only adds the `export` keyword — no behavior change, so no test is needed (verified by the existing app still building/running, checked in Task 3's manual verification).

- [ ] **Step 1: Export `STATUS_OPTIONS` from StatusSelect.jsx**

In `components/StatusSelect.jsx`, change line 3 from:
```js
const STATUS_OPTIONS = ['חדש', 'בבדיקה', 'שובץ', 'נדחה', 'רשימת המתנה', 'ממתין לשיחת היכרות'];
```
to:
```js
export const STATUS_OPTIONS = ['חדש', 'בבדיקה', 'שובץ', 'נדחה', 'רשימת המתנה', 'ממתין לשיחת היכרות'];
```

- [ ] **Step 2: Export `INSTRUMENTS` from InstrumentPicker.jsx**

In `components/InstrumentPicker.jsx`, change line 3 from:
```js
const INSTRUMENTS = [
```
to:
```js
export const INSTRUMENTS = [
```

- [ ] **Step 3: Verify nothing else broke**

Run: `npm run build`
Expected: build succeeds with no errors (exporting a previously-private const doesn't change any existing import, so this should be a no-op for the build).

- [ ] **Step 4: Commit**

```bash
git add components/StatusSelect.jsx components/InstrumentPicker.jsx
git commit -m "refactor: export STATUS_OPTIONS and INSTRUMENTS for reuse in filters"
```

---

### Task 2: Pure filter-matching function with tests

**Files:**
- Create: `lib/registrationFilters.js`
- Test: `lib/registrationFilters.test.js`

**Interfaces:**
- Consumes: nothing (pure function, no imports from other project files).
- Produces: `export function filterRegistrations(rows, filters)` where:
  - `rows` is an array of registration row objects (`{ student_name, parent_name, parent_phone, status, instruments, teacher, registration_status, ... }`).
  - `filters` is `{ search, status, instrument, teacher, payment }` — all optional strings; `''` or `undefined` means "no filter for this field".
  - Returns: the filtered array of rows (new array, same row objects — no mutation).

- [ ] **Step 1: Write the failing tests**

Create `lib/registrationFilters.test.js`:
```js
import { filterRegistrations } from './registrationFilters';

const baseRows = [
  {
    id: 1,
    student_name: 'דני כהן',
    parent_name: 'רותי כהן',
    parent_phone: '0501112222',
    status: 'חדש',
    instruments: ['piano'],
    teacher: 'משה לוי',
    registration_status: 'Confirmed',
  },
  {
    id: 2,
    student_name: 'יעל מזרחי',
    parent_name: 'אבי מזרחי',
    parent_phone: '0503334444',
    status: 'שובץ',
    instruments: ['guitar', 'violin'],
    teacher: 'שרה כהן',
    registration_status: 'Cancelled',
  },
  {
    id: 3,
    student_name: 'נועה לוי',
    parent_name: 'דוד לוי',
    parent_phone: '0505556666',
    status: 'שובץ',
    instruments: ['piano'],
    teacher: 'משה לוי',
    registration_status: null,
  },
];

describe('filterRegistrations', () => {
  test('returns all rows when no filters are set', () => {
    const result = filterRegistrations(baseRows, {});
    expect(result).toHaveLength(3);
  });

  test('filters by free-text search across student, parent name, and phone', () => {
    expect(filterRegistrations(baseRows, { search: 'דני' })).toEqual([baseRows[0]]);
    expect(filterRegistrations(baseRows, { search: 'אבי' })).toEqual([baseRows[1]]);
    expect(filterRegistrations(baseRows, { search: '0505556666' })).toEqual([baseRows[2]]);
  });

  test('filters by status', () => {
    const result = filterRegistrations(baseRows, { status: 'שובץ' });
    expect(result.map((r) => r.id)).toEqual([2, 3]);
  });

  test('filters by instrument code, checking the instruments array', () => {
    const result = filterRegistrations(baseRows, { instrument: 'piano' });
    expect(result.map((r) => r.id)).toEqual([1, 3]);
  });

  test('filters by teacher exact match', () => {
    const result = filterRegistrations(baseRows, { teacher: 'משה לוי' });
    expect(result.map((r) => r.id)).toEqual([1, 3]);
  });

  test('filters by payment status, treating missing registration_status as Pending', () => {
    expect(filterRegistrations(baseRows, { payment: 'Confirmed' }).map((r) => r.id)).toEqual([1]);
    expect(filterRegistrations(baseRows, { payment: 'Cancelled' }).map((r) => r.id)).toEqual([2]);
    expect(filterRegistrations(baseRows, { payment: 'Pending' }).map((r) => r.id)).toEqual([3]);
  });

  test('combines multiple filters with AND logic', () => {
    const result = filterRegistrations(baseRows, { status: 'שובץ', instrument: 'piano' });
    expect(result.map((r) => r.id)).toEqual([3]);
  });

  test('returns empty array when no row matches all filters', () => {
    const result = filterRegistrations(baseRows, { status: 'חדש', teacher: 'שרה כהן' });
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest lib/registrationFilters.test.js`
Expected: FAIL — `Cannot find module './registrationFilters'` (file doesn't exist yet).

- [ ] **Step 3: Implement `filterRegistrations`**

Create `lib/registrationFilters.js`:
```js
export function filterRegistrations(rows, filters) {
  const { search, status, instrument, teacher, payment } = filters || {};

  return rows.filter((row) => {
    const matchSearch =
      !search ||
      row.student_name?.includes(search) ||
      row.parent_name?.includes(search) ||
      row.parent_phone?.includes(search);
    const matchStatus = !status || row.status === status;
    const matchInstrument = !instrument || row.instruments?.includes(instrument);
    const matchTeacher = !teacher || row.teacher === teacher;
    const matchPayment = !payment || (row.registration_status || 'Pending') === payment;

    return matchSearch && matchStatus && matchInstrument && matchTeacher && matchPayment;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest lib/registrationFilters.test.js`
Expected: PASS — all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/registrationFilters.js lib/registrationFilters.test.js
git commit -m "feat: add pure filterRegistrations function with tests"
```

---

### Task 3: Wire filters into AdminTable UI

**Files:**
- Modify: `components/AdminTable.jsx:1-16` (imports)
- Modify: `components/AdminTable.jsx:128-144` (state)
- Modify: `components/AdminTable.jsx:408-416` (filtering logic)
- Modify: `components/AdminTable.jsx:443-468` (filter row UI)

**Interfaces:**
- Consumes: `filterRegistrations(rows, filters)` from Task 2 (`lib/registrationFilters.js`), `STATUS_OPTIONS` from `./StatusSelect`, `INSTRUMENTS` from `./InstrumentPicker`, `paymentStatusLabel` (already imported at line 10 from `../lib/excelExport`).
- Produces: nothing new consumed elsewhere — this is the top-level UI wiring.

- [ ] **Step 1: Update imports**

In `components/AdminTable.jsx`, change line 3-4 from:
```js
import React, { useState, useEffect, useCallback } from 'react';
import StatusSelect from './StatusSelect';
```
to:
```js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import StatusSelect, { STATUS_OPTIONS } from './StatusSelect';
import { INSTRUMENTS } from './InstrumentPicker';
```
And add this import alongside the existing `lib` imports (near line 10):
```js
import { filterRegistrations } from '../lib/registrationFilters';
```

- [ ] **Step 2: Add new filter state**

In `components/AdminTable.jsx`, right after line 134 (`const [filterStatus, setFilterStatus] = useState('');`), add:
```js
  const [filterInstrument, setFilterInstrument] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
```

- [ ] **Step 3: Add a derived, sorted, de-duplicated teacher name list**

In `components/AdminTable.jsx`, between the `useEffect` that calls `fetchData` (lines 203-205) and `async function refreshTeachers()` (line 207), insert a `useMemo` that derives teacher names from the loaded `teachers` state (used for the dropdown; independent of which teachers are assigned in `rows`):
```js
  const teacherNames = useMemo(
    () => Array.from(new Set(teachers.map((t) => t.name).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'he')),
    [teachers]
  );
```

- [ ] **Step 4: Replace the inline `filtered` computation with the new pure function**

Replace lines 408-416:
```js
  const filtered = rows.filter((r) => {
    const matchSearch =
      !search ||
      r.student_name?.includes(search) ||
      r.parent_name?.includes(search) ||
      r.parent_phone?.includes(search);
    const matchStatus = !filterStatus || r.status === filterStatus;
    return matchSearch && matchStatus;
  });
```
with:
```js
  const filtered = filterRegistrations(rows, {
    search,
    status: filterStatus,
    instrument: filterInstrument,
    teacher: filterTeacher,
    payment: filterPayment,
  });
```

- [ ] **Step 5: Fix the status dropdown to show all 6 options, and add the 3 new dropdowns**

Replace lines 452-462:
```js
        <select
          className="form-input sm:w-40"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">כל הסטטוסים</option>
          <option value="חדש">חדש</option>
          <option value="בבדיקה">בבדיקה</option>
          <option value="שובץ">שובץ</option>
          <option value="נדחה">נדחה</option>
        </select>
```
with:
```js
        <select
          className="form-input sm:w-40"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">כל הסטטוסים</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          className="form-input sm:w-40"
          value={filterInstrument}
          onChange={(e) => setFilterInstrument(e.target.value)}
        >
          <option value="">כל הכלים</option>
          {INSTRUMENTS.map((inst) => (
            <option key={inst.value} value={inst.value}>{inst.label}</option>
          ))}
        </select>
        <select
          className="form-input sm:w-40"
          value={filterTeacher}
          onChange={(e) => setFilterTeacher(e.target.value)}
        >
          <option value="">כל המורים</option>
          {teacherNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <select
          className="form-input sm:w-40"
          value={filterPayment}
          onChange={(e) => setFilterPayment(e.target.value)}
        >
          <option value="">כל התשלומים</option>
          <option value="Confirmed">{paymentStatusLabel('Confirmed')}</option>
          <option value="Pending">{paymentStatusLabel('Pending')}</option>
          <option value="Cancelled">{paymentStatusLabel('Cancelled')}</option>
        </select>
```

- [ ] **Step 6: Run the full test suite**

Run: `npx jest`
Expected: PASS — no existing test touches `AdminTable.jsx` (it's a component, not covered by the `testEnvironment: 'node'` Jest setup), so this confirms Task 2's tests still pass and nothing else regressed.

- [ ] **Step 7: Manually verify in the browser**

Run: `npm run dev`, open the admin panel page that renders `AdminTable`.
Check:
- The filter row now shows: search box, status dropdown (6 options), instrument dropdown, teacher dropdown, payment dropdown, refresh button — wrapping onto multiple lines on a narrow/mobile viewport.
- Picking an instrument shows only rows whose `instruments` array contains that instrument.
- Picking a teacher shows only rows with that exact `teacher` value.
- Picking a payment status shows the right rows, including rows with no `registration_status` showing up under "ממתין".
- Combining two filters (e.g. status + teacher) narrows results further (AND, not OR).
- Selecting "כל ה..." (empty value) on any dropdown clears that filter and restores the other rows.

Stop the dev server after verifying.

- [ ] **Step 8: Commit**

```bash
git add components/AdminTable.jsx
git commit -m "feat: add instrument, teacher, and payment filters to registrations table"
```

---

## Self-Review Notes

- **Spec coverage:** design doc's 3 new filters (Task 3), status dropdown completion (Task 3 Step 5), single-source-of-truth exports (Task 1), AND-combination behavior and missing-payment-as-Pending behavior (Task 2, tested) — all covered.
- **Out of scope confirmed not touched:** the "כלים" table column rendering (lines ~540-543) is not modified by any task.
- **Type/signature consistency:** `filterRegistrations(rows, filters)` signature defined in Task 2 is used identically in Task 3 Step 4. `STATUS_OPTIONS` and `INSTRUMENTS` export names match between Task 1 and Task 3 imports.
