# Teacher + Lesson-Type Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 11-option lesson-type list with the corrected 16-option list matching real production group names, and make the "הוסף שיעור בנוכחות" (attach to existing lesson) picker show only the selected teacher's lessons of the selected type instead of every group in the system.

**Architecture:** `lib/groupNaming.js`'s `LESSON_TYPE_OPTIONS` constant is corrected in place (same exported shape, new content) — no consumer of its shape needs to change, only its data. `components/AdminTable.jsx` gains one new piece of per-row state, `groupTypeFilter`, that gates and filters the existing "attach to group" UI; the "create new lesson" mini-form's own type dropdown is removed since the type is now selected one level up.

**Tech Stack:** Next.js App Router, React (client component), Jest (`next/jest`).

## Global Constraints

- The 16-option list and label→internal-value mapping (copied verbatim from the spec) is the *only* correct list — this fully replaces the existing 11 options, it is not an addition:

  | Label | Internal value |
  |---|---|
  | פרטני 45 דקות | `individual_45` |
  | פרטני 60 דקות | `individual_60` |
  | שיעור זוגי אליטה | `elite_duet` |
  | מנגינות שנה ב | `melodies_individual` |
  | מנגינות שנה ג | `melodies_individual` |
  | מנגינות שנה ד | `melodies_individual` |
  | תיאוריה | `theory` |
  | מקהלה צעירה | `choir` |
  | מקהלה צעירה ייצוגית | `choir` |
  | הזמיר- מקהלה ייצוגית | `choir` |
  | מקהלת קולות הנגב | `choir` |
  | תזמורת נשיפה | `orchestra` |
  | תזמורת כלי קשת | `orchestra` |
  | אנסמבל מוזיקה מן המזרח א | `orchestra` |
  | אנסמבל מוזיקה מן המזרח ב | `orchestra` |
  | תזמורת מקאם דימונה | `orchestra` |

- Filtering the existing-lesson picker is an **exact string match** on `group.name` against the selected label, combined with `group.teacher_id` matching the selected teacher's id. No fuzzy/partial matching.
- No database migration, no renaming of existing groups — the filter relies on group names already matching these labels in production.
- `computeGroupName` and `getLessonTypeValue`'s function signatures do not change.

---

## Spec Reference

`docs/superpowers/specs/2026-07-06-teacher-lesson-type-filter-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/groupNaming.js` | Modified. `LESSON_TYPE_OPTIONS` content corrected to the 16-item list; functions unchanged. |
| `lib/groupNaming.test.js` | Modified. Assertions updated for the new list and its choir/orchestra groupings. |
| `components/AdminTable.jsx` | Modified. New `groupTypeFilter` state gates and filters the existing "attach to group" UI; the create-form's own type dropdown is removed; `handleCreateGroup` takes the type as a parameter instead of reading removed state. |

---

## Task 1: Correct the lesson-type list

**Files:**
- Modify: `lib/groupNaming.js`
- Test: `lib/groupNaming.test.js`

**Interfaces:**
- Produces: `LESSON_TYPE_OPTIONS` — same shape (`Array<{ label: string, value: string }>`), now 16 entries in the exact order from the Global Constraints table.
- `getLessonTypeValue` and `computeGroupName` signatures are unchanged; only the data they operate over changes.

- [ ] **Step 1: Update the failing tests**

Replace the entire contents of `lib/groupNaming.test.js` with:

