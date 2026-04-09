'use client';

import { useState, useEffect } from 'react';
import TeacherForm from './TeacherForm';

export default function TeachersTab() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    fetchTeachers();
  }, []);

  async function fetchTeachers() {
    setLoading(true);
    const res = await fetch('/api/teachers');
    const json = await res.json();
    setTeachers(json.data || []);
    setLoading(false);
  }

  async function handleSave(data) {
    if (editing) {
      await fetch(`/api/teachers/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } else {
      await fetch('/api/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
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
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="btn-primary text-sm"
        >
          + הוסף מורה
        </button>
      </div>

      {(showForm && !editing) && (
        <TeacherForm
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
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
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-white">
                <div>
                  <p className="font-semibold text-gray-800">{t.name}</p>
                  <p className="text-sm text-gray-500">
                    {t.instrument_type} ·{' '}
                    {t.available_days.length > 0
                      ? t.available_days.map((d) => `יום ${d}`).join(', ')
                      : 'אין ימים מוגדרים'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditing(t)} className="text-sm text-blue-600 hover:underline">ערוך</button>
                  <button onClick={() => handleDelete(t.id)} className="text-sm text-red-500 hover:underline">מחק</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
