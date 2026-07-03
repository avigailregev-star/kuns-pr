# Netanel Yahya — Day Filtering for Melodies Courses

**Date:** 2026-07-03
**Status:** Approved

## Summary

[[netanel-yahya-day-filter-design]] added exact-string day filtering for נתנאל יחיא's two regular courses ("תופים- נתנאל יחיא 45 דק'" → Sun+Thu, "גיטרה- נתנאל יחיא 45 דק'" → Mon+Tue). That design explicitly scoped out the מנגינות (melodies) flow because it didn't show the day-picker at all at the time.

Since then, commit `30cf103` ("fix: show teacher availability days for melodies registrations") made the day-picker render for melodies registrations too. But it only widened the `includes` check that controls whether the block renders — it didn't touch the filtering logic. Result: for all 6 of נתנאל יחיא's melodies course variants (שנה ב'/ג'/ד', each with a guitar and a drums/percussion version — see `lib/paymentLinks.js`), the exact-match lookup in `TEACHER_COURSE_DAY_FILTER` finds no entry, so the filter no-ops and all 4 of his days (Sun, Mon, Tue, Thu) are shown regardless of which instrument was selected.

This design fixes the filter to cover melodies courses too, and to be resilient to future melodies course variants (new school years) without requiring a new hardcoded entry each time.

## Code Fix (`lib/teacherCourseDayFilter.js`)

Replace the exact-match map lookup with keyword matching scoped to this teacher:

- If `selectedCourse` does not contain "נתנאל יחיא", return `ranges` unchanged (no effect on any other teacher).
- Else if it contains "גיטרה" → allowed days are Monday+Tuesday (`[1, 2]`).
- Else if it contains "תופים", "דג'מבה", or "כלי הקשה" → allowed days are Sunday+Thursday (`[0, 4]`).
- Else (shouldn't happen given current course naming, but keeps the function total) → return `ranges` unchanged.

This covers both regular course names and all current/future מנגינות variants, since every one of his course names includes his name plus an instrument keyword.

`TEACHER_COURSE_DAY_FILTER` as an exported map is removed; the day values become local constants inside the module. `filterRangesByCourse(ranges, selectedCourse)` keeps its exact signature and behavior for all callers (`components/RegistrationForm.jsx` lines 156 and 626 — unchanged).

## Test Fix (`lib/teacherCourseDayFilter.test.js`)

Existing tests assert against the now-removed `TEACHER_COURSE_DAY_FILTER` export and only cover the two regular course names. Update to:
- Drop the `TEACHER_COURSE_DAY_FILTER` import/assertion.
- Keep the existing regular-course and other-teacher (`"פסנתר- מרינה גוטמן 45 דק'"`) cases — behavior is unchanged for these.
- Add cases for melodies course names, e.g. `"מנגינות שנה ב' - גיטרה- נתנאל יחיא"` → Mon+Tue only, `"מנגינות שנה ג' - דג'מבה- נתנאל יחיא"` → Sun+Thu only, `"מנגינות שנה ד' - דג'מבה וכלי הקשה- נתנאל יחיא"` → Sun+Thu only.

## Out of Scope

- No change to `components/RegistrationForm.jsx` — it already calls `filterRangesByCourse` correctly; only the filter's internal matching logic changes.
- No change to the Supabase data (`teacher_availability_ranges` rows) — that was already fixed in the prior design.
- No change to teacher-matching logic in the melodies flow (how נתנאל יחיא is offered as a teacher option for melodies courses) — out of scope, this design only concerns which days are shown once he's selected.
