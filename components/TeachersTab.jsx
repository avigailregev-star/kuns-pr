'use client';

import { useState, useEffect } from 'react';
import TeacherForm from './TeacherForm';
import ImportAssignments from './ImportAssignments';
import { LESSON_TYPE_OPTIONS, getLessonTypeValue, nextNumberedGroupName } from '../lib/groupNaming';
import { categoryForLabel, mergeFixedLessonTypes } from '../lib/fixedLessonTypes';
import { getLessonDuration } from '../lib/lessonDuration';

const DAY_NAMES_TEACHER = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HEBREW_TO_NUM = { 'א': 0, 'ב': 1, 'ג': 2, 'ד': 3, 'ה': 4, 'ו': 5, 'ז': 6 };
const PRIVATE_GROUP_TYPES = new Set(['individual_45', 'individual_60', 'melodies_individual']);
function formatDayTeacher(assignedDay) {
  if (assignedDay == null || assignedDay === '') return null;
  const num = Number(assignedDay);
  if (!isNaN(num) && num >= 0 && num <= 6) return DAY_NAMES_TEACHER[num];
  if (HEBREW_TO_NUM[assignedDay] !== undefined) return DAY_NAMES_TEACHER[HEBREW_TO_NUM[assignedDay]];
  return assignedDay;
}

function dayToNum(assignedDay) {
  if (assignedDay == null || assignedDay === '') return 99;
  const num = Number(assignedDay);
  if (!isNaN(num) && num >= 0 && num <= 6) return num;
  return HEBREW_TO_NUM[assignedDay] ?? 99;
}

// A registration linked to an existing group (group_id) gets its real day/time
// from that group's schedule, not from its own assigned_day/assigned_time —
// those are only populated when the assignment was made directly on the
// registration (see syncToAttendance.js). Without this, students assigned via
// the "existing lesson" picker in AdminTable look unscheduled here even
// though they have a real day+time.
function getEffectiveSchedule(s, groupsById) {
  const group = s.group_id != null ? groupsById[s.group_id] : null;
  const sched = group?.group_schedules?.find(sc => sc.start_time) || group?.group_schedules?.[0];
  if (sched) return { day: sched.day_of_week, time: sched.start_time };
  return { day: s.assigned_day, time: s.assigned_time };
}

// An individual lesson also gets a 1-student "group" behind the scenes for
// attendance sync, but that group has no independent schedule of its own —
// only a real shared group (theory/choir/orchestra/etc) can supply a time on
// the student's behalf.
const INDIVIDUAL_LESSON_TYPES_TEACHER = new Set(['individual_45', 'individual_60', 'melodies_individual']);
function hasSharedGroupSchedule(s, groupsById) {
  const group = s.group_id != null ? groupsById[s.group_id] : null;
  if (!group || INDIVIDUAL_LESSON_TYPES_TEACHER.has(group.lesson_type)) return false;
  return (group.group_schedules || []).some(sc => sc.start_time);
}

