# Registration Logic Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add teacher quota management, waiting-list auto-assignment, availability matching, תזמורת confirmation checkbox, and an Open Day gate with interview scheduling to the conservatory registration system.

**Architecture:** Backend quota/availability logic lives entirely in `app/api/register/route.js`. Frontend changes are isolated to `components/RegistrationForm.jsx` (Open Day gate + תזמורת checkbox), `components/TeacherForm.jsx` (max_students field), `components/TeachersTab.jsx` (quota display), `components/AdminTable.jsx` (new badge), and `components/StatusSelect.jsx` (new statuses). The thank-you page gains a new `interview` type param.

**Tech Stack:** Next.js 14 (App Router), Supabase (Postgres), React, Tailwind CSS. No test framework is configured — verification is done by running the dev server and checking behavior in the browser.

---

## Task 1: Database Migration

**Files:**
- Modify: `supabase-schema.sql`

> Run the SQL below manually in the **Supabase Dashboard → SQL Editor** before any other task.

- [ ] **Step 1: Run migration in Supabase SQL Editor**

```sql
-- Teachers: quota fields
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS max_students integer;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS weekly_hours_quota numeric;

-- Registrations: new fields
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS orchestra_confirmed boolean;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS attended_open_day boolean;
```

- [ ] **Step 2: Update `supabase-schema.sql` to document the new columns**

In `supabase-schema.sql`, find the `CREATE TABLE IF NOT EXISTS teachers` block and add two lines after `available_hours`:

```sql
  available_hours jsonb DEFAULT '{}',
  max_students integer,
  weekly_hours_quota numeric,
```

In the `CREATE TABLE IF NOT EXISTS registrations` block, add after `has_accommodations`:

```sql
  has_accommodations boolean NOT NULL DEFAULT false,
  orchestra_confirmed boolean,
  attended_open_day boolean,
```

Replace the existing migration block at the bottom:

```sql
-- מיגרציות (הרץ פעם אחת ב-Supabase SQL Editor)
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS birthdate date;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS grade text;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS school_name text;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS has_accommodations boolean NOT NULL DEFAULT false;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS orchestra_confirmed boolean;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS attended_open_day boolean;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS max_students integer;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS weekly_hours_quota numeric;
```

- [ ] **Step 3: Commit**

```bash
git add supabase-schema.sql
git commit -m "docs: update schema with quota and registration logic columns"
```

---

## Task 2: StatusSelect — Add New Statuses

**Files:**
- Modify: `components/StatusSelect.jsx`

- [ ] **Step 1: Add the two new statuses and their colors**

Replace the entire file content:

```jsx
'use client';

const STATUS_OPTIONS = ['חדש', 'בבדיקה', 'שובץ', 'נדחה', 'רשימת המתנה', 'ממתין לשיחת היכרות'];

const STATUS_COLORS = {
  'חדש':                    'bg-blue-100 text-blue-800',
  'בבדיקה':                 'bg-yellow-100 text-yellow-800',
  'שובץ':                   'bg-green-100 text-green-800',
  'נדחה':                   'bg-red-100 text-red-800',
  'רשימת המתנה':            'bg-orange-100 text-orange-800',
  'ממתין לשיחת היכרות':    'bg-purple-100 text-purple-800',
};

export default function StatusSelect({ value, onChange, disabled }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:ring-2 focus:ring-primary ${
        STATUS_COLORS[value] || 'bg-gray-100 text-gray-600'
      }`}
    >
      {STATUS_OPTIONS.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}
```

- [ ] **Step 2: Verify**

Start dev server (`npm run dev`). Go to admin panel → open any registration's status dropdown → confirm `רשימת המתנה` and `ממתין לשיחת היכרות` appear as options.

- [ ] **Step 3: Commit**

```bash
git add components/StatusSelect.jsx
git commit -m "feat: add waiting list and interview statuses to StatusSelect"
```

---

## Task 3: TeacherForm — Add max_students Field

**Files:**
- Modify: `components/TeacherForm.jsx`
- Modify: `app/api/teachers/[id]/route.js`
- Modify: `app/api/teachers/route.js`

- [ ] **Step 1: Add `maxStudents` state and field to `TeacherForm`**

In `components/TeacherForm.jsx`, add `maxStudents` state after `availableHours`:

```jsx
const [maxStudents, setMaxStudents] = useState(
  initial.max_students != null ? String(initial.max_students) : ''
);
```

Add the field to the UI — insert after the `סוג כלי` grid row and before the `ימים זמינים` block:

```jsx
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          מכסת תלמידים מקסימאלית
        </label>
        <input
          type="number"
          min="0"
          className="admin-input"
          value={maxStudents}
          onChange={(e) => setMaxStudents(e.target.value)}
          placeholder="ריק = ללא מכסה"
        />
      </div>
