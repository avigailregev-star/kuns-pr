# Teacher Availability Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow parents to select a teacher's available day during registration, with the teacher auto-detected from the selected course.

**Architecture:** Add a `courses` JSONB column to the `teachers` table for courses whose name doesn't contain the teacher's name. The registration form detects the teacher by name-in-course first, then falls back to the `courses` array. Availability display is expanded to adult registrations. Field names `continueTeacher/continueDay/continueTime` are renamed to `selectedTeacher/selectedDay/selectedTime` throughout.

**Tech Stack:** Next.js 14 (App Router), Supabase (PostgreSQL), React, Tailwind CSS

---

## File Map

| File | Change |
|------|--------|
| Supabase (SQL) | Add `courses JSONB` column to `teachers` table |
| `app/api/teachers/route.js` | POST: add `courses` to insert |
| `app/api/teachers/[id]/route.js` | PUT: add `courses` to update |
| `app/api/teachers/public/route.js` | SELECT: add `courses` field |
| `components/TeacherForm.jsx` | Add courses multi-select state + UI |
| `components/RegistrationForm.jsx` | Rename fields, update adult flow, detection logic, visibility condition |
| `app/api/register/route.js` | Rename `continueTeacher/Day/Time` → `selectedTeacher/Day/Time` |

---

## Task 1: Add `courses` column in Supabase

**Files:** Supabase Studio (SQL editor)

- [ ] **Step 1: Run the migration SQL**

Open Supabase Studio → SQL Editor and run:

```sql
ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS courses JSONB NOT NULL DEFAULT '[]'::jsonb;
```

- [ ] **Step 2: Verify**

In Supabase Studio → Table Editor → teachers, confirm the `courses` column exists with default `[]`.

---

## Task 2: Update teacher APIs to include `courses`

**Files:**
- Modify: `app/api/teachers/public/route.js`
- Modify: `app/api/teachers/route.js`
- Modify: `app/api/teachers/[id]/route.js`

- [ ] **Step 1: Update public teachers API SELECT**

In `app/api/teachers/public/route.js`, change line 9:

```js
// Before:
.select('id, name, instrument_type, available_days, available_hours, max_students, teacher_availability_ranges(day_of_week, start_time, end_time)')

// After:
.select('id, name, instrument_type, available_days, available_hours, max_students, courses, teacher_availability_ranges(day_of_week, start_time, end_time)')
```

- [ ] **Step 2: Update admin teachers POST to accept `courses`**

In `app/api/teachers/route.js`, update the POST handler:

```js
export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });

  const body = await request.json();
  const { name, instrument_type, available_days, available_hours, max_students, courses } = body;

  if (!name || !instrument_type) {
    return NextResponse.json({ error: 'שם וסוג כלי הם שדות חובה' }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('teachers')
    .insert([{
      name,
      instrument_type,
      available_days: available_days || [],
      available_hours: available_hours || {},
      max_students: max_students ?? null,
      courses: courses || [],
    }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
```

- [ ] **Step 3: Update admin teachers PUT to accept `courses`**

Replace the entire `PUT` handler in `app/api/teachers/[id]/route.js`:

```js
export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });

  const body = await request.json();
  const { name, instrument_type, available_days, available_hours, max_students, courses } = body;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('teachers')
    .update({
      name,
      instrument_type,
      available_days,
      available_hours,
      max_students: max_students ?? null,
      courses: courses || [],
    })
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
```

- [ ] **Step 4: Manual verification**

In the browser, open the admin panel → Teachers tab. The teacher list should still load without errors.
Open DevTools → Network → find the `/api/teachers` response. Confirm each teacher object has a `courses` field (array, initially `[]`).

- [ ] **Step 5: Commit**

```bash
git add app/api/teachers/public/route.js app/api/teachers/route.js "app/api/teachers/[id]/route.js"
git commit -m "feat: add courses field to teacher APIs"
```

---

## Task 3: Update TeacherForm with courses multi-select

**Files:**
- Modify: `components/TeacherForm.jsx`

- [ ] **Step 1: Add import and courses state**

At the top of `components/TeacherForm.jsx`, after the existing imports, add:

```js
import { COURSE_GROUPS } from '../lib/paymentLinks';
```

Inside the `TeacherForm` component, after the `maxStudents` state declaration, add:

```js
const [courses, setCourses] = useState(initial.courses || []);
```

