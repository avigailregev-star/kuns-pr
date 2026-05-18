# Teacher Availability Selection in Registration Form

**Date:** 2026-05-18  
**Status:** Approved

## Summary

Add teacher availability display to the parent-facing registration form. When a parent selects a course, the system auto-detects the teacher and shows available days. The parent selects a day (and time) as part of registration.

## Scope

Applies to all registration types **except** melodies:
- **ממשיך (continue)** — already partially works, will be extended
- **מתחיל (new)** — only if `attendedOpenDay === true`
- **בוגר (adult)** — flow updated to include course step
- **שיעור ניסיון (trial)** — excluded for now (short-term, lower priority)

## Part 1: Database & API

### Supabase
- Add `courses` column of type `JSONB` (default `[]`) to the `teachers` table.
- This stores course names that cannot be inferred from the teacher's name (e.g. "הזמיר", "אנסמבל מקאם שירה").

### Public Teachers API (`/api/teachers/public`)
- Add `courses` to the SELECT query alongside existing fields.

### Teacher Detection Logic (in RegistrationForm)
Two-step lookup for a given `selectedCourse`:
1. Check if any teacher's `name` appears inside the course string (existing behavior).
2. If not found, check if `selectedCourse` is in the teacher's `courses` array (new fallback).

## Part 2: Admin UI

### TeacherForm (`components/TeacherForm.jsx`)
- Add a **"קורסים משויכים"** multi-select field listing all courses from `COURSE_GROUPS` and `PAYMENT_LINKS` in `paymentLinks.js`.
- Only show courses whose name does **not** already contain the teacher's name (no need to manually assign "פסנתר מרינה" to מרינה).
- Selection is saved to the `courses` column in Supabase via the existing teacher CRUD API.

### Teacher API (`/api/teachers/[id]`)
- Accept and persist the `courses` field in PUT/PATCH requests.

## Part 3: Registration Form

### Flow Changes (`FLOWS` in RegistrationForm.jsx)
| Type | Before | After |
|------|--------|-------|
| adult | personal → instrument → agreement | personal → **course** → agreement |
| continue | personal → course → agreement | unchanged |
| new | personal → course → agreement | unchanged |
| trial | personal → instrument | unchanged (excluded) |
| melodies | personal → course → agreement | unchanged (no teacher selection) |

> **Note:** For adult type, the instrument step is replaced by the course step. The `instruments` field will not be populated for adult registrations — the instrument is implied by the course name.

### Field Renames
Replace `continueTeacher` / `continueDay` / `continueTime` with neutral names:
- `selectedTeacher`
- `selectedDay`
- `selectedTime`

Update all references throughout `RegistrationForm.jsx` and the submit payload in `/api/register`.

### Availability Block Visibility
Show the day-picker block when ALL of the following are true:
- `selectedTeacher` is set (teacher was detected from course)
- `form.type` is one of: `continue`, `new`, `adult`
- If `form.type === 'new'`, then `form.attendedOpenDay === true`

### Availability Block Behavior (unchanged)
The block already supports two data formats:
- **New system:** `teacher_availability_ranges` (day_of_week, start_time, end_time)
- **Old system:** `available_days` + `available_hours`

No changes needed to the display logic itself — only the visibility condition and field names change.

## Data Flow

```
Parent selects course
    → selectedCourse set in form state
    → useEffect: look up teacher by name-in-course OR courses[]
    → selectedTeacher set
    → Availability block renders with teacher's days
    → Parent clicks a day → selectedDay + selectedTime set
    → Form submits with selectedTeacher, selectedDay, selectedTime
```

## Out of Scope
- Automatic slot blocking after registration (future work)
- Trial type teacher selection
- Multiple teachers per course