```

In `handleSubmit`, update the `onSave` call to include `max_students`:

```jsx
await onSave({
  name,
  instrument_type: instrumentType,
  available_days: availableDays,
  available_hours: availableHours,
  max_students: maxStudents !== '' ? parseInt(maxStudents, 10) : null,
});
```

- [ ] **Step 2: Update `PUT` route to persist `max_students`**

In `app/api/teachers/[id]/route.js`, update the destructure and update call:

```js
  const { name, instrument_type, available_days, available_hours, max_students } = body;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('teachers')
    .update({ name, instrument_type, available_days, available_hours, max_students: max_students ?? null })
    .eq('id', params.id)
    .select()
    .single();
```

- [ ] **Step 3: Update `POST` route to persist `max_students`**

In `app/api/teachers/route.js`, update the destructure and insert call:

```js
  const { name, instrument_type, available_days, available_hours, max_students } = body;

  // ... existing validation ...

  const { data, error } = await supabase
    .from('teachers')
    .insert([{
      name,
      instrument_type,
      available_days: available_days || [],
      available_hours: available_hours || {},
      max_students: max_students ?? null,
    }])
    .select()
    .single();
```

- [ ] **Step 4: Verify**

Go to admin → מורים → edit any teacher → confirm "מכסת תלמידים מקסימאלית" field appears → enter a number → save → reopen → confirm value persists.

- [ ] **Step 5: Commit**

```bash
git add components/TeacherForm.jsx app/api/teachers/route.js "app/api/teachers/[id]/route.js"
git commit -m "feat: add max_students quota field to TeacherForm and teachers API"
```

---

## Task 4: TeachersTab — Quota Display

**Files:**
- Modify: `components/TeachersTab.jsx`

- [ ] **Step 1: Update `TeacherCard` to show quota**

In the `TeacherCard` component (lines 7–63 of `components/TeachersTab.jsx`), replace the existing student count badge:

```jsx
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1.5 text-sm text-purple-600 font-medium hover:text-purple-800"
          >
            <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {students.length} תלמידים
            </span>
            <span>{open ? '▲' : '▼'}</span>
          </button>
```

With:

```jsx
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1.5 text-sm text-purple-600 font-medium hover:text-purple-800"
          >
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              t.max_students != null && students.length >= t.max_students
                ? 'bg-red-100 text-red-700'
                : 'bg-purple-100 text-purple-700'
            }`}>
              {students.length}
              {t.max_students != null ? ` / ${t.max_students}` : ''} תלמידים
            </span>
            <span>{open ? '▲' : '▼'}</span>
          </button>
```

- [ ] **Step 2: Verify**

Go to admin → מורים → confirm teachers with a `max_students` set show `X / max תלמידים` in red when at capacity, purple otherwise. Teachers with no max show `X תלמידים`.

- [ ] **Step 3: Commit**

```bash
git add components/TeachersTab.jsx
git commit -m "feat: show quota usage (X / max) on teacher cards"
```

---

## Task 5: Public Teachers API — Expose Scheduling Fields

**Files:**
- Modify: `app/api/teachers/public/route.js`

The registration form needs `available_days`, `available_hours`, and `max_students` from teachers at submission time (for quota + availability checks in the API). The public endpoint currently returns only `id, name, instrument_type`.

- [ ] **Step 1: Expand the public endpoint's select**

Replace the entire file:

```js
import { NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../../lib/supabase';

// Public endpoint — no auth required
export async function GET() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('teachers')
    .select('id, name, instrument_type, available_days, available_hours, max_students')
    .order('name');

  if (error) return NextResponse.json({ data: [] });
  return NextResponse.json({ data: data || [] });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/teachers/public/route.js
git commit -m "feat: expose available_days, available_hours, max_students in public teachers API"
```

---

## Task 6: Register API — Quota Check, Availability Match, Open Day Early Exit