```js
import { LESSON_TYPE_OPTIONS, getLessonTypeValue, computeGroupName } from './groupNaming';

describe('LESSON_TYPE_OPTIONS', () => {
  test('has exactly 16 options in the required order', () => {
    expect(LESSON_TYPE_OPTIONS.map(o => o.label)).toEqual([
      'פרטני 45 דקות',
      'פרטני 60 דקות',
      'שיעור זוגי אליטה',
      'מנגינות שנה ב',
      'מנגינות שנה ג',
      'מנגינות שנה ד',
      'תיאוריה',
      'מקהלה צעירה',
      'מקהלה צעירה ייצוגית',
      'הזמיר- מקהלה ייצוגית',
      'מקהלת קולות הנגב',
      'תזמורת נשיפה',
      'תזמורת כלי קשת',
      'אנסמבל מוזיקה מן המזרח א',
      'אנסמבל מוזיקה מן המזרח ב',
      'תזמורת מקאם דימונה',
    ]);
  });
});

describe('getLessonTypeValue', () => {
  test('maps individual durations to their own values', () => {
    expect(getLessonTypeValue('פרטני 45 דקות')).toBe('individual_45');
    expect(getLessonTypeValue('פרטני 60 דקות')).toBe('individual_60');
  });

  test('maps all four choir groups to the same "choir" value', () => {
    expect(getLessonTypeValue('מקהלה צעירה')).toBe('choir');
    expect(getLessonTypeValue('מקהלה צעירה ייצוגית')).toBe('choir');
    expect(getLessonTypeValue('הזמיר- מקהלה ייצוגית')).toBe('choir');
    expect(getLessonTypeValue('מקהלת קולות הנגב')).toBe('choir');
  });

  test('maps all five orchestra/ensemble groups to the same "orchestra" value', () => {
    expect(getLessonTypeValue('תזמורת נשיפה')).toBe('orchestra');
    expect(getLessonTypeValue('תזמורת כלי קשת')).toBe('orchestra');
    expect(getLessonTypeValue('אנסמבל מוזיקה מן המזרח א')).toBe('orchestra');
    expect(getLessonTypeValue('אנסמבל מוזיקה מן המזרח ב')).toBe('orchestra');
    expect(getLessonTypeValue('תזמורת מקאם דימונה')).toBe('orchestra');
  });

  test('maps the three melodies years to the same "melodies_individual" value', () => {
    expect(getLessonTypeValue('מנגינות שנה ב')).toBe('melodies_individual');
    expect(getLessonTypeValue('מנגינות שנה ג')).toBe('melodies_individual');
    expect(getLessonTypeValue('מנגינות שנה ד')).toBe('melodies_individual');
  });

  test('maps theory and elite duet', () => {
    expect(getLessonTypeValue('תיאוריה')).toBe('theory');
    expect(getLessonTypeValue('שיעור זוגי אליטה')).toBe('elite_duet');
  });

  test('returns null for an unknown label', () => {
    expect(getLessonTypeValue('לא קיים')).toBeNull();
  });
});

describe('computeGroupName', () => {
  test('one student: appends the student name to the type label', () => {
    expect(computeGroupName('פרטני 45 דקות', ['יוסי כהן'])).toBe('פרטני 45 דקות - יוסי כהן');
  });

  test('multiple students: returns the type label alone', () => {
    expect(computeGroupName('מקהלה צעירה', ['יוסי כהן', 'שרה לוי', 'מיכל אברהם'])).toBe('מקהלה צעירה');
  });

  test('no students: returns the type label alone without throwing', () => {
    expect(computeGroupName('תזמורת נשיפה', [])).toBe('תזמורת נשיפה');
  });

  test('filters out empty/falsy names before counting', () => {
    expect(computeGroupName('פרטני 60 דקות', ['', 'יוסי כהן', null])).toBe('פרטני 60 דקות - יוסי כהן');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest lib/groupNaming.test.js`
