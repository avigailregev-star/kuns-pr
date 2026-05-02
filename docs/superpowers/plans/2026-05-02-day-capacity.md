# Day Capacity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show per-day availability on teacher day buttons (registration form + admin panel), block full days in the UI, and protect against race conditions on submission.

**Architecture:** A shared utility extracts lesson duration from course name. Both teacher API endpoints enrich each teacher with `used_minutes_per_day` (computed from active registrations). The UI uses this to render day buttons as available or full. The register API re-checks capacity on submission.

**Tech Stack:** Next.js 14 App Router, Supabase, React, Tailwind CSS. No test framework — verification is done via `next build` and manual browser testing.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/lessonDuration.js` | **Create** | Extract lesson duration (45/60 min) from course name |
| `lib/teacherCapacity.js` | **Create** | Query registrations and build `used_minutes_per_day` map |
| `app/api/teachers/public/route.js` | **Modify** | Enrich public teacher list with `used_minutes_per_day` |
| `app/api/teachers/route.js` | **Modify** | Enrich admin teacher list with `used_minutes_per_day` |
| `components/RegistrationForm.jsx` | **Modify** | Show availability state on day buttons |
| `components/AdminTable.jsx` | **Modify** | Show availability state on day buttons |
| `app/api/register/route.js` | **Modify** | Server-side capacity check on submission |

---

## Task 1: Create `lib/lessonDuration.js`

**Files:**
- Create: `lib/lessonDuration.js`

- [ ] **Step 1: Create the file**

```js
// lib/lessonDuration.js
export function getLessonDuration(courseName) {
  if (!courseName) return 45;
  if (courseName.includes('60')) return 60;
  return 45;
}
```

- [ ] **Step 2: Verify with `next build`**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/lessonDuration.js
git commit -m "feat: add getLessonDuration utility"
```

---

## Task 2: Create `lib/teacherCapacity.js`

**Files:**
- Create: `lib/teacherCapacity.js`

- [ ] **Step 1: Create the file**

```js
// lib/teacherCapacity.js
import { getLessonDuration } from './lessonDuration';

/**
 * Queries active registrations and returns a map of
 * { teacherName: { dayLetter: usedMinutes } }
 * Excludes cancelled, waiting-for-interview, and waiting-list registrations.
 */
export async function buildUsedMinutesMap(supabase) {
  const { data: assignments, error } = await supabase
    .from('registrations')
    .select('teacher, assigned_day, selected_course')
    .not('assigned_day', 'is', null)
    .not('teacher', 'is', null)
    .not('status', 'in', '("בוטל","ממתין לשיחת היכרות","רשימת המתנה")');

  if (error || !assignments) return {};

  const map = {};
  for (const reg of assignments) {
    if (!map[reg.teacher]) map[reg.teacher] = {};
    if (!map[reg.teacher][reg.assigned_day]) map[reg.teacher][reg.assigned_day] = 0;
    map[reg.teacher][reg.assigned_day] += getLessonDuration(reg.selected_course);
  }
  return map;
}

/**
 * Given a teacher's available_hours for a day and used minutes,
 * returns the remaining free minutes.
 */
export function freeMinutesOnDay(availableHours, day, usedMinutes) {
  const hours = availableHours?.[day];
  if (!hours?.from || !hours?.to) return 0;
  const [fh, fm] = hours.from.split(':').map(Number);
  const [th, tm] = hours.to.split(':').map(Number);
  const total = (th * 60 + tm) - (fh * 60 + fm);
  return total - (usedMinutes || 0);
}
```

- [ ] **Step 2: Verify with `next build`**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add lib/teacherCapacity.js
git commit -m "feat: add buildUsedMinutesMap and freeMinutesOnDay utilities"
```

---

## Task 3: Enrich `/api/teachers/public/route.js`

**Files:**
- Modify: `app/api/teachers/public/route.js`

Current file returns: `{ data: teachers[] }`

- [ ] **Step 1: Update the route**

Replace the entire file content with:

```js
import { NextResponse } from 'next/server';
import { getSupabaseClient } from '../../../../lib/supabase';
import { buildUsedMinutesMap } from '../../../../lib/teacherCapacity';

export async function GET() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('teachers')
    .select('id, name, instrument_type, available_days, available_hours, max_students')
    .order('name');

  if (error) return NextResponse.json({ data: [] });

  const usedMap = await buildUsedMinutesMap(supabase);
  const enriched = (data || []).map(t => ({
    ...t,
    used_minutes_per_day: usedMap[t.name] || {},
  }));

  return NextResponse.json({ data: enriched });
}
```

- [ ] **Step 2: Verify with `next build`**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Manual verification**

Start dev server: `npm run dev`
Visit: `http://localhost:3000/api/teachers/public`
Expected: each teacher object includes `"used_minutes_per_day": { ... }`

- [ ] **Step 4: Commit**

```bash
git add app/api/teachers/public/route.js
git commit -m "feat: enrich public teachers API with used_minutes_per_day"
```

---