**Files:**
- Modify: `app/api/register/route.js`

This is the core backend logic task. Replace the file entirely:

- [ ] **Step 1: Write the helper functions for quota check and availability match**

Add these two pure functions at the top of `app/api/register/route.js`, before `export async function POST`:

```js
/**
 * Parse a preferredSlot string like "ימי ב' בין 15:00–18:00"
 * Returns { day: "ב", from: "15:00", to: "18:00" } or null if unparseable.
 */
function parseSlot(slot) {
  if (!slot) return null;
  const dayMatch = slot.match(/ימי\s+([א-ו])/);
  const timeMatch = slot.match(/(\d{1,2}:\d{2})[–\-](\d{1,2}:\d{2})/);
  if (!dayMatch || !timeMatch) return null;
  return { day: dayMatch[1], from: timeMatch[1], to: timeMatch[2] };
}

/**
 * Returns true if teacher's available window overlaps with slot time range on the same day.
 */
function teacherOverlapsSlot(teacher, parsedSlot) {
  if (!parsedSlot) return false;
  const { day, from, to } = parsedSlot;
  if (!(teacher.available_days || []).includes(day)) return false;
  const hours = (teacher.available_hours || {})[day];
  if (!hours?.from || !hours?.to) return false;
  // Standard interval overlap: A.from < B.to && A.to > B.from
  return hours.from < to && hours.to > from;
}
```

- [ ] **Step 2: Replace `POST /api/register` with the full updated implementation**

Replace the entire `export async function POST` function:

