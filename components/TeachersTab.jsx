'use client';

import { useState, useEffect } from 'react';
import TeacherForm from './TeacherForm';
import ImportAssignments from './ImportAssignments';

const DAY_NAMES_TEACHER = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HEBREW_TO_NUM = { 'א': 0, 'ב': 1, 'ג': 2, 'ד': 3, 'ה': 4, 'ו': 5, 'ז': 6 };

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

function TeacherCard({ t, registrations, groupsById, onEdit, onDelete, onStudentUpdated }) {
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
                        {DAY_NAMES_TEACHER.map((name, i) => (
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
      )}
    </div>
  );
}

export default function TeachersTab() {
  const [teachers, setTeachers] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [groupsById, setGroupsById] = useState({});
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
    const [tRes, rRes, gRes] = await Promise.all([
      fetch('/api/teachers'),
      fetch('/api/registrations'),
      fetch('/api/groups'),
    ]);
    const [tJson, rJson, gJson] = await Promise.all([tRes.json(), rRes.json(), gRes.json()]);
    setTeachers(tJson.data || []);
    setRegistrations((rJson.data || []).filter(r => r.teacher));
    setGroupsById(Object.fromEntries((gJson.data || []).map(g => [g.id, g])));
    setLoading(false);
  }

  async function fetchTeachers() {
    const res = await fetch('/api/teachers');
    const json = await res.json();
    setTeachers(json.data || []);
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
                onEdit={() => setEditing(t)}
                onDelete={() => handleDelete(t.id)}
                onStudentUpdated={fetchAll}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