## Task 4: Enrich `/api/teachers/route.js` (admin endpoint)

**Files:**
- Modify: `app/api/teachers/route.js`

- [ ] **Step 1: Update the GET handler**

Replace only the `GET` function (keep `POST` unchanged):

```js
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { getSupabaseClient } from '../../../lib/supabase';
import { buildUsedMinutesMap } from '../../../lib/teacherCapacity';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('teachers')
    .select('*')
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const usedMap = await buildUsedMinutesMap(supabase);
  const enriched = (data || []).map(t => ({
    ...t,
    used_minutes_per_day: usedMap[t.name] || {},
  }));

  return NextResponse.json({ data: enriched });
}
```

Keep the existing `POST` function exactly as-is below.

- [ ] **Step 2: Verify with `next build`**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/api/teachers/route.js
git commit -m "feat: enrich admin teachers API with used_minutes_per_day"
```

---

## Task 5: Update day buttons in `RegistrationForm.jsx`

**Files:**
- Modify: `components/RegistrationForm.jsx`

The day buttons section is inside `{currentStepId === 'course' && !isInterviewFlow && (...)}`, within the block `{(form.type === 'continue' || form.type === 'new') && (...)}`. It currently renders when `form.continueTeacher` is set and `days.length > 0`.

- [ ] **Step 1: Add import at the top of the file**

After the existing imports, add:

```js
import { getLessonDuration } from '../lib/lessonDuration';
import { freeMinutesOnDay } from '../lib/teacherCapacity';
```

- [ ] **Step 2: Replace the day buttons rendering block**

Find this block (inside the teacher section in the course step):

```js
return days.length > 0 ? (
  <div className="space-y-3">
    <label className="field-label">יום השיעור הקבוע</label>
    <div className="grid grid-cols-3 gap-2">
      {days.map(d => (
        <button key={d} type="button"
          onClick={() => { update('continueDay', d); update('continueTime', ''); }}
          className={`p-2 rounded-xl border text-sm text-center transition-all ${
            form.continueDay === d
              ? 'border-purple-400/70 bg-purple-500/15 text-white'
              : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20'
          }`}>
          <div className="font-semibold">יום {d}</div>
          {hours[d] && <div className="text-xs opacity-70 mt-0.5">{hours[d].from}–{hours[d].to}</div>}
        </button>
      ))}
    </div>
    {form.continueDay && (
      <div>
        <label className="field-label">שעת השיעור</label>
        <input type="time" className="form-input mt-1" value={form.continueTime}
          min={hours[form.continueDay]?.from}
          max={hours[form.continueDay]?.to}
          onChange={(e) => update('continueTime', e.target.value)} />
        {hours[form.continueDay] && (
          <p className="text-xs text-slate-500 mt-1">שעות פנויות: {hours[form.continueDay].from}–{hours[form.continueDay].to}</p>
        )}
      </div>
    )}
  </div>
) : null;
```

Replace with:

```js
return days.length > 0 ? (
  <div className="space-y-3">
    <label className="field-label">יום השיעור הקבוע</label>
    <div className="grid grid-cols-3 gap-2">
      {days.map(d => {
        const lessonDuration = getLessonDuration(form.selectedCourse);
        const free = freeMinutesOnDay(hours, d, teacher?.used_minutes_per_day?.[d]);
        const isFull = free < lessonDuration;
        return (
          <button key={d} type="button"
            disabled={isFull}
            onClick={() => { if (!isFull) { update('continueDay', d); update('continueTime', ''); } }}
            className={`p-2 rounded-xl border text-sm text-center transition-all ${
              isFull
                ? 'border-white/5 bg-white/3 text-slate-600 cursor-not-allowed opacity-50'
                : form.continueDay === d
                ? 'border-purple-400/70 bg-purple-500/15 text-white'
                : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20'
            }`}>
            <div className="font-semibold">יום {d}</div>
            {isFull
              ? <div className="text-xs mt-0.5 text-red-400">מלא</div>
              : <div className="text-xs opacity-70 mt-0.5">{free} דק' פנויות</div>
            }
          </button>
        );
      })}
    </div>
    {form.continueDay && (
      <div>
        <label className="field-label">שעת השיעור</label>
        <input type="time" className="form-input mt-1" value={form.continueTime}
          min={hours[form.continueDay]?.from}
          max={hours[form.continueDay]?.to}
          onChange={(e) => update('continueTime', e.target.value)} />
        {hours[form.continueDay] && (
          <p className="text-xs text-slate-500 mt-1">שעות פנויות: {hours[form.continueDay].from}–{hours[form.continueDay].to}</p>
        )}
      </div>
    )}
  </div>
) : null;
```

- [ ] **Step 3: Verify with `next build`**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual verification**

Start dev server: `npm run dev`
Open `http://localhost:3000/register`, choose "ממשיך/ה", proceed to course step, select a teacher who has `available_days` configured.
Expected: day buttons show either "X דק' פנויות" or "מלא" (greyed, disabled).

- [ ] **Step 5: Commit**