```js
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      studentName,
      parentName,
      parentPhone,
      parentEmail,
      type,
      birthdate,
      grade,
      schoolName,
      hasAccommodations,
      instruments,
      orchestraConfirmed,
      attendedOpenDay,
      selectedCourse,
      continueTeacher,
      continueDay,
      continueTime,
      unavailableDays,
      preferredSlot,
    } = body;

    // Basic validation
    if (!studentName || !parentName || !parentPhone || !parentEmail) {
      return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 });
    }

    // ── Open Day early exit ──────────────────────────────────────────────────
    if (type === 'new' && attendedOpenDay === false) {
      const supabase = getSupabaseClient();
      const { data, error: dbError } = await supabase
        .from('registrations')
        .insert([{
          student_name: studentName,
          parent_name: parentName,
          parent_phone: parentPhone,
          parent_email: parentEmail,
          type,
          birthdate: birthdate || null,
          grade: grade || null,
          school_name: schoolName || null,
          has_accommodations: hasAccommodations || false,
          attended_open_day: false,
          preferred_slot: preferredSlot || null,
          status: 'ממתין לשיחת היכרות',
          instruments: [],
          unavailable_days: [],
        }])
        .select('id')
        .single();

      if (dbError) {
        console.error('Supabase error:', dbError.message);
        return NextResponse.json({ error: 'שגיאה בשמירת הנתונים' }, { status: 500 });
      }
      return NextResponse.json({ success: true, id: data?.id });
    }

    // ── Quota check (new / adult / trial only — continue is exempt) ──────────
    let initialStatus = 'חדש';
    let adminNotes = '';

    if (['new', 'adult', 'trial'].includes(type) && instruments?.length > 0) {
      const supabase = getSupabaseClient();
      const primaryInstrument = instruments[0];

      // Fetch teachers for this instrument
      const { data: matchingTeachers } = await supabase
        .from('teachers')
        .select('id, name, instrument_type, available_days, available_hours, max_students')
        .eq('instrument_type', primaryInstrument);

      if (!matchingTeachers || matchingTeachers.length === 0) {
        initialStatus = 'רשימת המתנה';
      } else {
        // Count non-continuing assigned students per teacher
        let hasAvailableTeacher = false;
        for (const teacher of matchingTeachers) {
          if (teacher.max_students == null) {
            hasAvailableTeacher = true;
            break;
          }
          const { count } = await supabase
            .from('registrations')
            .select('id', { count: 'exact', head: true })
            .eq('teacher', teacher.name)
            .neq('type', 'continue')
            .not('status', 'in', '("בוטל","ממתין לשיחת היכרות")');

          if (count < teacher.max_students) {
            hasAvailableTeacher = true;
            break;
          }
        }
        if (!hasAvailableTeacher) {
          initialStatus = 'רשימת המתנה';
        }

        // ── Availability matching (only when a slot is available) ────────────
        if (initialStatus === 'חדש' && preferredSlot) {
          const parsedSlot = parseSlot(preferredSlot);
          const anyOverlap = matchingTeachers.some((t) =>
            teacherOverlapsSlot(t, parsedSlot)
          );
          if (!anyOverlap) {
            adminNotes = '⚠️ אין חפיפה בין זמינות התלמיד לזמינות המורים';
          }
        }
      }
    }

    // ── Auto-assign orchestra/choir ──────────────────────────────────────────
    const orchestraGroup =
      type === 'continue'
        ? getOrchestraFromCourse(selectedCourse)
        : null;

    // ── Auto-assign continuing students ─────────────────────────────────────
    const autoAssign = type === 'continue' && continueTeacher;
    if (autoAssign) initialStatus = 'שובץ';

    // ── Save to Supabase ─────────────────────────────────────────────────────
    const supabase = getSupabaseClient();
    const { data, error: dbError } = await supabase
      .from('registrations')
      .insert([{
        student_name: studentName,
        parent_name: parentName,
        parent_phone: parentPhone,
        parent_email: parentEmail,
        type,
        birthdate: birthdate || null,
        grade: grade || null,
        school_name: schoolName || null,
        has_accommodations: hasAccommodations || false,
        orchestra_confirmed: orchestraConfirmed ?? null,
        attended_open_day: attendedOpenDay ?? null,
        instruments: instruments || [],
        selected_course: selectedCourse || null,
        unavailable_days: unavailableDays || [],
        preferred_slot: preferredSlot || null,
        status: initialStatus,
        orchestra_group: orchestraGroup || null,
        teacher: continueTeacher || null,
        assigned_day: continueDay || null,
        assigned_time: continueTime || null,
        admin_notes: adminNotes || null,
      }])
      .select('id')
      .single();

    if (dbError) {
      console.error('Supabase error:', dbError.message);
      return NextResponse.json({ error: 'שגיאה בשמירת הנתונים' }, { status: 500 });
    }

    const registrationId = data?.id;

    // ── Confirmation email ───────────────────────────────────────────────────
    try {
      await sendConfirmationEmail({
        parentName,
        studentName,
        parentEmail,
        instruments,
        preferredSlot,
        orchestra: orchestraGroup,
      });
    } catch (emailError) {
      console.error('Email error:', emailError.message);
    }

    // ── Google Sheets ────────────────────────────────────────────────────────
    try {
      await appendRegistrationRow(body);
    } catch (sheetsError) {
      console.error('Google Sheets error:', sheetsError.message);
    }

    // ── Make webhook ─────────────────────────────────────────────────────────
    await sendToMake('new_registration', {
      registrationId,
      studentName,
      parentName,
      parentPhone,
      parentEmail,
      type,
      instruments,
      preferredSlot,
      status: initialStatus,
    });

    return NextResponse.json({ success: true, id: registrationId });
  } catch (err) {
    console.error('Register API error:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify quota path**

1. In Supabase, set `max_students = 1` for one teacher (e.g., piano teacher)
2. Assign a non-continuing student to that teacher in the admin panel so their `assigned_count` = 1
3. Submit a new registration for the same instrument → check Supabase → `status` should be `רשימת המתנה`
4. Set `max_students = NULL` for that teacher → submit again → status should be `חדש`

- [ ] **Step 4: Verify Open Day path**

Submit a `new` type registration and answer "לא" to the Open Day question → Supabase row should have `status = 'ממתין לשיחת היכרות'` and `attended_open_day = false`.

- [ ] **Step 5: Commit**

```bash
git add app/api/register/route.js
git commit -m "feat: add quota check, availability match, and open day early exit to register API"
```

---

## Task 7: RegistrationForm — Open Day Gate

**Files:**
- Modify: `components/RegistrationForm.jsx`

- [ ] **Step 1: Add `attendedOpenDay` and `orchestra` to form state**

In the `useState` initializer for `form`, add two fields after `hasAccommodations`:

```js
    hasAccommodations: false,
    orchestra_confirmed: false,
    attendedOpenDay: null,   // null = not yet answered; true/false after answer
