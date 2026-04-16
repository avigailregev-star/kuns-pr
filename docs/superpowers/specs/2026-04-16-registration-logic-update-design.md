# Registration Logic Update — Design Spec
**Date:** 2026-04-16  
**Status:** Approved

---

## Overview

Update the conservatory registration system with four interconnected features:
1. Teacher quota management (max students) with waiting list auto-assignment
2. Student availability matching against teacher schedules
3. Conditional תזמורת (orchestra) checkbox
4. Open Day gate for new students with interview scheduling

---

## 1. Database Schema Changes

### `teachers` table — new columns
| Column | Type | Description |
|---|---|---|
| `max_students` | `integer` | Max students this teacher can take. NULL = no limit |
| `weekly_hours_quota` | `numeric` | Reserved for future use. NULL by default |

### `registrations` table — new columns
| Column | Type | Description |
|---|---|---|
| `orchestra` | `boolean` | Student confirmed תזמורת participation |
| `attended_open_day` | `boolean` | Whether new student attended the Open Day (NULL for non-new types) |

### New valid `status` values
- `רשימת המתנה` — all matching teachers are at capacity
- `ממתין לשיחת היכרות` — new student who did not attend Open Day

### Migration SQL (run once in Supabase SQL Editor)
```sql
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS max_students integer;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS weekly_hours_quota numeric;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS orchestra boolean;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS attended_open_day boolean;
```

---

## 2. Registration Form — Frontend Changes

### 2a. Open Day Gate (personal step, `type === 'new'` only)

A yes/no question appears: **"האם השתתפת ביום הפתוח?"**

**If YES:** continue normal flow unchanged.

**If NO:** the form replaces its body with a dedicated "Schedule Interview" view:
- Message: *"כדי להירשם, יש לקיים תחילה שיחת היכרות עם המזכירה. אנא בחר/י מועד מועדף:"*
- Slot picker (reuses existing `SLOT_OPTIONS`)
- Submit button → `POST /api/register` with:
  - `status = 'ממתין לשיחת היכרות'`
  - `attended_open_day = false`
  - `preferredSlot` = chosen slot
- Redirects to `/thank-you` with interview-specific message

This prevents the student from proceeding with the full form until the interview is completed (handled offline by admin).

### 2b. תזמורת Checkbox

Shown for all registration types **except** when `selectedCourse` contains `"שנה א'"`.

- Label: **"אני מאשר/ת השתתפות בתזמורת"**
- Required (validation blocks next step if unchecked)
- Stored as `orchestra: true` in the registration

**Placement by type:**
- `new`, `adult`, `trial` → appears in the **instrument step** (after instrument selection)
- `continue` → appears in the **course step** (these students skip the instrument step)
- `melodies` with שנה ב'/ג' → appears in the **course step**
- `melodies` with שנה א' → **hidden entirely**, no validation applied

---

## 3. Backend Logic — `POST /api/register`

### 3a. Open Day early exit
If `type === 'new'` and `attended_open_day === false`:
- Skip all quota and availability checks
- Save registration with `status = 'ממתין לשיחת היכרות'`
- Return success immediately

### 3b. Quota check (applies to `new`, `adult`, `trial` only — NOT `continue`)

**Continuing students are fully exempt from quota checks.** They retain their slot with their previous teacher even if that teacher is at capacity. Continuing students are also not counted against a teacher's quota — their slots are considered pre-reserved.

Algorithm for non-continuing students:
1. Take `instruments[0]` from the registration
2. Fetch all teachers where `instrument_type` matches
3. For each teacher, count students where `teacher = teacher.name` AND `type != 'continue'` AND `status NOT IN ('בוטל', 'ממתין לשיחת היכרות')`
4. If at least one teacher has `assigned_count < max_students` (or `max_students IS NULL`) → proceed with status `חדש`
5. If all teachers are full, or no teacher exists for this instrument → set `status = 'רשימת המתנה'`

### 3c. Availability matching (applies to `new`, `adult`, `trial` only)

Performed after quota check, only when status is `חדש`.

- Parse student's `preferredSlot` text (e.g., `"ימי ב' בין 15:00–18:00"`) using a regex to extract:
  - Day letter: `"ב"`
  - Time range: `{ from: "15:00", to: "18:00" }`
- For each teacher with matching instrument: check if their `available_days` includes that day AND their `available_hours[day].from` < slot.to AND `available_hours[day].to` > slot.from (standard interval overlap)
- If no teacher has a matching overlap → append note to `admin_notes`: `"⚠️ אין חפיפה בין זמינות התלמיד לזמינות המורים"`
- Registration is saved regardless — this is a warning, not a blocker

---

## 4. Admin UI Changes

### 4a. TeacherForm
- New field: **"מכסת תלמידים מקסימאלית"** — integer input, optional. Empty = no limit.
- `weekly_hours_quota` field exists in DB but is not exposed in UI (ready for future feature).

### 4b. TeachersTab
- New column: **"תלמידים"** — displays `X / max` (e.g., "7 / 10"). Shows "ללא מכסה" if `max_students` is NULL.

### 4c. AdminTable / StatusSelect
- Add `רשימת המתנה` and `ממתין לשיחת היכרות` as valid selectable statuses.
- Rows with `attended_open_day = false` display a badge: **"טרם שיחת היכרות"**

---

## 5. Component Boundaries

| Component / File | Change |
|---|---|
| `components/RegistrationForm.jsx` | Open Day gate, תזמורת checkbox, form state additions |
| `components/TeacherForm.jsx` | Add `max_students` field |
| `components/TeachersTab.jsx` | Add תלמידים column |
| `components/AdminTable.jsx` | Add badge for `attended_open_day`, new statuses |
| `components/StatusSelect.jsx` | Add new status values |
| `app/api/register/route.js` | Quota check, availability match, open day early exit |
| `app/api/teachers/public/route.js` | Return `available_days`, `available_hours`, `max_students` |
| `supabase-schema.sql` | Document new columns + migration SQL |

---

## 6. Out of Scope

- Real-time quota display during registration (student does not see capacity info)
- Automated email/WhatsApp for waiting list or interview scheduling
- `weekly_hours_quota` calculation (deferred to future)
- Admin UI for managing waiting list promotion