Expected: FAIL — the `LESSON_TYPE_OPTIONS` order/labels assertion fails (still has the old 11-item list), and several `getLessonTypeValue` assertions fail (e.g. `getLessonTypeValue('מקהלה צעירה')` is `null` since that label doesn't exist yet).

- [ ] **Step 3: Update `lib/groupNaming.js`**

Replace the `LESSON_TYPE_OPTIONS` array (lines 1-13) with:

```js
export const LESSON_TYPE_OPTIONS = [
  { label: 'פרטני 45 דקות', value: 'individual_45' },
  { label: 'פרטני 60 דקות', value: 'individual_60' },
  { label: 'שיעור זוגי אליטה', value: 'elite_duet' },
  { label: 'מנגינות שנה ב', value: 'melodies_individual' },
  { label: 'מנגינות שנה ג', value: 'melodies_individual' },
  { label: 'מנגינות שנה ד', value: 'melodies_individual' },
  { label: 'תיאוריה', value: 'theory' },
  { label: 'מקהלה צעירה', value: 'choir' },
  { label: 'מקהלה צעירה ייצוגית', value: 'choir' },
  { label: 'הזמיר- מקהלה ייצוגית', value: 'choir' },
  { label: 'מקהלת קולות הנגב', value: 'choir' },
  { label: 'תזמורת נשיפה', value: 'orchestra' },
  { label: 'תזמורת כלי קשת', value: 'orchestra' },
  { label: 'אנסמבל מוזיקה מן המזרח א', value: 'orchestra' },
  { label: 'אנסמבל מוזיקה מן המזרח ב', value: 'orchestra' },
  { label: 'תזמורת מקאם דימונה', value: 'orchestra' },
];
```

Leave `getLessonTypeValue` and `computeGroupName` (the rest of the file) exactly as they are — they don't reference specific labels, only the shared shape.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest lib/groupNaming.test.js`
Expected: PASS — 8 tests passed

- [ ] **Step 5: Commit**

```bash
git add lib/groupNaming.js lib/groupNaming.test.js
git commit -m "fix: correct lesson-type list to match real production group names"
```

---

## Task 2: Filter the existing-lesson picker by teacher + type

**Files:**
- Modify: `components/AdminTable.jsx`

**Interfaces:**
- Consumes: `LESSON_TYPE_OPTIONS` (Task 1's corrected list — no code-level change needed here, the component already imports it).
- Produces: no new exports — this is a leaf UI change. Internally, `handleCreateGroup`'s signature changes from `(rowId, teacherName, assignedDay, assignedTime)` to `(rowId, teacherName, assignedDay, assignedTime, groupType)` — every call site of `handleCreateGroup` in this file must be updated to pass the 5th argument.

- [ ] **Step 1: Add the `groupTypeFilter` state**

Find this line (currently around line 127):

```js
  const [newGroupType, setNewGroupType] = useState('');
```

Replace it with:

```js
  const [groupTypeFilter, setGroupTypeFilter] = useState({}); // { [rowId]: label }
```

- [ ] **Step 2: Update `handleCreateGroup` to take the type as a parameter**

Find the function (currently starting around line 253):

```js
  async function handleCreateGroup(rowId, teacherName, assignedDay, assignedTime) {
    if (!newGroupType || newGroupStudents.length === 0) return;
    const teacher = teachers.find(t => t.name === teacherName);
    if (!teacher?.id) {
      alert('יש לבחור מורה לפני יצירת קבוצה');
      return;
    }
    const groupName = computeGroupName(newGroupType, newGroupStudents.map(s => s.name));
    const lessonTypeValue = getLessonTypeValue(newGroupType);
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: groupName,
        lesson_type: lessonTypeValue,
        teacher_id: teacher.id,
        assigned_day: assignedDay ?? null,
        assigned_time: assignedTime ?? null,
        student_registration_ids: newGroupStudents.map(s => s.id),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error || 'שגיאה ביצירת קבוצה');
      return;
    }
    setGroups(prev => [...prev, json.data].sort((a, b) => a.name.localeCompare(b.name, 'he')));
    setSelectedGroups(prev => ({ ...prev, [rowId]: String(json.data.id) }));
    setCreatingGroupFor(null);
    setNewGroupStudents([]);
    setStudentSearchQuery('');
    setNewGroupType('');
    await fetchData();
  }
```

Replace it with:

```js
  async function handleCreateGroup(rowId, teacherName, assignedDay, assignedTime, groupType) {
    if (!groupType || newGroupStudents.length === 0) return;
    const teacher = teachers.find(t => t.name === teacherName);
    if (!teacher?.id) {
      alert('יש לבחור מורה לפני יצירת קבוצה');
      return;
    }
    const groupName = computeGroupName(groupType, newGroupStudents.map(s => s.name));
    const lessonTypeValue = getLessonTypeValue(groupType);
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: groupName,
        lesson_type: lessonTypeValue,
        teacher_id: teacher.id,
        assigned_day: assignedDay ?? null,
        assigned_time: assignedTime ?? null,
        student_registration_ids: newGroupStudents.map(s => s.id),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error || 'שגיאה ביצירת קבוצה');
      return;
    }
    setGroups(prev => [...prev, json.data].sort((a, b) => a.name.localeCompare(b.name, 'he')));
    setSelectedGroups(prev => ({ ...prev, [rowId]: String(json.data.id) }));
    setCreatingGroupFor(null);
    setNewGroupStudents([]);
    setStudentSearchQuery('');
    await fetchData();
  }
```

(Only three things changed: the parameter list gained `groupType`, the two `newGroupType` reads became `groupType`, and the trailing `setNewGroupType('');` line is gone since that state no longer exists.)

- [ ] **Step 3: Replace the selection UI block**

Find this entire block verbatim (currently lines 916-1056 — from the opening `{creatingGroupFor === row.id ? (` through the closing `)}` of that whole ternary expression, which includes the "attach to existing group" select, the delete-button, and their shared closing braces):

```jsx
                              {creatingGroupFor === row.id ? (
                                <div className="space-y-2">
                                  <select
                                    autoFocus
                                    className="admin-input w-full"
                                    value={newGroupType}
                                    onChange={(e) => setNewGroupType(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Escape') {
                                        setCreatingGroupFor(null);
                                        setNewGroupStudents([]);
                                        setStudentSearchQuery('');
                                        setNewGroupType('');
                                      }
                                    }}
                                  >
                                    <option value="">— סוג שיעור —</option>
                                    {LESSON_TYPE_OPTIONS.map(o => (
                                      <option key={o.label} value={o.label}>{o.label}</option>
                                    ))}
                                  </select>

                                  <div className="flex flex-wrap gap-1">
                                    {newGroupStudents.map(s => (
                                      <span
                                        key={s.id}
                                        className="inline-flex items-center gap-1 text-xs bg-purple-50 border border-purple-200 text-purple-700 rounded-lg px-2 py-1"
                                      >
                                        {s.name}
                                        <button
                                          type="button"
                                          onClick={() => setNewGroupStudents(prev => prev.filter(x => x.id !== s.id))}
                                          className="text-purple-400 hover:text-purple-700"
                                        >
                                          ✕
                                        </button>
                                      </span>
                                    ))}
                                  </div>

                                  <input
                                    type="text"
                                    list={`new-group-student-options-${row.id}`}
                                    className="admin-input w-full"
                                    placeholder="הקלד/י שם תלמיד/ה להוספה..."
                                    value={studentSearchQuery}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      const match = rows.find(r =>
                                        r.student_name === value && !newGroupStudents.some(s => s.id === r.id)
                                      );
                                      if (match) {
                                        setNewGroupStudents(prev => [...prev, { id: match.id, name: match.student_name }]);
                                        setStudentSearchQuery('');
                                      } else {
                                        setStudentSearchQuery(value);
                                      }
                                    }}
                                  />
                                  <datalist id={`new-group-student-options-${row.id}`}>
                                    {rows
                                      .filter(r => r.student_name && !newGroupStudents.some(s => s.id === r.id))
                                      .map(r => (
                                        <option key={r.id} value={r.student_name} />
                                      ))}
                                  </datalist>

                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleCreateGroup(row.id, row.teacher, row.assigned_day, row.assigned_time)}
                                      disabled={!newGroupType || newGroupStudents.length === 0}
                                      className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      צור שיעור
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCreatingGroupFor(null);
                                        setNewGroupStudents([]);
                                        setStudentSearchQuery('');
                                        setNewGroupType('');
                                      }}
                                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50"
                                    >
                                      ביטול
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <select
                                    className="admin-input flex-1"
                                    value={selectedGroups[row.id] || ''}
                                    onChange={(e) => {
                                      if (e.target.value === '__new__') {
                                        setCreatingGroupFor(row.id);
                                        setNewGroupStudents([{ id: row.id, name: row.student_name }]);
                                        setStudentSearchQuery('');
                                      } else {
                                        setSelectedGroups(prev => ({ ...prev, [row.id]: e.target.value }));
                                      }
                                    }}
                                  >
                                    <option value="">— הוסף שיעור בנוכחות —</option>
                                    {groups.map(g => (
                                      <option key={g.id} value={g.id}>
                                        {g.name}{g.is_mangan_school && g.school_name ? ` (${g.school_name})` : ''}
                                      </option>
                                    ))}
                                    <option value="__new__">➕ צור שיעור חדש</option>
                                  </select>
                                  {selectedGroups[row.id] && (() => {
                                    const grp = groups.find(g => String(g.id) === String(selectedGroups[row.id]));
                                    if (!grp) return null;
                                    return (
                                      <button
                                        type="button"
                                        title="מחק קבוצה"
                                        onClick={async () => {
                                          if (!confirm(`למחוק את הקבוצה "${grp.name}"?\nתלמידי הקבוצה יוסרו גם כן מאפליקציית הנוכחות.`)) return;
                                          const res = await fetch('/api/groups', {
                                            method: 'DELETE',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ id: grp.id }),
                                          });
                                          if (res.ok) {
                                            setGroups(prev => prev.filter(x => x.id !== grp.id));
                                            setSelectedGroups(prev => { const n = { ...prev }; delete n[row.id]; return n; });
                                          } else {
                                            const j = await res.json();
                                            alert(j.error || 'שגיאה במחיקה');
                                          }
                                        }}
                                        className="text-red-400 hover:text-red-600 text-lg font-bold px-1 transition-colors"
                                      >🗑</button>
                                    );
                                  })()}
                                </div>
                              )}
```

This is the exact original content of lines 916-1056. Note that line 1057 onward (the schedule-chips block, a **sibling** `{(() => { ... })()}` block that comes right after this one and depends only on `selectedGroups[row.id]`) is **not** part of this block and must be left completely untouched — it stays exactly where it is, immediately after whatever you replace this block with.

Replace the whole block above with:

```jsx
                              {(() => {
                                const selectedTeacherForGroups = teachers.find(t => t.name === row.teacher);
                                const selectedType = groupTypeFilter[row.id] || '';
                                const matchingGroups = selectedType
                                  ? groups.filter(g => g.teacher_id === selectedTeacherForGroups?.id && g.name === selectedType)
                                  : [];

                                return (
                                  <div className="space-y-2">
                                    <select
                                      className="admin-input w-full"
                                      value={selectedType}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        setGroupTypeFilter(prev => ({ ...prev, [row.id]: value }));
                                        setSelectedGroups(prev => {
                                          const next = { ...prev };
                                          delete next[row.id];
                                          return next;
                                        });
                                        setCreatingGroupFor(null);
                                        setNewGroupStudents([]);
                                        setStudentSearchQuery('');
                                      }}
                                    >
                                      <option value="">— סוג שיעור —</option>
                                      {LESSON_TYPE_OPTIONS.map(o => (
                                        <option key={o.label} value={o.label}>{o.label}</option>
                                      ))}
                                    </select>

                                    {selectedType && (
                                      creatingGroupFor === row.id ? (
                                        <div className="space-y-2">
                                          <div className="flex flex-wrap gap-1">
                                            {newGroupStudents.map(s => (
                                              <span
                                                key={s.id}
                                                className="inline-flex items-center gap-1 text-xs bg-purple-50 border border-purple-200 text-purple-700 rounded-lg px-2 py-1"
                                              >
                                                {s.name}
                                                <button
                                                  type="button"
                                                  onClick={() => setNewGroupStudents(prev => prev.filter(x => x.id !== s.id))}
                                                  className="text-purple-400 hover:text-purple-700"
                                                >
                                                  ✕
                                                </button>
                                              </span>
                                            ))}
                                          </div>

                                          <input
                                            type="text"
                                            list={`new-group-student-options-${row.id}`}
                                            className="admin-input w-full"
                                            placeholder="הקלד/י שם תלמיד/ה להוספה..."
                                            value={studentSearchQuery}
                                            onChange={(e) => {
                                              const value = e.target.value;
                                              const match = rows.find(r =>
                                                r.student_name === value && !newGroupStudents.some(s => s.id === r.id)
                                              );
                                              if (match) {
                                                setNewGroupStudents(prev => [...prev, { id: match.id, name: match.student_name }]);
                                                setStudentSearchQuery('');
                                              } else {
                                                setStudentSearchQuery(value);
                                              }
                                            }}
                                          />
                                          <datalist id={`new-group-student-options-${row.id}`}>
                                            {rows
                                              .filter(r => r.student_name && !newGroupStudents.some(s => s.id === r.id))
                                              .map(r => (
                                                <option key={r.id} value={r.student_name} />
                                              ))}
                                          </datalist>

                                          <div className="flex gap-2">
                                            <button
                                              type="button"
                                              onClick={() => handleCreateGroup(row.id, row.teacher, row.assigned_day, row.assigned_time, selectedType)}
                                              disabled={newGroupStudents.length === 0}
                                              className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                              צור שיעור
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setCreatingGroupFor(null);
                                                setNewGroupStudents([]);
                                                setStudentSearchQuery('');
                                              }}
                                              className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50"
                                            >
                                              ביטול
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2">
                                          <select
                                            className="admin-input flex-1"
                                            value={selectedGroups[row.id] || ''}
                                            onChange={(e) => {
                                              if (e.target.value === '__new__') {
                                                setCreatingGroupFor(row.id);
                                                setNewGroupStudents([{ id: row.id, name: row.student_name }]);
                                                setStudentSearchQuery('');
                                              } else {
                                                setSelectedGroups(prev => ({ ...prev, [row.id]: e.target.value }));
                                              }
                                            }}
                                          >
                                            <option value="">— הוסף שיעור בנוכחות —</option>
                                            {matchingGroups.map(g => (
                                              <option key={g.id} value={g.id}>
                                                {g.name}{g.is_mangan_school && g.school_name ? ` (${g.school_name})` : ''}
                                              </option>
                                            ))}
                                            <option value="__new__">➕ צור שיעור חדש</option>
                                          </select>
                                          {selectedGroups[row.id] && (() => {
                                            const grp = groups.find(g => String(g.id) === String(selectedGroups[row.id]));
                                            if (!grp) return null;
                                            return (
                                              <button
                                                type="button"
                                                title="מחק קבוצה"
                                                onClick={async () => {
                                                  if (!confirm(`למחוק את הקבוצה "${grp.name}"?\nתלמידי הקבוצה יוסרו גם כן מאפליקציית הנוכחות.`)) return;
                                                  const res = await fetch('/api/groups', {
                                                    method: 'DELETE',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ id: grp.id }),
                                                  });
                                                  if (res.ok) {
                                                    setGroups(prev => prev.filter(x => x.id !== grp.id));
                                                    setSelectedGroups(prev => { const n = { ...prev }; delete n[row.id]; return n; });
                                                  } else {
                                                    const j = await res.json();
                                                    alert(j.error || 'שגיאה במחיקה');
                                                  }
                                                }}
                                                className="text-red-400 hover:text-red-600 text-lg font-bold px-1 transition-colors"
                                              >🗑</button>
                                            );
                                          })()}
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })()}
```

Every line inside this replacement below the `<select className="admin-input flex-1" ...>` closing `</select>` (the delete-button IIFE) is copied verbatim from the original — only the wrapping around it changed. Line-by-line, the closing sequence at the end is: `))}` closes `{selectedType && ( ternary )}`; `</div>` closes the outer `<div className="space-y-2">` that now wraps the type `<select>` and the conditional; `);` closes the `return (...)`; `})()}` closes the wrapping `(() => { ... })()`.

After this replacement, line 1057 of the original file (the schedule-chips `{(() => { ... })()}` block) follows immediately, completely unchanged, exactly as it did before.

- [ ] **Step 4: Run the full test suite and build**

Run: `npx jest`
Expected: PASS — same 4 suites, 42+ tests (unaffected by this UI-only change; Task 1's updated `groupNaming.test.js` already passed in Task 1).

Run: `npx next build`
Expected: `✓ Compiled successfully`, no errors in `components/AdminTable.jsx`.

If the build reports a JSX syntax error (mismatched braces/parens), the most likely cause is the closing sequence at the end of Step 3 — re-count that `{selectedType && (...)}` , the outer `<div className="space-y-2">`, the `return (...)`, and the wrapping `(() => {...})()` each have exactly one matching close.

- [ ] **Step 5: Commit**

```bash
git add components/AdminTable.jsx
git commit -m "feat: filter existing-lesson picker by teacher and lesson type"
```

---

## Task 3: Manual end-to-end verification

No automated test harness exists for this component (same situation as the prior plan). Verify by running the app.

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Type-first gating**

Open a student row, expand "שיבוץ", pick a teacher and day/time. Confirm the "סוג שיעור" dropdown appears with all 16 labels in the exact order from the Global Constraints table, and that **nothing** below it (no existing-lesson list, no create-form) is visible until a type is chosen.

- [ ] **Step 3: Filtering by teacher + exact type**

Pick a teacher known to have at least one existing group whose name exactly matches one of the 16 labels (e.g. a teacher with a "מקהלה צעירה" group). Select "מקהלה צעירה" in the new dropdown. Confirm only that teacher's "מקהלה צעירה" group(s) appear in the list below (not groups from other teachers, not that teacher's groups of a different type), followed by "➕ צור שיעור חדש".

- [ ] **Step 4: Empty state**

Pick a teacher + type combination with no existing matching group. Confirm the list shows only "➕ צור שיעור חדש" (no empty/blank options, no error).

- [ ] **Step 5: Create-new no longer asks for type twice**

With a type already selected in step 3 or 4, click "➕ צור שיעור חדש". Confirm the form shows only the student add/search UI (no lesson-type dropdown inside it), and that creating the lesson produces a group named correctly per the existing naming rule (single student → "type - name"; multiple → "type" alone) using the type chosen in the outer dropdown.

- [ ] **Step 6: Changing type resets stale selections**

After selecting a type and picking an existing group (or opening the create-form) for a row, change the "סוג שיעור" dropdown to a different type. Confirm the previously-selected group/create-form state is cleared and the list below re-filters to the new type.

- [ ] **Step 7: Unrelated flows unaffected**

Confirm the "מחק קבוצה" (delete group) button and the schedule-chips display for an already-selected group still work exactly as before — this plan does not touch that code, only re-nests it one level deeper inside the new type-gated wrapper.