- [ ] **Step 2: Add `assignableCourses` derived list**

After the state declarations, add:

```js
// All courses whose name does not already contain this teacher's name
const assignableCourses = COURSE_GROUPS.flatMap((g) => g.courses).filter(
  (course) => !name.trim() || !course.includes(name.trim())
);
```

- [ ] **Step 3: Add courses toggle helper**

After the `setHours` function, add:

```js
function toggleCourse(course) {
  setCourses((prev) =>
    prev.includes(course) ? prev.filter((c) => c !== course) : [...prev, course]
  );
}
```

- [ ] **Step 4: Include `courses` in the onSave payload**

In `handleSubmit`, update the `onSave` call to include `courses`:

```js
await onSave({
  name,
  instrument_type: instrumentType,
  available_days: availableDays,
  available_hours: availableHours,
  max_students: maxStudents !== '' ? parseInt(maxStudents, 10) : null,
  courses,
});
```

- [ ] **Step 5: Add courses UI section**

After the closing `</div>` of the available hours section (after line 135, before the error paragraph), add:

```jsx
{assignableCourses.length > 0 && (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      קורסים משויכים
      <span className="text-xs text-gray-400 font-normal mr-1">(קורסים שהשם אינו מופיע בשמם)</span>
    </label>
    <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1 bg-gray-50">
      {assignableCourses.map((course) => (
        <label key={course} className="flex items-center gap-2 cursor-pointer hover:bg-white px-2 py-1 rounded">
          <input
            type="checkbox"
            checked={courses.includes(course)}
            onChange={() => toggleCourse(course)}
            className="accent-purple-500"
          />
          <span className="text-sm text-gray-700">{course}</span>
        </label>
      ))}
    </div>
    {courses.length > 0 && (
      <p className="text-xs text-purple-600 mt-1">נבחרו: {courses.join(', ')}</p>
    )}
  </div>
)}
```

- [ ] **Step 6: Manual verification**

Open admin → Teachers → Edit any teacher. Confirm the "קורסים משויכים" section appears with a scrollable list of courses. Check a few, save, re-open the teacher — the checked courses should still be selected.

- [ ] **Step 7: Commit**

```bash
git add components/TeacherForm.jsx
git commit -m "feat: add course assignment multi-select to TeacherForm"
```

---

## Task 4: Rename teacher fields in RegistrationForm

**Files:**
- Modify: `components/RegistrationForm.jsx`

This task renames `continueTeacher/continueDay/continueTime` → `selectedTeacher/selectedDay/selectedTime` throughout the form component. The register API is updated in the next task.

- [ ] **Step 1: Rename in form initial state**

In `RegistrationForm.jsx`, find the `useForm` state (around line 81), update the three fields:

```js
// Replace:
continueTeacher: '',
continueDay: '',
continueTime: '',

// With:
selectedTeacher: '',
selectedDay: '',
selectedTime: '',
```

- [ ] **Step 2: Rename in the teacher-detection useEffect**

Find the `useEffect` that watches `form.selectedCourse` (around lines 103–114). Replace it entirely:

```js
useEffect(() => {
  if (!form.selectedCourse) {
    update('selectedTeacher', '');
    update('selectedDay', '');
    update('selectedTime', '');
    return;
  }
  const matched = teachersList.find((t) => form.selectedCourse.includes(t.name));
  update('selectedTeacher', matched?.name || '');
  update('selectedDay', '');
  update('selectedTime', '');
}, [form.selectedCourse, teachersList]);
```

- [ ] **Step 3: Rename all references inside the availability block**

The availability block starts around line 527. Do a find-and-replace within the file for each of these pairs (exact string replacement — do not use replace_all globally across unrelated files):

| Find | Replace |
|------|---------|
| `form.continueTeacher` | `form.selectedTeacher` |
| `form.continueDay` | `form.selectedDay` |
| `form.continueTime` | `form.selectedTime` |
| `update('continueTeacher'` | `update('selectedTeacher'` |
| `update('continueDay'` | `update('selectedDay'` |
| `update('continueTime'` | `update('selectedTime'` |

- [ ] **Step 4: Manual verification (dev server)**

Run `npm run dev`. Open `/register`, choose "ממשיך", pick a course that contains a teacher name (e.g. "פסנתר מרינה 45 דק'"). Confirm the day-picker still appears and days are selectable.

Open DevTools → Console. Confirm no errors about undefined fields.

