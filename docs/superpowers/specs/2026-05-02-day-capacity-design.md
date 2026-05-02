# Day Capacity Feature — Design Spec
Date: 2026-05-02

## Goal
When a parent or admin selects a lesson day for a teacher, the system shows which days are available and which are full — based on the teacher's available hours and already-scheduled lessons.

---

## Part 1: Data Source

### Lesson Duration
Extracted from the course name string:
- Contains "60" → 60 minutes
- Otherwise → 45 minutes (default)

```js
function getLessonDuration(courseName) {
  if (!courseName) return 45;
  if (courseName.includes('60')) return 60;
  return 45;
}
```

### API Enrichment
Both `/api/teachers/public` and `/api/teachers` will return an additional field per teacher:

```json
"used_minutes_per_day": { "א": 90, "ג": 135, "ה": 45 }
```

**How it's calculated (server-side):**
1. Query `registrations` table for all active registrations with `assigned_day` and `teacher` set
2. Exclude statuses: `בוטל`, `ממתין לשיחת היכרות`, `רשימת המתנה`
3. For each registration, extract lesson duration from `selected_course`
4. Sum durations grouped by teacher name + assigned day

### "Full" Definition
A day is **full** for a given lesson duration when:
```
total_minutes(available_hours[day]) - used_minutes_per_day[day] < lesson_duration
```
Where `total_minutes(from, to)` = `(to_hours * 60 + to_minutes) - (from_hours * 60 + from_minutes)`

---

## Part 2: UI

### Day Buttons (Registration Form + Admin Panel)
Same component behavior in both places:

| State | Appearance |
|---|---|
| Available | Normal button, shows minutes remaining (e.g. "75 דק' פנויות") |
| Full | Grey/disabled button, shows "מלא", not clickable |
| No hours configured | Not shown at all |

**When course is not yet selected** (duration unknown): use 45 min as default to determine if a day is full.

### Registration Form
- Teacher data already fetched from `/api/teachers/public`
- After teacher is selected, day buttons render with availability state derived from `used_minutes_per_day` and `available_hours`

### Admin Panel
- Teacher data fetched from `/api/teachers`
- Same day button rendering with availability state

---

## Part 3: Server-Side Race Condition Protection

Even if the UI shows a day as available, two families may submit simultaneously. The `/api/register` endpoint performs a final check:

1. If `continueDay` is set in the submission → re-calculate used minutes from DB in real time
2. Compare against teacher's `available_hours[continueDay]` and the lesson duration from `selectedCourse`
3. If the day is full at time of submission:
   - Save registration with `status = 'רשימת המתנה'`
   - Add `admin_notes`: `⚠️ יום [X] מלא אצל [מורה] — הוכנס לרשימת המתנה`
4. If no day selected → skip capacity check (business as usual)

---

## Files to Change

| File | Change |
|---|---|
| `app/api/teachers/public/route.js` | Add `used_minutes_per_day` to each teacher |
| `app/api/teachers/route.js` | Add `used_minutes_per_day` to each teacher |
| `lib/lessonDuration.js` | New utility: `getLessonDuration(courseName)` |
| `components/RegistrationForm.jsx` | Update day buttons to show availability state |
| `components/AdminTable.jsx` | Update day buttons to show availability state |
| `app/api/register/route.js` | Add server-side capacity check on submission |