```bash
git add components/RegistrationForm.jsx
git commit -m "feat: show day availability in registration form day picker"
```

---

## Task 6: Update day buttons in `AdminTable.jsx`

**Files:**
- Modify: `components/AdminTable.jsx`

The day buttons are rendered inside the assignment section using an IIFE. They currently look like:

```js
{days.map(d => (
  <button key={d} type="button"
    onClick={() => {
      updateAssignment(row.id, 'assigned_day', d);
      updateAssignment(row.id, 'assigned_time', '');
    }}
    className={`px-3 py-1 rounded-lg text-sm border transition-all ${
      row.assigned_day === d
        ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
    }`}
  >
    יום {d}
    {hours[d] && <span className="text-xs opacity-60 mr-1">{hours[d].from}–{hours[d].to}</span>}
  </button>
))}
```

- [ ] **Step 1: Add import at the top of the file**

After the existing imports at the top of `AdminTable.jsx`, add:

```js
import { getLessonDuration } from '../lib/lessonDuration';
import { freeMinutesOnDay } from '../lib/teacherCapacity';
```

- [ ] **Step 2: Replace the day buttons map**

Find the `{days.map(d => (` block inside the admin assignment IIFE and replace it with:

```js
{days.map(d => {
  const lessonDuration = getLessonDuration(row.selected_course);
  const free = freeMinutesOnDay(hours, d, selectedTeacher?.used_minutes_per_day?.[d]);
  const isFull = free < lessonDuration;
  return (
    <button
      key={d}
      type="button"
      disabled={isFull}
      onClick={() => {
        if (isFull) return;
        updateAssignment(row.id, 'assigned_day', d);
        updateAssignment(row.id, 'assigned_time', '');
      }}
      className={`px-3 py-1 rounded-lg text-sm border transition-all ${
        isFull
          ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
          : row.assigned_day === d
          ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
      }`}
    >
      יום {d}
      {isFull
        ? <span className="text-xs mr-1 text-red-400">מלא</span>
        : hours[d] && <span className="text-xs opacity-60 mr-1">{hours[d].from}–{hours[d].to}</span>
      }
    </button>
  );
})}
```

- [ ] **Step 3: Verify with `next build`**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual verification**

Open admin panel, expand a registration with a teacher assigned, check assignment section.
Expected: day buttons show "מלא" (greyed, disabled) for full days and hours range for available days.

- [ ] **Step 5: Commit**

```bash
git add components/AdminTable.jsx
git commit -m "feat: show day availability in admin day picker"
```

---

## Task 7: Server-side capacity check in `/api/register/route.js`

**Files:**
- Modify: `app/api/register/route.js`

This adds a capacity check when `continueDay` is set in the submission — after the existing quota check block.

- [ ] **Step 1: Add imports at the top of the file**

Add to the existing imports:

```js
import { getLessonDuration } from '../../../lib/lessonDuration';
import { buildUsedMinutesMap, freeMinutesOnDay } from '../../../lib/teacherCapacity';
```

- [ ] **Step 2: Add day capacity check**

Find the section after the existing quota check (after the closing `}` of the `if (['new', 'adult', 'trial'].includes(type)` block, around line 138), and add this block before the main DB insert:

```js
// ── Day capacity check (when a specific day was selected) ─────────────────
if (continueTeacher && continueDay) {
  const supabase = getSupabaseClient();
  const usedMap = await buildUsedMinutesMap(supabase);
  const { data: teacherRow } = await supabase
    .from('teachers')
    .select('available_hours')
    .eq('name', continueTeacher)
    .single();

  const lessonDuration = getLessonDuration(selectedCourse);
  const free = freeMinutesOnDay(
    teacherRow?.available_hours || {},
    continueDay,
    usedMap[continueTeacher]?.[continueDay]
  );

  if (free < lessonDuration) {
    initialStatus = 'רשימת המתנה';
    adminNotes = (adminNotes ? adminNotes + ' | ' : '') +
      `⚠️ יום ${continueDay} מלא אצל ${continueTeacher} — הוכנס לרשימת המתנה`;
  }
}
```

- [ ] **Step 3: Verify with `next build`**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual verification (race condition path)**

To test this manually:
1. Temporarily modify `freeMinutesOnDay` in `lib/teacherCapacity.js` to always return `0`
2. Submit a registration with a teacher + day selected
3. Check the admin panel — the new registration should have status `רשימת המתנה` and the note `⚠️ יום X מלא`
4. Revert the temporary change to `freeMinutesOnDay`

- [ ] **Step 5: Commit**

```bash
git add app/api/register/route.js
git commit -m "feat: add server-side day capacity check on registration submission"
```

---

## Task 8: Push all changes

- [ ] **Step 1: Push to remote**

```bash
git push
```

Expected: all 7 commits pushed to `origin/main`.

- [ ] **Step 2: Verify production deployment**

Open `https://kunspr.vercel.app/register`, select a continuing student, pick a teacher with configured days.
Expected: day buttons show availability (minutes remaining or "מלא").