- [ ] **Step 5: Commit**

```bash
git add components/RegistrationForm.jsx
git commit -m "refactor: rename continueTeacher/Day/Time to selectedTeacher/Day/Time in RegistrationForm"
```

---

## Task 5: Update register API to use renamed fields

**Files:**
- Modify: `app/api/register/route.js`

- [ ] **Step 1: Update destructuring**

In `app/api/register/route.js`, find the destructuring block (lines 35–56) and replace the three field names:

```js
// Replace:
continueTeacher,
continueDay,
continueTime,

// With:
selectedTeacher,
selectedDay,
selectedTime,
```

- [ ] **Step 2: Update day capacity check**

Find the capacity check block (around line 144). Replace:

```js
// Replace:
if (continueTeacher && continueDay != null && continueDay !== '') {
  const supabase = getSupabaseClient();
  const usedMap = await buildUsedMinutesMap(supabase);
  const lessonDuration = getLessonDuration(selectedCourse);
  const usedMins = usedMap[continueTeacher]?.[continueDay] || 0;

  const { data: teacherRow } = await supabase
    .from('teachers')
    .select('available_hours, teacher_availability_ranges(day_of_week, start_time, end_time)')
    .eq('name', continueTeacher)
    .single();

  const dayNum = Number(continueDay);
  const isNumericDay = !isNaN(dayNum) && String(dayNum) === String(continueDay);
  let free;

  if (isNumericDay) {
    const range = (teacherRow?.teacher_availability_ranges || [])
      .find(r => r.day_of_week === dayNum);
    if (range?.start_time && range?.end_time) {
      const [sh, sm] = range.start_time.split(':').map(Number);
      const [eh, em] = range.end_time.split(':').map(Number);
      free = (eh * 60 + em) - (sh * 60 + sm) - usedMins;
    }
  } else {
    free = freeMinutesOnDay(teacherRow?.available_hours || {}, continueDay, usedMins);
  }

  if (free != null && free < lessonDuration) {
    initialStatus = 'רשימת המתנה';
    adminNotes = (adminNotes ? adminNotes + ' | ' : '') +
      `⚠️ יום ${continueDay} מלא אצל ${continueTeacher} — הוכנס לרשימת המתנה`;
  }
}

// With:
if (selectedTeacher && selectedDay != null && selectedDay !== '') {
  const supabase = getSupabaseClient();
  const usedMap = await buildUsedMinutesMap(supabase);
  const lessonDuration = getLessonDuration(selectedCourse);
  const usedMins = usedMap[selectedTeacher]?.[selectedDay] || 0;

  const { data: teacherRow } = await supabase
    .from('teachers')
    .select('available_hours, teacher_availability_ranges(day_of_week, start_time, end_time)')
    .eq('name', selectedTeacher)
    .single();

  const dayNum = Number(selectedDay);
  const isNumericDay = !isNaN(dayNum) && String(dayNum) === String(selectedDay);
  let free;

  if (isNumericDay) {
    const range = (teacherRow?.teacher_availability_ranges || [])
      .find(r => r.day_of_week === dayNum);
    if (range?.start_time && range?.end_time) {
      const [sh, sm] = range.start_time.split(':').map(Number);
      const [eh, em] = range.end_time.split(':').map(Number);
      free = (eh * 60 + em) - (sh * 60 + sm) - usedMins;
    }
  } else {
    free = freeMinutesOnDay(teacherRow?.available_hours || {}, selectedDay, usedMins);
  }

  if (free != null && free < lessonDuration) {
    initialStatus = 'רשימת המתנה';
    adminNotes = (adminNotes ? adminNotes + ' | ' : '') +
      `⚠️ יום ${selectedDay} מלא אצל ${selectedTeacher} — הוכנס לרשימת המתנה`;
  }
}
```

- [ ] **Step 3: Update auto-assign logic**

Find lines around 186. Replace:

```js
// Replace:
const autoAssign = type === 'continue' && continueTeacher;
if (autoAssign && initialStatus !== 'רשימת המתנה') initialStatus = 'שובץ';

// With:
const autoAssign = type === 'continue' && selectedTeacher;
if (autoAssign && initialStatus !== 'רשימת המתנה') initialStatus = 'שובץ';
```

- [ ] **Step 4: Update Supabase insert**

In the insert block (around line 193), replace:

