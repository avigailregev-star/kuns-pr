# Close a Teacher's Day to New Registrations

**Date:** 2026-07-14
**Status:** Approved

## Summary

Admins need a way to stop new students from being able to register into a specific day of a teacher's schedule (e.g. a teacher whose Sunday/Tuesday/Thursday slots are effectively full) — without deleting that day's availability range, and without affecting the admin panel's ability to assign or edit already-registered students on that same day.

Today the only way to close a day is to delete its `teacher_availability_ranges` row entirely (via `components/TeacherForm.jsx` "זמינות מדויקת"), which also removes the day from the admin "שיבוץ" (assignment) day-picker in `components/AdminTable.jsx`, and — if it's the teacher's last remaining range — degrades that picker to an unrestricted free-text fallback. This is a general capability for all teachers, not scoped to one teacher.

## Part 1: Data Model

Add a boolean column to `teacher_availability_ranges`:

```sql
ALTER TABLE teacher_availability_ranges ADD COLUMN IF NOT EXISTS closed_for_registration boolean NOT NULL DEFAULT false;
```

Recorded in `supabase-schema.sql` alongside the existing `max_students` entry.

This flag lives per day-range row (teacher + day), so a teacher can have some days open and others closed independently, without touching `start_time`/`end_time`.

## Part 2: Admin UI (`components/TeacherForm.jsx`)

Under "זמינות מדויקת" (lines 175-203), each active day row (`isOn` block, lines 189-198) gets an added checkbox:

```
[✓] סגור להרשמות חדשות
```

State is stored per day alongside `start_time`/`end_time` in the existing `availabilityRanges` map (`{ start_time, end_time, closed_for_registration }`). On submit, `closed_for_registration` is included in each entry of the `availability_ranges` array sent to the save handler (currently built at lines 106-108).

## Part 3: Persistence (`app/api/teachers/[id]/route.js`, `app/api/teachers/route.js`)

Both the `PUT` (edit, `[id]/route.js:38-47`) and `POST` (create, `route.js:56-64`) handlers include `closed_for_registration: r.closed_for_registration ?? false` in the row objects inserted into `teacher_availability_ranges`. The `PUT` handler's existing delete-then-reinsert pattern is unchanged otherwise.

The `GET` handler in `app/api/teachers/route.js:14` (used to populate `TeacherForm` when editing) adds `closed_for_registration` to its `teacher_availability_ranges(...)` select, so the checkbox reflects the saved state.

## Part 4: Public Registration Form (`components/RegistrationForm.jsx`)

A day with `closed_for_registration = true` is treated identically to a capacity-full day — same "מלא" badge, same disabled button, no special-cased message:

- `selectedTeacherAllFull` (line 148-166): the `ranges.every(...)` predicate at line 160 becomes `... || s.closed_for_registration`.
- Day-picker buttons (line 642-684): `isFull` at line 652 becomes `freeMins < lessonDuration || s.closed_for_registration`.

`app/api/teachers/public/route.js` adds `closed_for_registration` to the `teacher_availability_ranges` select (line 21) and to the mapped range object (line 31) so the flag reaches the client.

If every active day for a teacher ends up closed and/or full, the existing "all days full → waiting list" messaging (line 686-689) applies unchanged.

## Part 5: Server-Side Enforcement (`app/api/register/route.js`)

Mirrors the existing capacity double-check (design doc `2026-05-02-day-capacity-design.md`, Part 3) so the flag can't be bypassed by submitting directly to the API:

- Day-specific check (lines 148-181): the `teacher_availability_ranges` select at line 156 adds `closed_for_registration`; if the matched range has `closed_for_registration = true`, force `initialStatus = 'רשימת המתנה'` the same way a capacity-full day does (regardless of `free` minutes).
- All-days-full check (lines 184-223): the select at line 188 adds `closed_for_registration`; the per-range loop (lines 201-207) treats `r.closed_for_registration` as equivalent to "not enough free minutes" when deciding `allFull`.

## Part 6: Admin Assignment Flow — Explicitly Unchanged

`components/AdminTable.jsx`'s "שיבוץ" section (assigning/editing already-registered students, lines 718-1189) is **not modified**. It continues to compute day availability purely from real capacity (`used_minutes_per_day` vs. range duration) and ignores `closed_for_registration` entirely. This is intentional: closing a day to new registrations must never block staff from assigning or re-scheduling students who are already in the system.

## Out of Scope

- No change to `lib/teacherCourseDayFilter.js` (Netanel Yahya's per-course day filter) — orthogonal and composes fine with this flag.
- No UI indicator in `AdminTable.jsx` showing that a day is closed to new registrations (could be added later if useful, not required now).
- No bulk "close all days" action — each day is toggled individually, consistent with how ranges are already managed one day at a time.
