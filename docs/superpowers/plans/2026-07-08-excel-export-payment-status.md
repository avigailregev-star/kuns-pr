# Excel Export Payment Status Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "תשלום" (payment status) column to the admin panel's Excel export, showing the Hebrew label for `registration_status` (שולם / ממתין / בוטל), reusing the same mapping already used by the on-screen `RegistrationStatusBadge`.

**Architecture:** Extract the existing inline label map from `RegistrationStatusBadge` (in `components/AdminTable.jsx`) into a small exported pure function `paymentStatusLabel` in `lib/excelExport.js` — the module that already holds the other pure, unit-tested helpers for this export (`assignRowColors`, `computeColumnWidths`). `RegistrationStatusBadge` keeps its own CSS-class map (styling is UI-only) but calls the shared function for the label text. `exportToExcel` adds a `תשלום` header/column, positioned right after `סטטוס` and before `מורה`, matching the on-screen column order.

**Tech Stack:** Next.js, React, ExcelJS, Jest.

## Global Constraints

- Payment status values are exactly `Confirmed`, `Pending`, `Cancelled` (any other/missing value falls back to `Pending`'s label, `ממתין`) — per `docs/superpowers/specs/2026-07-08-excel-export-payment-status-design.md`.
- Do not touch the `הערות` (admin_notes) column, the `printTable` function, or any `registration_status` value/flow — out of scope per the spec.
- New column position: immediately after `סטטוס`, immediately before `מורה`.

---

### Task 1: Add `paymentStatusLabel` to `lib/excelExport.js`

**Files:**
- Modify: `lib/excelExport.js`
- Test: `lib/excelExport.test.js`

**Interfaces:**
- Produces: `paymentStatusLabel(status: string | null | undefined): string` — exported named function. Returns `'שולם'` for `'Confirmed'`, `'ממתין'` for `'Pending'`, `'בוטל'` for `'Cancelled'`, and `'ממתין'` for any other value (including `null`/`undefined`/unrecognized strings).

- [ ] **Step 1: Write the failing tests**

Add this `describe` block to the end of `lib/excelExport.test.js` (after the `computeColumnWidths` block, still inside the same file — add the new name to the top `import`):

```js
import { assignRowColors, DAY_COLOR_PALETTE, computeColumnWidths, paymentStatusLabel } from './excelExport';
```

```js
describe('paymentStatusLabel', () => {
  test('maps Confirmed to שולם', () => {
    expect(paymentStatusLabel('Confirmed')).toBe('שולם');
  });

  test('maps Pending to ממתין', () => {
    expect(paymentStatusLabel('Pending')).toBe('ממתין');
  });

  test('maps Cancelled to בוטל', () => {
    expect(paymentStatusLabel('Cancelled')).toBe('בוטל');
  });

  test('falls back to ממתין for null, undefined, or an unrecognized value', () => {
    expect(paymentStatusLabel(null)).toBe('ממתין');
    expect(paymentStatusLabel(undefined)).toBe('ממתין');
    expect(paymentStatusLabel('SomethingElse')).toBe('ממתין');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- lib/excelExport.test.js`
Expected: FAIL — `paymentStatusLabel is not a function` (or `undefined`) on the new `describe('paymentStatusLabel', ...)` block. The pre-existing `assignRowColors`/`computeColumnWidths` tests still pass.

- [ ] **Step 3: Implement `paymentStatusLabel`**

In `lib/excelExport.js`, add this near the top of the file (after the `DAY_COLOR_PALETTE` export, before `dayKey`):

```js
const PAYMENT_STATUS_LABELS = {
  Confirmed: 'שולם',
  Pending: 'ממתין',
  Cancelled: 'בוטל',
};

export function paymentStatusLabel(status) {
  return PAYMENT_STATUS_LABELS[status] || PAYMENT_STATUS_LABELS.Pending;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- lib/excelExport.test.js`
Expected: PASS — all tests in the file, including the four new `paymentStatusLabel` tests.

- [ ] **Step 5: Commit**

```bash
git add lib/excelExport.js lib/excelExport.test.js
git commit -m "feat: add paymentStatusLabel helper for registration payment status"
```

---

### Task 2: Wire the "תשלום" column into the Excel export and reuse the label in the on-screen badge

**Files:**
- Modify: `components/AdminTable.jsx:1-10` (import), `components/AdminTable.jsx:39-61` (`exportToExcel`), `components/AdminTable.jsx:99-107` (`RegistrationStatusBadge`)

**Interfaces:**
- Consumes: `paymentStatusLabel(status)` from Task 1 (`lib/excelExport.js`).

- [ ] **Step 1: Update the import**

In `components/AdminTable.jsx`, change line 10 from:

```js
import { assignRowColors, downloadExcelFile } from '../lib/excelExport';
```

to:

```js
import { assignRowColors, downloadExcelFile, paymentStatusLabel } from '../lib/excelExport';
```

- [ ] **Step 2: Add the column to `exportToExcel`**

Replace the `headers` and `dataRows` definitions (currently lines 40-56) with:

```js
  const headers = ['תאריך', 'תלמיד/ה', 'הורה', 'טלפון', 'אימייל', 'סוג', 'כלים', 'סטטוס', 'תשלום', 'מורה', 'יום', 'שעה', 'הערות'];
  const dataRows = rows.map(r => [
    new Date(r.created_at).toLocaleDateString('he-IL'),
    r.student_name || '',
    r.parent_name || '',
    r.parent_phone || '',
    r.parent_email || '',
    getTypeLabel(r),
    Array.isArray(r.instruments)
      ? (r.instruments.length > 0 ? r.instruments.join('; ') : (r.selected_course || ''))
      : (r.instruments || r.selected_course || ''),
    r.status || '',
    paymentStatusLabel(r.registration_status),
    r.teacher || '',
    r.assigned_day != null && r.assigned_day !== '' ? (DAY_NAMES[Number(r.assigned_day)] ?? r.assigned_day) : '',
    r.assigned_time ? r.assigned_time.slice(0, 5) : '',
    r.admin_notes || '',
  ]);
```

(Only two lines changed: the `headers` array gained `'תשלום'`, and a new `paymentStatusLabel(r.registration_status),` line was inserted between the `r.status || '',` line and the `r.teacher || '',` line.)

- [ ] **Step 3: Reuse the shared label in `RegistrationStatusBadge`**

Replace the current `RegistrationStatusBadge` function (lines 99-107):

```js
function RegistrationStatusBadge({ status }) {
  const map = {
    Confirmed: { label: 'שולם', cls: 'bg-green-100 text-green-800' },
    Pending:   { label: 'ממתין', cls: 'bg-yellow-100 text-yellow-800' },
    Cancelled: { label: 'בוטל', cls: 'bg-gray-100 text-gray-500' },
  };
  const { label, cls } = map[status] || map.Pending;
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}
```

with:

```js
const PAYMENT_STATUS_STYLES = {
  Confirmed: 'bg-green-100 text-green-800',
  Pending:   'bg-yellow-100 text-yellow-800',
  Cancelled: 'bg-gray-100 text-gray-500',
};

function RegistrationStatusBadge({ status }) {
  const cls = PAYMENT_STATUS_STYLES[status] || PAYMENT_STATUS_STYLES.Pending;
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{paymentStatusLabel(status)}</span>;
}
```

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS — no existing test references the old `RegistrationStatusBadge`/`exportToExcel` internals directly, so no other test should break. Confirm the `lib/excelExport.test.js` suite (Task 1) still passes alongside the rest.

- [ ] **Step 5: Manually verify in the browser**

Start the dev server (`npm run dev`), open the admin panel's רישומים tab, click "ייצוא Excel", and open the downloaded file. Confirm:
- A `תשלום` column appears between `סטטוס` and `מורה`.
- Its values read `ממתין` / `שולם` / `בוטל` matching what each row's payment-status badge shows on screen.
- The on-screen badges in the table still render with the same colors/labels as before (no visual regression from the `RegistrationStatusBadge` refactor).

- [ ] **Step 6: Commit**

```bash
git add components/AdminTable.jsx
git commit -m "feat: add payment status column to registrations Excel export"
```