```

- [ ] **Step 2: Add Open Day question to the personal step**

In the personal step JSX (just before the closing `</div>` of the `currentStepId === 'personal'` block, after the registration type section), add:

```jsx
              {form.type === 'new' && (
                <div>
                  <label className="field-label">האם השתתפת ביום הפתוח? *</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {[
                      { value: true,  label: 'כן', desc: 'השתתפתי ביום הפתוח' },
                      { value: false, label: 'לא', desc: 'לא הגעתי ליום הפתוח' },
                    ].map((opt) => (
                      <button
                        key={String(opt.value)}
                        type="button"
                        onClick={() => update('attendedOpenDay', opt.value)}
                        className={`p-3 rounded-xl border text-right transition-all duration-200 ${
                          form.attendedOpenDay === opt.value
                            ? 'border-purple-400/70 bg-purple-500/15 text-white'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20'
                        }`}
                      >
                        <div className="text-sm font-semibold">{opt.label}</div>
                        <div className="text-xs opacity-60 mt-0.5">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
```

- [ ] **Step 3: Add validation for the Open Day answer**

In `validateStep()`, inside the `personal` block, add after the email validation:

```js
      if (form.type === 'new' && form.attendedOpenDay === null)
        return 'יש לענות על שאלת יום הפתוח';
```

- [ ] **Step 4: Add the "Schedule Interview" blocking view**

When `form.type === 'new'` and `form.attendedOpenDay === false`, the next-step button should instead show an interview scheduling UI and submit directly. Add this block immediately before the instrument step block (`{currentStepId === 'instrument' && ...}`):

```jsx
          {/* ── Interview Scheduling (new student, no open day) ── */}
          {form.type === 'new' && form.attendedOpenDay === false && currentStepId !== 'personal' && (
            <div className="space-y-6">
              <div className="mb-4 p-4 rounded-xl border border-purple-400/30 bg-purple-500/10">
                <div className="text-2xl mb-2 text-center">📞</div>
                <h2 className="text-lg font-bold text-white mb-2 text-center">תיאום שיחת היכרות</h2>
                <p className="text-slate-300 text-sm text-center leading-relaxed">
                  כדי להירשם, יש לקיים תחילה שיחת היכרות עם המזכירה.
                  <br />אנא בחר/י מועד מועדף:
                </p>
              </div>

              <div>
                <label className="field-label">מועד מועדף לשיחה *</label>
                <select
                  className="form-input mt-1"
                  value={form.preferredSlot}
                  onChange={(e) => update('preferredSlot', e.target.value)}
                >
                  <option value="">— בחרו מועד —</option>
                  {SLOT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
```

- [ ] **Step 5: Override `FLOWS` so "new + no open day" goes straight to interview after personal**

The existing `FLOWS.new = ['personal', 'instrument', 'days', 'agreement']`. We need the navigation buttons to work correctly. The interview view replaces all steps after `personal`. In `nextStep()`, add a guard before the normal step advance:

```js
  function nextStep() {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError('');

    // New student who didn't attend open day — skip to interview submit screen
    if (form.type === 'new' && form.attendedOpenDay === false && currentStepId === 'personal') {
      setStep(1); // move past personal; interview view renders instead
      return;
    }

    setStep((s) => s + 1);
  }
```

- [ ] **Step 6: Add interview-specific validation and direct submit**

In `validateStep()`, add a case for the interview slot:

```js
    if (form.type === 'new' && form.attendedOpenDay === false && currentStepId !== 'personal') {
      if (!form.preferredSlot) return 'יש לבחור מועד לשיחת היכרות';
    }
```

The existing `handleSubmit` already sends `JSON.stringify(form)` which will include `attendedOpenDay: false`. The API (`Task 6`) handles this with the early-exit path.

Update the redirect after submit to pass `type=interview` for the thank-you page:

In `handleSubmit`, replace the params logic:

```js
      const params = new URLSearchParams();
      params.set('type', form.type);
      if (form.type === 'new' && form.attendedOpenDay === false) {
        params.set('type', 'interview');
      } else if (form.type !== 'trial') {
        const paymentUrl = getPaymentLink(form.selectedCourse);
        if (paymentUrl) params.set('paymentUrl', paymentUrl);
      }
      router.push(`/thank-you?${params.toString()}`);
```

- [ ] **Step 7: Verify**

1. Go to `/register` → choose "מתחיל/ה" → fill personal details → answer "לא" to open day question → click next → interview scheduling view should appear
2. Select a slot → submit → Supabase should have `status = 'ממתין לשיחת היכרות'`, `attended_open_day = false`
3. Answer "כן" → normal flow continues

- [ ] **Step 8: Commit**

```bash
git add components/RegistrationForm.jsx
git commit -m "feat: add open day gate with interview scheduling to registration form"
```

---

## Task 8: RegistrationForm — תזמורת Checkbox

**Files:**
- Modify: `components/RegistrationForm.jsx`

- [ ] **Step 1: Add helper to determine if תזמורת checkbox should show**

Add this derived boolean near the top of the component function body (after `const currentStepId`):

```js
  const isYearA = form.selectedCourse?.includes("שנה א'");
  const showOrchestraCheckbox = !isYearA;
```

- [ ] **Step 2: Add orchestra checkbox to instrument step**

In the instrument step JSX, after the `preferredSlot` select block (after the closing `</div>` of `{form.type !== 'trial' && ...}`), add:

```jsx
              {showOrchestraCheckbox && (
                <div className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5">
                  <input
                    type="checkbox"
                    id="orchestra_confirmed"
                    checked={form.orchestra_confirmed}
                    onChange={(e) => update('orchestra_confirmed', e.target.checked)}
                    className="w-5 h-5 rounded accent-purple-500 cursor-pointer"
                  />
                  <label htmlFor="orchestra_confirmed" className="text-sm text-slate-300 cursor-pointer select-none">
                    אני מאשר/ת השתתפות בתזמורת *
                  </label>
                </div>
              )}
```

- [ ] **Step 3: Add orchestra checkbox to course step (for `continue` and non-year-A `melodies`)**

In the course step JSX, after the course picker select and price display (before the `{form.type === 'continue' && ...}` block), add:

```jsx
              {showOrchestraCheckbox && (
                <div className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5">
                  <input
                    type="checkbox"
                    id="orchestra-course-confirmed"
                    checked={form.orchestra_confirmed}
                    onChange={(e) => update('orchestra_confirmed', e.target.checked)}
                    className="w-5 h-5 rounded accent-purple-500 cursor-pointer"
                  />
                  <label htmlFor="orchestra-course-confirmed" className="text-sm text-slate-300 cursor-pointer select-none">
                    אני מאשר/ת השתתפות בתזמורת *
                  </label>
                </div>
              )}
```

- [ ] **Step 4: Add validation**

In `validateStep()`, in the `instrument` block, add after the existing instrument validation:

```js
      if (form.type !== 'trial' && showOrchestraCheckbox && !form.orchestra_confirmed)
        return 'יש לאשר השתתפות בתזמורת';
```

In the `course` block, add:

```js
      if ((form.type === 'continue' || form.type === 'melodies') && showOrchestraCheckbox && !form.orchestra_confirmed)
        return 'יש לאשר השתתפות בתזמורת';
```

Note: `showOrchestraCheckbox` is in scope because `validateStep` is defined inside the component.

- [ ] **Step 5: Verify**

1. Register as `new` → choose any instrument → confirm תזמורת checkbox appears → try to proceed without checking → validation error appears
2. Register as `melodies` → choose "שנה א'" course → תזמורת checkbox should NOT appear
3. Register as `melodies` → choose "שנה ב'" course → תזמורת checkbox SHOULD appear
4. Register as `continue` → תזמורת checkbox appears in course step

- [ ] **Step 6: Commit**

```bash
git add components/RegistrationForm.jsx
git commit -m "feat: add תזמורת confirmation checkbox (hidden for Melodies Year A)"
```

---

## Task 9: Thank-You Page — Interview Message

**Files:**
- Modify: `app/thank-you/page.js`

- [ ] **Step 1: Add interview type handling**

In `ThankYouContent`, add `isInterview` after `isTrial`:

```js
  const isInterview = searchParams.get('type') === 'interview';
```

Update the emoji and heading:

```jsx
      <div className="text-6xl mb-5">{isInterview ? '📞' : isTrial ? '🎵' : '🎉'}</div>
      <h1 className="text-3xl font-bold mb-3">
        <span className="gradient-text">
          {isInterview ? 'קיבלנו את בקשתך!' : isTrial ? 'קיבלנו את בקשתך!' : 'הרשמתך התקבלה!'}
        </span>
      </h1>
      <p className="text-slate-400 mb-8 leading-relaxed">
        {isInterview
          ? 'כדי להשלים את ההרשמה, יש לקיים תחילה שיחת היכרות.'
          : isTrial
          ? 'תודה על התעניינותך בקונסרבטוריון המוזיקה.'
          : <>תודה על ההרשמה לקונסרבטוריון המוזיקה.<br />ניצור איתך קשר בהקדם לתיאום שיחת התאמה.</>
        }
      </p>
```

Replace the "מה הלאה?" block to handle the interview case:

```jsx
        {isInterview ? (
          <>
            <div className="flex items-start gap-3 text-sm text-slate-300">
              <span className="text-purple-400 mt-0.5">📞</span>
              <span>נחזור אליך במועד שבחרת לשיחת היכרות עם המזכירה</span>
            </div>
            <div className="flex items-start gap-3 text-sm text-slate-300">
              <span className="text-purple-400 mt-0.5">✅</span>
              <span>לאחר שיחת ההיכרות תוכלו להשלים את ההרשמה המלאה</span>
            </div>
          </>
        ) : isTrial ? (
          <>
            <div className="flex items-start gap-3 text-sm text-slate-300">
              <span className="text-purple-400 mt-0.5">📞</span>
              <span>נחזור אליך בהקדם לתיאום שיעור הניסיון</span>
            </div>
            <div className="flex items-start gap-3 text-sm text-slate-300">
              <span className="text-purple-400 mt-0.5">🎵</span>
              <span>שיעור הניסיון אינו כרוך בתשלום</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3 text-sm text-slate-300">
              <span className="text-purple-400 mt-0.5">✉️</span>
              <span>שלחנו לך אישור לכתובת האימייל שסיפקת</span>
            </div>
            <div className="flex items-start gap-3 text-sm text-slate-300">
              <span className="text-purple-400 mt-0.5">📞</span>
              <span>נחזור אליך לשיחת התאמה במועד שבחרת</span>
            </div>
            <div className="flex items-start gap-3 text-sm text-slate-300">
              <span className="text-purple-400 mt-0.5">🎵</span>
              <span>לאחר השיחה נשבץ אותך לקבוצה המתאימה</span>
            </div>
          </>
        )}
```

Also wrap the payment button so it only shows for non-interview, non-trial registrations:

```jsx
      {!isInterview && !isTrial && paymentUrl && (
        // ... existing payment button ...
      )}
      {!isInterview && !isTrial && !paymentUrl && (
        // ... existing "no payment before Sept 10" notice ...
      )}
      {!isInterview && paymentUrl && (
        // ... existing payment link ...
      )}
```

- [ ] **Step 2: Verify**

Submit a registration where Open Day = "לא" → thank-you page shows 📞 icon, interview-specific message, no payment button.

- [ ] **Step 3: Commit**

```bash
git add app/thank-you/page.js
git commit -m "feat: add interview confirmation view to thank-you page"
```

---

## Task 10: AdminTable — Badge for Unscheduled Interview Students

**Files:**
- Modify: `components/AdminTable.jsx`

- [ ] **Step 1: Add badge to student name cell**

In `AdminTable.jsx`, find where `r.student_name` is rendered in the table rows. Add a badge immediately after the name:

```jsx
<span className="font-medium">{r.student_name}</span>
{r.attended_open_day === false && (
  <span className="mr-1 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">
    טרם שיחת היכרות
  </span>
)}
```

- [ ] **Step 2: Verify**

Go to admin → רישומים → confirm rows with `attended_open_day = false` show the "טרם שיחת היכרות" badge next to the student name. Other rows show no badge.

- [ ] **Step 3: Commit**

```bash
git add components/AdminTable.jsx
git commit -m "feat: show 'טרם שיחת היכרות' badge for students who missed open day"
```

---

## Task 11: Final Push to Production

- [ ] **Step 1: Push all commits**

```bash
git push origin main
```

- [ ] **Step 2: Confirm Vercel deployment succeeds**

Check Vercel dashboard → deployment should complete without errors.

- [ ] **Step 3: Smoke test on production**

1. `/register` → new student → "לא" to open day → slot picker → submit → thank-you shows interview message
2. `/register` → new student → "כן" to open day → proceed to instrument step → תזמורת checkbox visible
3. Admin panel → מורים → edit a teacher → max_students field appears
4. Admin panel → רישומים → status dropdown shows all 6 statuses
