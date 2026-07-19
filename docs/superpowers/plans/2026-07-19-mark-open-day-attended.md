# Mark Open-Day Attended Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin mark that a student's intro call ("שיחת היכרות") happened, by clicking the "טרם שיחת היכרות" badge in AdminTable, which clears `attended_open_day` and removes the badge.

**Architecture:** Extend the existing generic `PATCH /api/registrations` handler to accept `attended_open_day`, then turn the badge span in `components/AdminTable.jsx` into a button that confirms and calls a new `markAttendedOpenDay(id)` function (same pattern as the existing `updatePaymentStatus`).

**Tech Stack:** Next.js API routes, Supabase JS client, React (no test-library for components — this repo only unit-tests `lib/` and `app/api/**/route.js`, per existing `route.test.js` files).

## Global Constraints

- Follow the existing PATCH handler's allowlist pattern in `app/api/registrations/route.js:81-88` — do not make the endpoint accept arbitrary fields.
- No automated test for `components/AdminTable.jsx` — this repo has no React component test setup (no `@testing-library` dependency); verify Task 2 manually via the dev server.
- Confirm dialog text must be exactly: `לסמן שהתקיימה שיחת היכרות?`

---

### Task 1: Extend PATCH /api/registrations to accept `attended_open_day`

**Files:**
- Modify: `app/api/registrations/route.js:81-88`
- Test: `app/api/registrations/route.test.js`

**Interfaces:**
- Consumes: existing `createMockSupabase(responses)` and `makeRequest(body)` helpers already defined in `app/api/registrations/route.test.js:14-50`.
- Produces: `PATCH` handler now accepts `attended_open_day` (boolean) in the request body and writes it to the `registrations.update()` payload.

- [ ] **Step 1: Write the failing test**

Add this `describe` block to the end of `app/api/registrations/route.test.js` (after the existing `describe('DELETE /api/registrations', ...)` block, before its closing nothing — just append at end of file):

```js
describe('PATCH /api/registrations', () => {
  test('writes attended_open_day to the update payload when provided', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { error: null }, // update
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await PATCH(makeRequest({ id: 'r1', attended_open_day: true }));
    expect(res.status).toBe(200);

    const update = mockSupabase.calls.find(c => c.table === 'registrations' && c.method === 'update');
    expect(update).toBeDefined();
    expect(update.payload.attended_open_day).toBe(true);
    expect(update.eqCalls).toContainEqual(['id', 'r1']);
  });

  test('omits attended_open_day from the update payload when not provided', async () => {
    const mockSupabase = createMockSupabase({
      registrations: [
        { error: null }, // update
      ],
    });
    getSupabaseClient.mockReturnValue(mockSupabase);

    const res = await PATCH(makeRequest({ id: 'r1', admin_notes: 'hello' }));
    expect(res.status).toBe(200);

    const update = mockSupabase.calls.find(c => c.table === 'registrations' && c.method === 'update');
    expect(update.payload).not.toHaveProperty('attended_open_day');
  });
});
```

Move the `import { PATCH } from './route';` line up next to the existing `import { DELETE } from './route';` on line 1 instead of inline — i.e. change line 1 to:

```js
import { DELETE, PATCH } from './route';
```

and do not repeat the import inside the new `describe` block.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest app/api/registrations/route.test.js -t "attended_open_day"`
Expected: FAIL — `update.payload.attended_open_day` is `undefined`, so `expect(update.payload.attended_open_day).toBe(true)` fails.

- [ ] **Step 3: Implement the minimal change**

In `app/api/registrations/route.js`, update the destructuring and payload assembly (lines 81-88):

```js
    const { id, admin_notes, registration_status, student_name, parent_name, parent_phone, parent_email, attended_open_day } = await request.json();
    const updateData = { updated_at: new Date().toISOString() };
    if (admin_notes !== undefined) updateData.admin_notes = admin_notes;
    if (registration_status !== undefined) updateData.registration_status = registration_status;
    if (student_name !== undefined) updateData.student_name = student_name;
    if (parent_name !== undefined) updateData.parent_name = parent_name;
    if (parent_phone !== undefined) updateData.parent_phone = parent_phone;
    if (parent_email !== undefined) updateData.parent_email = parent_email;
    if (attended_open_day !== undefined) updateData.attended_open_day = attended_open_day;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest app/api/registrations/route.test.js`
Expected: PASS — all tests in the file, including the two new ones and the pre-existing `DELETE` tests.

- [ ] **Step 5: Commit**

```bash
git add app/api/registrations/route.js app/api/registrations/route.test.js
git commit -m "feat: allow PATCH /api/registrations to update attended_open_day"
```

---

### Task 2: Turn the "טרם שיחת היכרות" badge into a clickable button in AdminTable

**Files:**
- Modify: `components/AdminTable.jsx:461-473` (add function near `updatePaymentStatus`)
- Modify: `components/AdminTable.jsx:645-649` (badge → button)

**Interfaces:**
- Consumes: `PATCH /api/registrations` from Task 1, now accepting `{ id, attended_open_day: true }`. Existing component state: `setRows`, `setUpdatingIds` (already in scope in `AdminTable.jsx`, used identically by `updatePaymentStatus`).
- Produces: `markAttendedOpenDay(id)` function in `AdminTable.jsx`, used only within this file.

- [ ] **Step 1: Add the `markAttendedOpenDay` function**

In `components/AdminTable.jsx`, immediately after the `updatePaymentStatus` function (ends at line 473, right before `const allGroups = useMemo(...)` on line 475), add:

```js
  async function markAttendedOpenDay(id) {
    setUpdatingIds(prev => [...prev, id]);
    try {
      await fetch('/api/registrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, attended_open_day: true }),
      });
      setRows(prev => prev.map(r => r.id === id ? { ...r, attended_open_day: true } : r));
    } finally {
      setUpdatingIds(prev => prev.filter(x => x !== id));
    }
  }
```

- [ ] **Step 2: Turn the badge into a button**

Replace the existing badge block at `components/AdminTable.jsx:645-649`:

```jsx
                        {contactRow.attended_open_day === false && (
                          <span className="mr-1 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">
                            טרם שיחת היכרות
                          </span>
                        )}
```

with:

```jsx
                        {contactRow.attended_open_day === false && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('לסמן שהתקיימה שיחת היכרות?')) markAttendedOpenDay(contactRow.id);
                            }}
                            className="mr-1 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium hover:bg-purple-200"
                          >
                            טרם שיחת היכרות
                          </button>
                        )}
```

- [ ] **Step 3: Manually verify in the dev server**

Run: `npm run dev`

Open the admin table in a browser, find a row whose student shows the "טרם שיחת היכרות" badge (e.g. אורי תורגמן from this conversation), click it, confirm the dialog, and verify:
- The badge disappears from that row immediately.
- Refreshing the page keeps the badge gone (confirms the Supabase row was actually updated, not just local state).

- [ ] **Step 4: Run the full test suite to check for regressions**

Run: `npx jest`
Expected: PASS — no existing test touches this badge or `updatePaymentStatus`'s sibling function, so nothing else should break.

- [ ] **Step 5: Commit**

```bash
git add components/AdminTable.jsx
git commit -m "feat: let admins mark open-day attendance by clicking the badge"
```
