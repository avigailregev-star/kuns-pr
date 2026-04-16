'use client';

import { useState, useEffect } from 'react';
import TeacherForm from './TeacherForm';
import ImportAssignments from './ImportAssignments';

function TeacherCard({ t, registrations, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const students = registrations.filter(
    r => r.teacher?.trim().toLowerCase() === t.name?.trim().toLowerCase()
  );

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div>
          <p className="font-semibold text-gray-800">{t.name}</p>
          <p className="text-sm text-gray-500">
            {t.instrument_type}
            {t.instrument_type ? ' · ' : ''}
            {(t.available_days || []).length > 0
              ? (t.available_days || []).map((d) => `יום ${d}`).join(', ')
              : 'אין ימים מוגדרים'}
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
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-800">{s.student_name}</span>
                  <span className="text-gray-500 text-xs">
                    {s.selected_course || (Array.isArray(s.instruments) ? s.instruments.join(', ') : s.instruments) || '—'}
                    {s.assigned_day ? ` · יום ${s.assigned_day}` : ''}
                    {s.assigned_time ? ` ${s.assigned_time}` : ''}
                  </span>
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
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
