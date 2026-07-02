# Netanel Yahya — Per-Course Day Filtering

**Date:** 2026-07-02
**Status:** Approved

## Summary

The teacher נתנאל יחיא teaches two different instruments on different days: drums (תופים) on Sunday and Thursday, guitar (גיטרה) on Monday and Tuesday. Today the registration form's day-picker shows a teacher's full set of availability days regardless of which course was selected, so a parent registering for drums sees guitar days too (and vice versa). His `teacher_availability_ranges` also has a stray Wednesday row that doesn't belong to either instrument.

This is a point fix scoped to this one teacher — not a general "instrument per availability day" feature for all teachers.

## Part 1: Data Fix (Supabase)

Delete the `teacher_availability_ranges` row for נתנאל יחיא where `day_of_week = 3` (Wednesday). Remaining rows after the fix: Sunday(0), Monday(1), Tuesday(2), Thursday(4). No Friday row is added — he does not work Fridays.

## Part 2: Code Fix (`components/RegistrationForm.jsx`)

Add a scoped constant, following the same pattern as the existing `FIXED_COURSE_DAYS` map:

```js
const TEACHER_COURSE_DAY_FILTER = {
  "תופים- נתנאל יחיא 45 דק'": [0, 4], // ראשון, חמישי
  "גיטרה- נתנאל יחיא 45 דק'": [1, 2], // שני, שלישי
};
```

Add a helper that filters a teacher's `teacher_availability_ranges` down to the allowed `day_of_week` values when the selected course has an entry in this map; returns the ranges unchanged otherwise (no effect on any other teacher or course).

Apply this helper in both places `teacher_availability_ranges` is read for this UI:
1. The "all days full" check (`selectedTeacherAllFull`, ~line 155).
2. The day-picker buttons themselves (~line 625, `availRanges`).

## Out of Scope

- No schema change (no new column on `teacher_availability_ranges`).
- No change to how other teachers' availability is computed or displayed.
- No change to the melodies (מנגינות) flow — it doesn't show this day-picker at all today.
