# Registration consistency: melodies incident (2026-09-17)

## What happened

- Legacy attendance groups used `melodies_group`, although melodies lessons are individual lessons. The registrations table placed these rows under ensemble while other scheduling paths treated them differently.
- A course title retained a former teacher's name after the actual teacher and group teacher changed. A course title is not an authoritative teacher assignment.
- The add-individual action immediately created a blank registration, making an existing lesson appear missing.
- Deleting that blank row directly in the database also cleared two related assignments. The database-side cause has **not** been identified. Both assignments were restored from the registration history and independently verified. Do not bypass the application deletion guard or enable `REGISTRATION_DELETE_AUDIT_READY` until the database behavior is understood and a transactional integration test proves that deleting one row cannot change siblings.
- A code push was initially mistaken for a completed production deployment. Production was later deployed directly and the alias was verified.

## Invariants

1. The teacher is determined by `registrations.teacher` and the linked group's `teacher_id`, never by a teacher name embedded in `selected_course` or `groups.name`.
2. `melodies_individual` and legacy `melodies_group` both mean an individual 45-minute lesson in all UI, scheduling and conflict checks. New attendance groups use `melodies_individual`.
3. Creating another individual lesson when one is already assigned requires explicit confirmation.
4. Permanent deletion stays disabled until its effects on linked and same-student registrations are verified at the database level.
5. A change is considered published only after the production deployment is READY and the production alias points to it.

## Read-only production audit

The 2026-09-17 scan covered 357 registration rows and found: one title containing a different teacher's name, one blank individual lesson, one registration pointing to a missing group, and three registration/group title mismatches. These are review candidates, not automatically correctable records. No other student's data was changed during the scan.

Before correcting a candidate, confirm the intended teacher, day, time and lesson with the administrator; then update only the specific row/group and recheck siblings. For any deletion, take a recoverable snapshot and verify every related assignment afterward. Never use a direct database delete as a workaround for the application guard.