```js
// Replace:
teacher: continueTeacher || null,
assigned_day: continueDay || null,
assigned_time: continueTime || null,

// With:
teacher: selectedTeacher || null,
assigned_day: selectedDay || null,
assigned_time: selectedTime || null,
```

- [ ] **Step 5: Manual verification**

Submit a test registration as a "ממשיך" student with a teacher and day selected. In Supabase Studio → registrations, confirm the `teacher`, `assigned_day`, and `assigned_time` columns are populated correctly.

- [ ] **Step 6: Commit**

```bash
git add app/api/register/route.js
git commit -m "refactor: rename continueTeacher/Day/Time to selectedTeacher/Day/Time in register API"
```

---

## Task 6: Update RegistrationForm — detection fallback, adult flow, visibility

**Files:**
- Modify: `components/RegistrationForm.jsx`

- [ ] **Step 1: Update teacher detection to fall back to `courses` array**

Find the teacher-detection `useEffect` (updated in Task 4, Step 2). Replace the detection logic:

```js
useEffect(() => {
  if (!form.selectedCourse) {
    update('selectedTeacher', '');
    update('selectedDay', '');
    update('selectedTime', '');
    return;
  }
  const matched =
    teachersList.find((t) => form.selectedCourse.includes(t.name)) ||
    teachersList.find((t) => (t.courses || []).includes(form.selectedCourse));
  update('selectedTeacher', matched?.name || '');
  update('selectedDay', '');
  update('selectedTime', '');
}, [form.selectedCourse, teachersList]);
```

- [ ] **Step 2: Update adult flow to use course step**

Find the `FLOWS` constant (around line 54). Change the `adult` entry:

```js
// Replace:
adult:    ['personal', 'instrument', 'agreement'],

// With:
adult:    ['personal', 'course',     'agreement'],
```

- [ ] **Step 3: Update availability block visibility condition**

Find the availability block condition (around line 527). It currently reads:

```js
{(form.type === 'continue' || form.type === 'new') && form.continueTeacher && (() => {
```

After the Task 4 rename it reads:

```js
{(form.type === 'continue' || form.type === 'new') && form.selectedTeacher && (() => {
```

Replace with:

```js
{['continue', 'new', 'adult'].includes(form.type) &&
  !(form.type === 'new' && form.attendedOpenDay === false) &&
  form.selectedTeacher && (() => {
```

- [ ] **Step 4: Manual verification — "ממשיך" still works**

Run `npm run dev`. Open `/register`, pick "ממשיך", select a course with a known teacher (e.g. "פסנתר מרינה 45 דק'"). Confirm available days appear.

- [ ] **Step 5: Manual verification — "בוגר" shows course step and availability**

On `/register`, pick "בוגר". Confirm the flow is now: פרטים → קורס → הסכם (no instrument step). Select a course. Confirm the available days appear for the detected teacher.

- [ ] **Step 6: Manual verification — course→teacher via `courses` array (using פנינה as demo)**

In Supabase Studio: find teacher פנינה. Set her `courses` to `["הזמיר"]` (or any course without her name). In admin → Teachers → Edit פנינה, confirm the courses checkbox shows "הזמיר" selected.

Open `/register` as a "ממשיך" student. Select "קבוצות והרכבים" → "הזמיר". Confirm פנינה's available days appear.

- [ ] **Step 7: Manual verification — "מתחיל" without open day has no teacher section**

On `/register`, pick "מתחיל", answer "לא" to open day question. Confirm the registration goes to the interview scheduling screen — no course/teacher step shown.

- [ ] **Step 8: Manual verification — "מתחיל" with open day shows teacher availability**

Pick "מתחיל", answer "כן" to open day. In the course step, select a course with a teacher. Confirm available days appear.

- [ ] **Step 9: Commit**

```bash
git add components/RegistrationForm.jsx
git commit -m "feat: expand teacher availability to adult flow, add courses[] fallback detection"
```

---

## Self-Review Notes

- **Spec coverage:** All 3 spec sections covered: DB column ✓, admin UI ✓, form flows + detection + visibility ✓
- **Field renames:** `selectedTeacher/selectedDay/selectedTime` used consistently across Tasks 4 and 5
- **Adult flow:** instrument step removed, course step added — `instruments` array will be empty for adult registrations (acceptable per spec)
- **Trial type:** intentionally excluded from teacher selection per spec
- **Melodies type:** no change — course step exists but visibility condition excludes it (`['continue','new','adult']`)
