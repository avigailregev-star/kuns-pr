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

function TeacherCard({ t, registrations, onEdit, onDelete, onStudentUpdated }) {
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
      const dayDiff = dayToNum(a.assigned_day) - dayToNum(b.assigned_day);
      if (dayDiff !== 0) return dayDiff;
      return (a.assigned_time || '').localeCompare(b.assigned_time || '');
    });

  function startEdit(s) {
    const n = dayToNum(s.assigned_day);
    setEditDay(n === 99 ? '' : String(n));
    setEditTime(s.assigned_time || '');
    setEditingId(s.id);
  }

  async function saveEdit(s) {
    setSaving(true);
    await fetch('/api/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: s.id,
        newStatus: s.status,
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
                        <span className="text-gray-500 text-xs">
                          {s.selected_course || (Array.isArray(s.instruments) ? s.instruments.join(', ') : s.instruments) || '—'}
                          {formatDayTeacher(s.assigned_day) != null ? ` · יום ${formatDayTeacher(s.assigned_day)}` : ''}
                          {s.assigned_time ? ` ${s.assigned_time}` : ''}
                        </span>
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
    const [tRes, rRes] = await Promise.all([
      fetch('/api/teachers'),
      fetch('/api/registrations'),
    ]);
    const [tJson, rJson] = await Promise.all([tRes.json(), rRes.json()]);
    setTeachers(tJson.data || []);
    setRegistrations((rJson.data || []).filter(r => r.teacher));
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
