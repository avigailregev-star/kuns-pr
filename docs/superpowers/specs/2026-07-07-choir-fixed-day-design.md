# Choir Registration — Fixed Day (No Day Choice)

**Date:** 2026-07-07
**Status:** Approved

## Summary

Choir courses meet on one fixed weekday — there's nothing to choose, only whether to register. Today only "מקהלת צעירים ב-ו" is treated this way (via the `FIXED_COURSE_DAYS` map in `components/RegistrationForm.jsx`, which shows a static "יום השיעור הקבוע: יום X" line instead of a day-picker). "הזמיר" has no entry, so both the public registration form and the admin's manual day/time assignment table show it with a full day-picker, as if a parent/admin could pick from several days — even though the teacher's other availability days belong to unrelated lessons, not the choir.

This fix:
1. Adds "הזמיר" (Monday) to the fixed-day map, alongside the existing "מקהלת צעירים ב-ו" (Wednesday).
2. Shares that map between the registration form and the admin table, so the admin's assignment UI also collapses to the single correct day instead of listing every day the teacher happens to be available.
3. Displays the actual start/end time next to the fixed day, pulled from the teacher's real `teacher_availability_ranges` entry for that day — not duplicated as hardcoded hours — so the hours shown always match the teacher's profile.
4. Removes the stray `"מקהלה צעירה ייצוגית"` entry from `LESSON_TYPE_OPTIONS` in `lib/groupNaming.js` — not a real course, just a leftover label.

## Part 1: Shared fixed-day map (`lib/fixedCourseDays.js`, new file)

```js
export const FIXED_COURSE_DAYS = {
  "מקהלת צעירים ב-ו": 3, // יום רביעי
  "הזמיר": 1,             // יום שני
};
```

Values are `day_of_week` integers matching the convention already used across the codebase (0=ראשון … 6=שבת).

## Part 2: `components/RegistrationForm.jsx`

- Remove the local `FIXED_COURSE_DAYS` const; import it from `lib/fixedCourseDays.js` instead. No other logic changes — the existing `useEffect` that auto-sets `selectedDay` from this map, and the existing "fixed day" branch (~line 630), keep working as-is for both courses now.
- In the fixed-day display branch, look up the matching entry in `availRanges` (`availRanges.find(r => r.day_of_week === fixedDay)`) and, if found, render its `start_time`–`end_time` next to the day name (e.g. "יום רביעי, 17:00–18:30"). If no matching range exists on the teacher record, fall back to showing just the day name (today's behavior).

## Part 3: `components/AdminTable.jsx`

- Import `FIXED_COURSE_DAYS` from `lib/fixedCourseDays.js`.
- In the day-assignment picker (~line 668, where `availRanges` is built from `selectedTeacher?.teacher_availability_ranges`), when `FIXED_COURSE_DAYS[row.selected_course]` is set, filter `availRanges` down to just the entry whose `day_of_week` matches. This leaves exactly one button — with the teacher's real hours for that day already shown, and all existing capacity/fullness logic untouched — instead of one button per teacher availability day.
- No auto-assignment: the admin still clicks the (now single) day button to assign it, same interaction as today, just with only one valid choice instead of several.

## Part 4: `lib/groupNaming.js`

- Delete the line `{ label: 'מקהלה צעירה ייצוגית', value: 'choir' },` from `LESSON_TYPE_OPTIONS`. The three remaining choir labels (`מקהלה צעירה`, `הזמיר- מקהלה ייצוגית`, `מקהלת קולות הנגב`) stay untouched.

## Out of Scope

- No new admin UI for editing fixed days — this stays a hardcoded map, matching the existing pattern for "מקהלת צעירים ב-ו".
- "מקהלת קולות הנגב" is not currently a real registration option (absent from `COURSE_GROUPS`/`PAYMENT_LINKS`) and is not touched by this change — its schedule is still unknown.
- No change to how non-choir courses' day-pickers behave.
- No database changes.