function TeacherWeekSchedule({ teacher, registrations, groups, groupsById, onChanged }) {
  const [editing, setEditing] = useState(null);
  const [managingGroup, setManagingGroup] = useState(null);
  const [draft, setDraft] = useState({ day: '', time: '', endTime: '', name: '' });
  const [saving, setSaving] = useState(false);
  const fixedGroups = groups.filter(group => String(group.teacher_id) === String(teacher.id) && ['theory', 'choir', 'orchestra'].includes(group.lesson_type));
  const ungroupedRows = registrations.filter(row => {
    const group = row.group_id != null ? groupsById[row.group_id] : null;
    return !group || PRIVATE_GROUP_TYPES.has(group.lesson_type);
  });
  const legacyGroupBuckets = new Map();
  for (const row of ungroupedRows) {
    const schedule = getEffectiveSchedule(row, groupsById);
    const course = (row.selected_course || '').trim();
    const looksGrouped = /הרכב|אנסמבל|תזמורת|מקהלה/.test(course);
    if (!looksGrouped) continue;
    const key = `${course}|${dayToNum(schedule.day)}|${(schedule.time || '').slice(0, 5)}`;
    const bucket = legacyGroupBuckets.get(key) || [];
    bucket.push(row);
    legacyGroupBuckets.set(key, bucket);
  }
  const legacyGroupedIds = new Set(
    [...legacyGroupBuckets.values()].filter(rows => rows.length > 1).flatMap(rows => rows.map(row => row.id))
  );
  const privateRows = ungroupedRows.filter(row => !legacyGroupedIds.has(row.id));
  const events = [
    ...privateRows.map(row => {
      const schedule = getEffectiveSchedule(row, groupsById);
      const start = (schedule.time || '').slice(0, 5);
      const end = (row.assigned_end_time || '').slice(0, 5) || (start ? minsToClock(clockToMins(start) + getLessonDuration(row.selected_course)) : '');
      return { id: `row-${row.id}`, kind: 'individual', source: row, members: [row], label: row.student_name, subtitle: row.selected_course || 'שיעור פרטני', day: dayToNum(schedule.day), time: start, endTime: end };
    }),
    ...[...legacyGroupBuckets.entries()].filter(([, rows]) => rows.length > 1).map(([key, rows]) => {
      const schedule = getEffectiveSchedule(rows[0], groupsById);
      const start = (schedule.time || '').slice(0, 5);
      const end = (rows[0].assigned_end_time || '').slice(0, 5) || (start ? minsToClock(clockToMins(start) + getLessonDuration(rows[0].selected_course)) : '');
      return { id: `legacy-${key}`, kind: 'ensemble', source: null, members: rows, label: rows[0].selected_course, subtitle: `${rows.length} תלמידים`, day: dayToNum(schedule.day), time: start, endTime: end };
    }),
    ...fixedGroups.flatMap(group => (group.group_schedules || []).filter(schedule => schedule.start_time).map((schedule, index) => ({
      id: `group-${group.id}-${index}`, kind: 'fixed', source: group, members: registrations.filter(row => String(row.group_id) === String(group.id)), label: group.name, subtitle: `${groupStudentLabel(group.id, registrations)}`, day: dayToNum(schedule.day_of_week), time: schedule.start_time.slice(0, 5), endTime: (schedule.end_time || '').slice(0, 5),
    }))),
  ];

  function beginEdit(event) {
    setEditing(event);
    setDraft({ day: event.day === 99 ? '' : String(event.day), time: event.time, endTime: event.endTime, name: event.label });
  }
  async function removeMember(member) {
    if (!confirm(`להסיר את ${member.student_name} מההרכב?`)) return;
    setSaving(true);
    try {
      const res = await fetch('/api/update-status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: member.id, newStatus: 'חדש', scheduleMode: 'clear' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { alert(json.error || 'שגיאה בהסרת התלמיד/ה'); return; }
      setManagingGroup(null);
      await onChanged();
    } finally { setSaving(false); }
  }
  async function save() {
    if (!editing || draft.day === '' || !draft.time) return;
    setSaving(true);
    try {
      const fixed = editing.kind === 'fixed';
      const res = await fetch(fixed ? '/api/groups' : '/api/update-status', {
        method: fixed ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fixed ? {
          id: editing.source.id, name: draft.name, assigned_day: Number(draft.day), assigned_time: draft.time, assigned_end_time: draft.endTime || null,
        } : {
          id: editing.source.id, newStatus: editing.source.status, teacher: teacher.name, assignedDay: Number(draft.day), assignedTime: draft.time, assignedEndTime: draft.endTime || null, scheduleMode: 'individual',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { alert(json.error || 'שגיאה בעריכת השיבוץ'); return; }
      setEditing(null); await onChanged();
    } finally { setSaving(false); }
  }

  const unscheduled = events.filter(event => event.day === 99 || !event.time);
  return <div className="space-y-3">
    {managingGroup && <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div><h4 className="font-semibold text-emerald-950">{managingGroup.label}</h4><p className="text-xs text-emerald-800">תלמידי ההרכב</p></div>
        <div className="flex items-center gap-3">
          {managingGroup.kind === 'fixed' && <button type="button" onClick={() => { beginEdit(managingGroup); setManagingGroup(null); }} className="text-xs font-medium text-blue-700">ערוך הרכב</button>}
          <button type="button" onClick={() => setManagingGroup(null)} className="text-lg leading-none text-gray-500" aria-label="סגור">×</button>
        </div>
      </div>
      {managingGroup.members.length === 0 ? <p className="text-sm text-gray-500">אין תלמידים בהרכב</p> : <div className="space-y-2">
        {managingGroup.members.map(member => <div key={member.id} className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm">
          <span className="font-medium text-gray-800">{member.student_name}</span>
          <span className="flex items-center gap-3">
            <button type="button" onClick={() => { beginEdit({ id: `row-${member.id}`, kind: 'individual', source: member, label: member.student_name, day: dayToNum(member.assigned_day), time: (member.assigned_time || '').slice(0,5), endTime: (member.assigned_end_time || '').slice(0,5) }); setManagingGroup(null); }} className="text-xs text-blue-600 hover:text-blue-800">ערוך</button>
            <button type="button" disabled={saving} onClick={() => removeMember(member)} className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40">הסר</button>
          </span>
        </div>)}
      </div>}
    </div>}
    {editing && <div className="flex flex-wrap gap-2 items-end rounded-xl border border-purple-200 bg-purple-50 p-3">
      {editing.kind === 'fixed' && <label className="text-xs flex-1 min-w-44">שם<input className="admin-input mt-1" value={draft.name} onChange={e => setDraft(prev => ({ ...prev, name: e.target.value }))} /></label>}
      <label className="text-xs">יום<select className="admin-input mt-1" value={draft.day} onChange={e => setDraft(prev => ({ ...prev, day: e.target.value }))}>{DAY_NAMES_TEACHER.slice(0,5).map((name,i) => <option key={i} value={i}>{name}</option>)}</select></label>
      <label className="text-xs">התחלה<input type="time" dir="ltr" className="admin-input mt-1" value={draft.time} onChange={e => setDraft(prev => ({ ...prev, time: e.target.value }))} /></label>
      <label className="text-xs">סיום<input type="time" dir="ltr" className="admin-input mt-1" value={draft.endTime} onChange={e => setDraft(prev => ({ ...prev, endTime: e.target.value }))} /></label>
      <button type="button" onClick={save} disabled={saving || draft.day === '' || !draft.time} className="btn-primary text-xs disabled:opacity-40">{saving ? 'שומר…' : 'שמור'}</button>
      <button type="button" onClick={() => setEditing(null)} className="text-xs px-3 py-2">ביטול</button>
    </div>}
    <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
      {DAY_NAMES_TEACHER.slice(0,5).map((dayName, day) => <section key={dayName} className="rounded-xl border border-gray-200 bg-white p-2 min-h-32">
        <h4 className="font-semibold text-center border-b pb-2 mb-2">{dayName}</h4>
        <div className="space-y-2">{events.filter(event => event.day === day && event.time).sort((a,b) => a.time.localeCompare(b.time)).map(event => <button key={event.id} type="button" onClick={() => event.kind === 'individual' ? beginEdit(event) : setManagingGroup(event)} className={`block w-full text-right rounded-lg border p-2 text-xs hover:ring-2 ${event.kind === 'individual' ? 'bg-purple-50 border-purple-200 hover:ring-purple-300' : 'bg-emerald-50 border-emerald-300 hover:ring-emerald-300'}`}>
          <span className="block font-semibold">{event.label}</span><span className="block text-gray-600">{event.subtitle}</span><span dir="ltr" className="block text-right font-medium">{event.time}{event.endTime ? `–${event.endTime}` : ''}</span>
        </button>)}</div>
      </section>)}
    </div>
    {unscheduled.length > 0 && <div><h4 className="text-sm font-semibold text-amber-800 mb-2">ללא יום או שעה</h4><div className="flex flex-wrap gap-2">{unscheduled.map(event => <button key={event.id} type="button" onClick={() => event.kind === 'individual' ? beginEdit(event) : setManagingGroup(event)} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm">{event.label}</button>)}</div></div>}
  </div>;
}

function clockToMins(value) { const [hours, mins] = value.split(':').map(Number); return hours * 60 + (mins || 0); }
function minsToClock(value) { return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`; }
function groupStudentLabel(groupId, registrations) { const count = registrations.filter(row => String(row.group_id) === String(groupId)).length; return `${count} תלמידים`; }

function FixedLessonsSection({ t, groups, groupStudentCounts, fixedLessonTypes, onChanged, onTypesChanged }) {
  const [label, setLabel] = useState('');
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [addingType, setAddingType] = useState(false);
  const [newTypeLabel, setNewTypeLabel] = useState('');
  const [newTypeCategory, setNewTypeCategory] = useState('');
  const [typeSaving, setTypeSaving] = useState(false);
  const [typeError, setTypeError] = useState('');
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editGroup, setEditGroup] = useState({ name: '', day: '', time: '', endTime: '' });

  const teacherGroups = groups.filter(g => g.teacher_id === t.id && ['theory', 'choir', 'orchestra'].includes(g.lesson_type));
  const ranges = t.teacher_availability_ranges || [];

  async function handleSave() {
    if (!label || day === '' || !time) return;
    setSaving(true);
    try {
      const name = nextNumberedGroupName(label, groups.map(g => g.name));
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          lesson_type: categoryForLabel(label, fixedLessonTypes) || getLessonTypeValue(label),
          teacher_id: t.id,
          assigned_day: day,
          assigned_time: time,
          assigned_end_time: endTime || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || 'שגיאה ביצירת שיעור קבוע');
        return;
      }
      setLabel('');
      setDay('');
      setTime('');
      setEndTime('');
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(g) {
    if (!confirm(`למחוק את הקבוצה "${g.name}"?\nתלמידי הקבוצה יוסרו גם כן מאפליקציית הנוכחות.`)) return;
    const res = await fetch('/api/groups', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: g.id }),
    });
    if (res.ok) {
      onChanged();
    } else {
      const json = await res.json();
      alert(json.error || 'שגיאה במחיקה');
    }
  }

  function startEditing(g) {
    const sched = (g.group_schedules || []).find(s => s.start_time) || {};
    setEditingGroupId(g.id);
    setEditGroup({
      name: g.name || '',
      day: sched.day_of_week != null ? String(sched.day_of_week) : '',
      time: (sched.start_time || '').slice(0, 5),
      endTime: (sched.end_time || '').slice(0, 5),
    });
  }

  async function saveEditing() {
    if (!editingGroupId || !editGroup.name.trim() || editGroup.day === '' || !editGroup.time) return;
    setSaving(true);
    try {
      const res = await fetch('/api/groups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingGroupId,
          name: editGroup.name.trim(),
          assigned_day: Number(editGroup.day),
          assigned_time: editGroup.time,
          assigned_end_time: editGroup.endTime || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || 'שגיאה בעריכת השיעור הקבוע');
        return;
      }
      setEditingGroupId(null);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function handleAddType() {
    const cleanLabel = newTypeLabel.trim();
    if (!cleanLabel || !newTypeCategory) return;
    setTypeSaving(true);
    setTypeError('');
    try {
      const res = await fetch('/api/fixed-lesson-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: cleanLabel, category: newTypeCategory }),
      });
      const json = await res.json();
      if (!res.ok) {
        setTypeError(json.error || 'שגיאה בהוספת סוג');
        return;
      }
      await onTypesChanged();
      setLabel(json.data.label);
      setAddingType(false);
      setNewTypeLabel('');
      setNewTypeCategory('');
    } finally {
      setTypeSaving(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <h5 className="text-sm font-semibold text-gray-700 mb-2">שיעורים קבועים קבוצתיים</h5>
      {teacherGroups.length === 0 ? (
        <p className="text-xs text-gray-400 mb-2">אין שיעורים קבועים עדיין</p>
      ) : (
        <div className="space-y-1 mb-2">
          {teacherGroups.map(g => {
            const sched = (g.group_schedules || []).find(s => s.start_time);
            if (editingGroupId === g.id) return (
              <div key={g.id} className="flex flex-wrap items-center gap-2 text-xs bg-purple-50 border border-purple-200 rounded-lg p-2">
                <input aria-label="שם שיעור קבוע" value={editGroup.name} onChange={e => setEditGroup(prev => ({ ...prev, name: e.target.value }))} className="border border-gray-300 rounded px-2 py-1 flex-1 min-w-44 bg-white" />
                <select aria-label="יום שיעור קבוע" value={editGroup.day} onChange={e => setEditGroup(prev => ({ ...prev, day: e.target.value }))} className="border border-gray-300 rounded px-2 py-1 bg-white">
                  {DAY_NAMES_TEACHER.slice(0, 5).map((name, i) => <option key={i} value={i}>יום {name}</option>)}
                </select>
                <input aria-label="שעת התחלה" type="time" dir="ltr" value={editGroup.time} onChange={e => setEditGroup(prev => ({ ...prev, time: e.target.value }))} className="border border-gray-300 rounded px-2 py-1 bg-white" />
                <span>עד</span>
                <input aria-label="שעת סיום" type="time" dir="ltr" value={editGroup.endTime} onChange={e => setEditGroup(prev => ({ ...prev, endTime: e.target.value }))} className="border border-gray-300 rounded px-2 py-1 bg-white" />
                <button type="button" onClick={saveEditing} disabled={saving || !editGroup.name.trim() || editGroup.day === '' || !editGroup.time} className="bg-purple-600 text-white rounded px-3 py-1 disabled:opacity-40">שמור</button>
                <button type="button" onClick={() => setEditingGroupId(null)} disabled={saving} className="text-gray-600 px-2 py-1">ביטול</button>
              </div>
            );
            return (
              <div key={g.id} className="flex items-center justify-between text-xs bg-white border border-gray-200 rounded px-2 py-1">
                <span>
                  {g.name}
                  {sched
                    ? ` · יום ${DAY_NAMES_TEACHER[sched.day_of_week]} ${sched.start_time.slice(0, 5)}${sched.end_time ? `–${sched.end_time.slice(0, 5)}` : ''}`
                    : ' · ללא שעה קבועה'}
                  {` · ${groupStudentCounts[g.id] || 0} תלמידים`}
                </span>
                <span className="flex items-center gap-3">
                  <button type="button" onClick={() => startEditing(g)} className="text-purple-600 hover:text-purple-800">ערוך</button>
                  <button type="button" onClick={() => handleDelete(g)} className="text-red-400 hover:text-red-600">מחק</button>
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={label}
          onChange={e => {
            if (e.target.value === '__add_new__') {
              setAddingType(true);
              setLabel('');
            } else {
              setAddingType(false);
              setLabel(e.target.value);
            }
            setDay(''); setTime(''); setEndTime(''); setTypeError('');
          }}
          className="border border-gray-300 rounded px-2 py-1 text-xs"
          dir="rtl"
        >
          <option value="">— סוג —</option>
          {fixedLessonTypes.map(({ label: l }) => (
            <option key={l} value={l}>{l}</option>
          ))}
          <option value="__add_new__">➕ הוסף סוג חדש</option>
        </select>
        {addingType && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 p-2">
            <input
              value={newTypeLabel}
              onChange={e => setNewTypeLabel(e.target.value)}
              placeholder="שם סוג חדש"
              className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
              autoFocus
            />
            <select
              value={newTypeCategory}
              onChange={e => setNewTypeCategory(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
            >
              <option value="">— קטגוריה —</option>
              <option value="theory">תיאוריה / קבוצתי</option>
              <option value="choir">מקהלה</option>
              <option value="orchestra">תזמורת / הרכב</option>
            </select>
            <button type="button" onClick={handleAddType} disabled={!newTypeLabel.trim() || !newTypeCategory || typeSaving} className="text-xs bg-purple-600 text-white px-3 py-1 rounded disabled:opacity-40">
              {typeSaving ? 'שומר...' : 'שמור סוג'}
            </button>
            <button type="button" onClick={() => { setAddingType(false); setTypeError(''); }} className="text-xs text-gray-500">ביטול</button>
            {typeError && <span className="w-full text-xs text-red-600">{typeError}</span>}
          </div>
        )}
        {label && (ranges.length > 0 ? (
          ranges.map(r => (
            <button
              key={r.day_of_week}
              type="button"
              onClick={() => { setDay(String(r.day_of_week)); setTime(r.start_time || ''); setEndTime(r.end_time || ''); }}
              className={`text-xs px-2 py-1 rounded border ${
                String(day) === String(r.day_of_week)
                  ? 'border-purple-500 bg-purple-50 text-purple-700'
                  : 'border-gray-300 text-gray-600'
              }`}
            >
              יום {DAY_NAMES_TEACHER[r.day_of_week]}
            </button>
          ))
        ) : (
          <select
            value={day}
            onChange={e => setDay(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-xs"
            dir="rtl"
          >
            <option value="">— יום —</option>
            {DAY_NAMES_TEACHER.slice(0, 5).map((name, i) => (
              <option key={i} value={String(i)}>יום {name}</option>
            ))}
          </select>
        ))}
        {label && day !== '' && (
          <input
            type="time"
            dir="ltr"
            value={time}
            onChange={e => setTime(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-xs"
          />
        )}
        {label && day !== '' && time && (
          <>
            <span className="text-xs text-gray-400">עד</span>
            <input
              type="time"
              dir="ltr"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-xs"
            />
          </>
        )}
        <button
          type="button"
          disabled={!label || day === '' || !time || saving}
          onClick={handleSave}
          className="text-xs bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 disabled:opacity-40"
        >
          + הוסף שיעור קבוע
        </button>
      </div>
    </div>
  );
}

function TeacherCard({ t, registrations, groupsById, groups, groupStudentCounts, fixedLessonTypes, onEdit, onDelete, onStudentUpdated, onGroupsChanged, onTypesChanged }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDay, setEditDay] = useState('');
  const [editTime, setEditTime] = useState('');
  const [saving, setSaving] = useState(false);

  const students = registrations
    .filter(
      r => r.teacher?.trim().toLowerCase() === t.name?.trim().toLowerCase() &&
        !['בוטל', 'נדחה', 'רשימת המתנה'].includes(r.status)
    )
    .sort((a, b) => {
      const schedA = getEffectiveSchedule(a, groupsById);
      const schedB = getEffectiveSchedule(b, groupsById);
      const dayDiff = dayToNum(schedA.day) - dayToNum(schedB.day);
      if (dayDiff !== 0) return dayDiff;
      return (schedA.time || '').localeCompare(schedB.time || '');
    });

  function startEdit(s) {
    const n = dayToNum(s.assigned_day);
    setEditDay(n === 99 ? '' : String(n));
    setEditTime(s.assigned_time || '');
    setEditingId(s.id);
  }

  async function saveEdit(s) {
    if (!editTime && !hasSharedGroupSchedule(s, groupsById)) {
      alert('יש לבחור שעה כדי לשבץ תלמיד/ה לשיעור פרטני');
      return;
    }
    setSaving(true);
    await fetch('/api/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: s.id,
        newStatus: s.status,
        teacher: t.name,
        assignedDay: editDay !== '' ? editDay : null,
        assignedTime: editTime || null,
      }),
    });
    setSaving(false);
    setEditingId(null);
    onStudentUpdated();
  }

  async function removeAssignment(s) {
    if (!confirm(`להסיר את שיבוץ ${s.student_name}?`)) return;
    await fetch('/api/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: s.id,
        newStatus: 'חדש',
        teacher: null,
        assignedDay: null,
        assignedTime: null,
      }),
    });
    onStudentUpdated();
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div>
          <p className="font-semibold text-gray-800">{t.name}</p>
          <p className="text-sm text-gray-500">
            {t.instrument_type}
            {t.instrument_type ? ' · ' : ''}
            {(() => {
              const oldDays = t.available_days || [];
              const ranges = t.teacher_availability_ranges || [];
              if (oldDays.length > 0) return oldDays.map(d => `יום ${d}`).join(', ');
              if (ranges.length > 0) {
                const unique = [...new Set(ranges.map(r => r.day_of_week))].sort((a, b) => a - b);
                return unique.map(d => `יום ${DAY_NAMES_TEACHER[d]}`).join(', ');
              }
              return 'אין ימים מוגדרים';
            })()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1.5 text-sm text-purple-600 font-medium hover:text-purple-800"
          >
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              t.max_students != null && students.length >= t.max_students
                ? 'bg-red-100 text-red-700'
                : 'bg-purple-100 text-purple-700'
            }`}>
              {students.length}
              {t.max_students != null ? ` / ${t.max_students}` : ''} תלמידים
            </span>
            <span>{open ? '▲' : '▼'}</span>
          </button>
          <button onClick={onEdit} className="text-sm text-blue-600 hover:underline">ערוך</button>
          <button onClick={onDelete} className="text-sm text-red-500 hover:underline">מחק</button>
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
          <TeacherWeekSchedule teacher={t} registrations={students} groups={groups} groupsById={groupsById} onChanged={onStudentUpdated} />
          <div className="hidden">
          {students.length === 0 ? (
            <p className="text-sm text-gray-400">אין תלמידים משובצים עדיין</p>
          ) : (
            <div className="space-y-2">
              {students.map(s => (
                <div key={s.id} className="text-sm">
                  {editingId === s.id ? (
                    <div className="flex items-center gap-2 flex-wrap bg-white border border-purple-200 rounded px-3 py-2">
                      <span className="font-medium text-gray-800">{s.student_name}</span>
                      <select
                        value={editDay}
                        onChange={e => setEditDay(e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-xs"
                        dir="rtl"
                      >
                        <option value="">— יום —</option>
                        {DAY_NAMES_TEACHER.slice(0, 5).map((name, i) => (
                          <option key={i} value={String(i)}>יום {name}</option>
                        ))}
                      </select>
                      <input
                        type="time"
                        dir="ltr"
                        value={editTime}
                        onChange={e => setEditTime(e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-xs"
                      />
                      <button
                        onClick={() => saveEdit(s)}
                        disabled={saving}
                        className="text-xs bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 disabled:opacity-50"
                      >
                        שמור
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        ביטול
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between group">
                      <span className="font-medium text-gray-800">{s.student_name}</span>
                      <div className="flex items-center gap-3">
                        {(() => {
                          const sched = getEffectiveSchedule(s, groupsById);
                          const dayLabel = formatDayTeacher(sched.day);
                          const hasDay = dayLabel != null;
                          const hasTime = !!sched.time;
                          return (
                            <>
                              <span className="text-gray-500 text-xs">
                                {s.selected_course || (Array.isArray(s.instruments) ? s.instruments.join(', ') : s.instruments) || '—'}
                                {hasDay ? ` · יום ${dayLabel}` : ''}
                                {hasTime ? ` ${sched.time}` : ''}
                              </span>
                              {!(hasDay && hasTime) && (
                                <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                                  ⏳ טרם שובץ{!hasDay && !hasTime ? '' : !hasDay ? ' (חסר יום)' : ' (חסרה שעה)'}
                                </span>
                              )}
                            </>
                          );
                        })()}
                        <button
                          onClick={() => startEdit(s)}
                          className="text-xs text-blue-500 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ערוך
                        </button>
                        <button
                          onClick={() => removeAssignment(s)}
                          className="text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          הסר
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>
          <FixedLessonsSection t={t} groups={groups} groupStudentCounts={groupStudentCounts} fixedLessonTypes={fixedLessonTypes} onChanged={onGroupsChanged} onTypesChanged={onTypesChanged} />
        </div>
      )}
    </div>
  );
}

export default function TeachersTab() {
  const [teachers, setTeachers] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [groupsById, setGroupsById] = useState({});
  const [groups, setGroups] = useState([]);
  const [fixedLessonTypes, setFixedLessonTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    fetchAll();
    fetch('/api/sync-all', { method: 'POST' }).catch(() => {});
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [tRes, rRes, gRes, ftRes] = await Promise.all([
      fetch('/api/teachers'),
      fetch('/api/registrations'),
      fetch('/api/groups'),
      fetch('/api/fixed-lesson-types'),
    ]);
    const [tJson, rJson, gJson, ftJson] = await Promise.all([tRes.json(), rRes.json(), gRes.json(), ftRes.json()]);
    setTeachers(tJson.data || []);
    setRegistrations((rJson.data || []).filter(r => r.teacher));
    setGroupsById(Object.fromEntries((gJson.data || []).map(g => [g.id, g])));
    setGroups(gJson.data || []);
    setFixedLessonTypes(mergeFixedLessonTypes(ftJson.data || []));
    setLoading(false);
  }

  async function fetchTeachers() {
    const res = await fetch('/api/teachers');
    const json = await res.json();
    setTeachers(json.data || []);
  }

  async function fetchFixedLessonTypes() {
    const res = await fetch('/api/fixed-lesson-types');
    const json = await res.json();
    setFixedLessonTypes(mergeFixedLessonTypes(json.data || []));
  }

  async function handleSave(data) {
    const url = editing ? `/api/teachers/${editing.id}` : '/api/teachers';
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'שגיאה בשמירה');
    }
    setShowForm(false);
    setEditing(null);
    fetchTeachers();
  }

  async function handleDelete(id) {
    if (!confirm('למחוק מורה זה?')) return;
    await fetch(`/api/teachers/${id}`, { method: 'DELETE' });
    fetchTeachers();
  }

  if (loading) return <p className="text-gray-500 text-sm">טוען מורים...</p>;

  const groupStudentCounts = {};
  for (const r of registrations) {
    if (r.group_id != null) groupStudentCounts[r.group_id] = (groupStudentCounts[r.group_id] || 0) + 1;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">מורים</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(v => !v)}
            className="text-sm border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50"
          >
            📥 ייבוא שיבוצים
          </button>
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="btn-primary text-sm"
          >
            + הוסף מורה
          </button>
        </div>
      </div>

      {showImport && (
        <ImportAssignments onDone={() => { setShowImport(false); fetchAll(); }} />
      )}

      {(showForm && !editing) && (
        <TeacherForm onSave={handleSave} onCancel={() => setShowForm(false)} />
      )}

      {teachers.length === 0 && !showForm && (
        <p className="text-gray-400 text-sm">אין מורים עדיין. לחץ "הוסף מורה" להתחלה.</p>
      )}

      <div className="space-y-3">
        {teachers.map((t) => (
          <div key={t.id}>
            {editing?.id === t.id ? (
              <TeacherForm
                initial={t}
                onSave={handleSave}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <TeacherCard
                t={t}
                registrations={registrations}
                groupsById={groupsById}
                groups={groups}
                groupStudentCounts={groupStudentCounts}
                fixedLessonTypes={fixedLessonTypes}
                onEdit={() => setEditing(t)}
                onDelete={() => handleDelete(t.id)}
                onStudentUpdated={fetchAll}
                onGroupsChanged={fetchAll}
                onTypesChanged={fetchFixedLessonTypes}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
