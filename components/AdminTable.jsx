'use client';

import React, { useState, useEffect, useCallback } from 'react';
import StatusSelect from './StatusSelect';
import { getOrchestraForInstruments } from '../lib/autoAssign';
import { getLessonDuration } from '../lib/lessonDuration';
import { freeMinutesOnDay } from '../lib/teacherCapacity';

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const INDIVIDUAL_LESSON_TYPES = new Set(['individual_45', 'individual_60', 'melodies_individual']);

function timeToMins(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}
function minsToTime(m) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

const TYPE_LABELS = {
  new: 'חדש/ה',
  continue: 'ממשיך/ה',
  adult: 'בוגר/ת',
  trial: 'ניסיון',
};

function exportToCSV(rows) {
  const headers = ['תאריך', 'תלמיד/ה', 'הורה', 'טלפון', 'אימייל', 'סוג', 'כלים', 'סטטוס', 'מורה', 'יום', 'שעה', 'הערות'];
  const csvRows = rows.map(r => [
    new Date(r.created_at).toLocaleDateString('he-IL'),
    r.student_name || '',
    r.parent_name || '',
    r.parent_phone || '',
    r.parent_email || '',
    TYPE_LABELS[r.type] || r.type || '',
    Array.isArray(r.instruments) ? r.instruments.join('; ') : r.instruments || '',
    r.status || '',
    r.teacher || '',
    r.assigned_day || '',
    r.assigned_time || '',
    r.admin_notes || '',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

  const bom = '\uFEFF';
  const csv = bom + [headers.join(','), ...csvRows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `רישומים_${new Date().toLocaleDateString('he-IL').replace(/\//g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function printTable(rows) {
  const content = `
    <html dir="rtl"><head><meta charset="utf-8">
    <title>רישומים</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: right; }
      th { background: #f0f0f0; font-weight: bold; }
      tr:nth-child(even) { background: #f9f9f9; }
    </style></head><body>
    <h2>רישומים – קונסרבטוריון</h2>
    <table>
      <thead><tr><th>תאריך</th><th>תלמיד/ה</th><th>הורה</th><th>טלפון</th><th>סוג</th><th>כלים</th><th>סטטוס</th><th>מורה</th></tr></thead>
      <tbody>
        ${rows.map(r => `<tr>
          <td>${new Date(r.created_at).toLocaleDateString('he-IL')}</td>
          <td>${r.student_name || ''}</td>
          <td>${r.parent_name || ''}</td>
          <td>${r.parent_phone || ''}</td>
          <td>${TYPE_LABELS[r.type] || r.type || ''}</td>
          <td>${Array.isArray(r.instruments) ? r.instruments.join(', ') : r.instruments || ''}</td>
          <td>${r.status || ''}</td>
          <td>${r.teacher || ''}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    </body></html>`;
  const win = window.open('', '_blank');
  win.document.write(content);
  win.document.close();
  win.print();
}

function RegistrationStatusBadge({ status }) {
  const map = {
    Confirmed: { label: 'שולם', cls: 'bg-green-100 text-green-800' },
    Pending:   { label: 'ממתין', cls: 'bg-yellow-100 text-yellow-800' },
    Cancelled: { label: 'בוטל', cls: 'bg-gray-100 text-gray-500' },
  };
  const { label, cls } = map[status] || map.Pending;
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

export default function AdminTable() {
  const [rows, setRows] = useState([]);
  const [groups, setGroups] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [clearingTimes, setClearingTimes] = useState(false);
  const [updating, setUpdating] = useState(null);
  const [saved, setSaved] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [selectedGroups, setSelectedGroups] = useState({});
  const [creatingGroupFor, setCreatingGroupFor] = useState(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupType, setNewGroupType] = useState('');
  const [editingDetails, setEditingDetails] = useState({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [regRes, groupsRes, teachersRes] = await Promise.all([
        fetch('/api/registrations'),
        fetch('/api/groups'),
        fetch('/api/teachers'),
      ]);
      const [regJson, groupsJson, teachersJson] = await Promise.all([
        regRes.json(),
        groupsRes.json(),
        teachersRes.json(),
      ]);
      const teachersList = teachersJson.data || [];
      const regs = (regJson.data || []).map(row => {
        if (row.teacher) return row;
        const byCourse = teachersList.find(t =>
          Array.isArray(t.courses) && t.courses.includes(row.selected_course)
        );
        if (byCourse) return { ...row, teacher: byCourse.name };
        const scored = teachersList
          .map(t => {
            const parts = (t.name?.split(' ') ?? []).filter(p => p && (row.selected_course || '').includes(p));
            return { t, score: parts.length };
          })
          .filter(x => x.score > 0)
          .sort((a, b) => b.score - a.score);
        return scored[0]?.t ? { ...row, teacher: scored[0].t.name } : row;
      });
      setRows(regs);
      setGroups(groupsJson.data || []);
      setTeachers(teachersList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function refreshTeachers() {
    const res = await fetch('/api/teachers');
    const json = await res.json();
    setTeachers(json.data || []);
  }

  async function updateStatus(id, newStatus) {
    setUpdating(id);
    try {
      await fetch('/api/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, newStatus }),
      });
      setRows((prev) =>
        prev.map((r) => r.id === id ? { ...r, status: newStatus } : r)
      );
    } finally {
      setUpdating(null);
    }
  }

  async function updateAssignment(id, field, value) {
    setRows((prev) =>
      prev.map((r) => r.id === id ? { ...r, [field]: value } : r)
    );
  }

  async function saveAssignment(row) {
    setUpdating(row.id);
    const orchestraAuto = row.type === 'continue'
      ? (row.orchestra || getOrchestraForInstruments(row.instruments))
      : undefined;
    try {
      const res = await fetch('/api/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: row.id,
          newStatus: row.status,
          teacher: row.teacher,
          assignedDay: row.assigned_day,
          assignedTime: row.assigned_time,
          assignedEndTime: row.assigned_end_time || (row.assigned_time ? minsToTime(timeToMins(row.assigned_time) + getLessonDuration(row.selected_course)) : undefined),
          adminNotes: row.admin_notes,
          groupId: selectedGroups[row.id] || null,
          orchestra: orchestraAuto,
          theoryDay: row.theory_day,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error || 'שגיאה בשמירה — נסה שוב');
        return;
      }
      setSaved(row.id);
      setTimeout(() => setSaved(null), 3000);
      const selGroupId = selectedGroups[row.id];
      if (selGroupId) {
        const grp = groups.find(g => String(g.id) === String(selGroupId));
        setRows(prev => prev.map(r => r.id === row.id
          ? { ...r, group_id: selGroupId, ...(grp?.name ? { selected_course: grp.name } : {}) }
          : r
        ));
      }
      await refreshTeachers();
    } catch {
      alert('שגיאת רשת — בדוק חיבור ונסה שוב');
    } finally {
      setUpdating(null);
    }
  }

  async function handleCreateGroup(rowId, teacherName, assignedDay, assignedTime) {
    if (!newGroupName.trim() || !newGroupType) return;
    const teacher = teachers.find(t => t.name === teacherName);
    if (!teacher?.id) {
      alert('יש לבחור מורה לפני יצירת קבוצה');
      return;
    }
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newGroupName.trim(),
        lesson_type: newGroupType,
        teacher_id: teacher.id,
        assigned_day: assignedDay ?? null,
        assigned_time: assignedTime ?? null,
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
    setNewGroupName('');
    setNewGroupType('');
  }

  async function saveNotes(id, notes) {
    await fetch('/api/registrations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, admin_notes: notes }),
    });
  }

  async function saveDetails(id) {
    const details = editingDetails[id];
    if (!details) return;
    setUpdating(id);
    try {
      await fetch('/api/registrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...details, updated_at: new Date().toISOString() }),
      });
      setRows(prev => prev.map(r => r.id === id ? { ...r, ...details } : r));
      setEditingDetails(prev => { const n = { ...prev }; delete n[id]; return n; });
    } finally {
      setUpdating(null);
    }
  }

  async function clearUnassignedTimes() {
    if (!confirm('פעולה זו תנקה את שדה השעה מכל הרשומות בסטטוס "חדש".\nהנרשמים עצמם לא יימחקו. להמשיך?')) return;
    setClearingTimes(true);
    try {
      const res = await fetch('/api/admin/clear-times', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) { alert(json.error || 'שגיאה'); return; }
      alert(`נוקו שעות מ-${json.cleared} רשומות`);
      await fetchData();
    } finally {
      setClearingTimes(false);
    }
  }

  async function deleteRegistration(id, studentName) {
    if (!confirm(`למחוק לחלוטין את הרישום של ${studentName}?\nפעולה זו אינה הפיכה.`)) return;
    setUpdating(id);
    try {
      await fetch('/api/registrations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setRows(prev => prev.filter(r => r.id !== id));
      setExpandedRow(null);
    } finally {
      setUpdating(null);
    }
  }

  async function updatePaymentStatus(id, newPaymentStatus) {
    setUpdating(id);
    try {
      await fetch('/api/registrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, registration_status: newPaymentStatus }),
      });
      setRows((prev) => prev.map((r) => r.id === id ? { ...r, registration_status: newPaymentStatus } : r));
    } finally {
      setUpdating(null);
    }
  }

  const filtered = rows.filter((r) => {
    const matchSearch =
      !search ||
      r.student_name?.includes(search) ||
      r.parent_name?.includes(search) ||
      r.parent_phone?.includes(search);
    const matchStatus = !filterStatus || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <span className="text-2xl animate-spin ml-2">⏳</span> טוען נתונים...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'סה"כ', value: rows.length, color: 'text-gray-800' },
          { label: 'חדשים', value: rows.filter(r => r.status === 'חדש').length, color: 'text-blue-600' },
          { label: 'בבדיקה', value: rows.filter(r => r.status === 'בבדיקה').length, color: 'text-yellow-600' },
          { label: 'שובצו', value: rows.filter(r => r.status === 'שובץ').length, color: 'text-green-600' },
        ].map((stat) => (
          <div key={stat.label} className="card text-center py-3">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-gray-500">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="🔍 חיפוש לפי שם / טלפון..."
          className="form-input flex-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="form-input sm:w-40"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">כל הסטטוסים</option>
          <option value="חדש">חדש</option>
          <option value="בבדיקה">בבדיקה</option>
          <option value="שובץ">שובץ</option>
          <option value="נדחה">נדחה</option>
        </select>
        <button
          onClick={fetchData}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
        >
          🔄 רענן
        </button>
        <button
          onClick={clearUnassignedTimes}
          disabled={clearingTimes}
          className="px-4 py-2 border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 text-sm disabled:opacity-50"
        >
          {clearingTimes ? 'מנקה...' : '🧹 נקה שעות מרשומות חדש'}
        </button>
        <button
          onClick={() => exportToCSV(filtered)}
          className="px-4 py-2 border border-green-300 text-green-700 rounded-lg hover:bg-green-50 text-sm"
        >
          📊 ייצוא Excel
        </button>
        <button
          onClick={() => printTable(filtered)}
          className="px-4 py-2 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 text-sm"
        >
          🖨️ הדפסה
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">תאריך</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">תלמיד/ה</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">הורה / טלפון</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">סוג</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">כלים</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">סטטוס</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">תשלום</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-400">
                    לא נמצאו רישומים
                  </td>
                </tr>
              )}
              {filtered.map((row) => (
                <React.Fragment key={row.id}>
                  <tr className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(row.created_at).toLocaleDateString('he-IL')}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {row.student_name}
                      {row.attended_open_day === false && (
                        <span className="mr-1 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">
                          טרם שיחת היכרות
                        </span>
                      )}
                      {row.has_accommodations && (
                        <span className="mr-1 text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full font-medium">
                          התאמות
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      <div>{row.parent_name}</div>
                      <div className="text-xs" dir="ltr">{row.parent_phone}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {TYPE_LABELS[row.type] || row.type}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {Array.isArray(row.instruments) && row.instruments.length > 0
                        ? row.instruments.join(', ')
                        : row.selected_course || '—'}
                      {row.teacher && row.assigned_day != null && (
                        <div className="mt-0.5 text-green-700 font-medium">
                          {row.teacher} · יום {DAY_NAMES[Number(row.assigned_day)]}
                          {row.assigned_time ? ` ${row.assigned_time.slice(0,5)}` : ''}
                          {row.assigned_end_time ? `–${row.assigned_end_time.slice(0,5)}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusSelect
                        value={row.status}
                        onChange={(val) => updateStatus(row.id, val)}
                        disabled={updating === row.id}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <RegistrationStatusBadge status={row.registration_status} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
                        className="text-primary text-xs hover:underline"
                      >
                        {expandedRow === row.id ? '▲ סגור' : '▼ פרטים'}
                      </button>
                    </td>
                  </tr>

                  {/* Expanded row */}
                  {expandedRow === row.id && (
                    <tr className="bg-primary-50">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Contact */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold text-gray-700">פרטי קשר</h4>
                              {!editingDetails[row.id] && (
                                <button
                                  type="button"
                                  onClick={() => setEditingDetails(prev => ({ ...prev, [row.id]: {
                                    student_name: row.student_name,
                                    parent_name: row.parent_name,
                                    parent_phone: row.parent_phone,
                                    parent_email: row.parent_email,
                                  }}))}
                                  className="text-xs text-blue-600 hover:underline"
                                >
                                  ✏️ ערוך
                                </button>
                              )}
                            </div>
                            {editingDetails[row.id] ? (
                              <div className="space-y-2">
                                <div>
                                  <label className="text-xs text-gray-500">שם תלמיד/ה</label>
                                  <input
                                    className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm"
                                    value={editingDetails[row.id].student_name || ''}
                                    onChange={e => setEditingDetails(prev => ({ ...prev, [row.id]: { ...prev[row.id], student_name: e.target.value }}))}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-500">שם הורה</label>
                                  <input
                                    className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm"
                                    value={editingDetails[row.id].parent_name || ''}
                                    onChange={e => setEditingDetails(prev => ({ ...prev, [row.id]: { ...prev[row.id], parent_name: e.target.value }}))}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-500">טלפון</label>
                                  <input
                                    className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm"
                                    dir="ltr"
                                    value={editingDetails[row.id].parent_phone || ''}
                                    onChange={e => setEditingDetails(prev => ({ ...prev, [row.id]: { ...prev[row.id], parent_phone: e.target.value }}))}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-gray-500">אימייל</label>
                                  <input
                                    className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm"
                                    dir="ltr"
                                    value={editingDetails[row.id].parent_email || ''}
                                    onChange={e => setEditingDetails(prev => ({ ...prev, [row.id]: { ...prev[row.id], parent_email: e.target.value }}))}
                                  />
                                </div>
                                <div className="flex gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => saveDetails(row.id)}
                                    disabled={updating === row.id}
                                    className="text-xs px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                                  >
                                    שמור
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingDetails(prev => { const n = { ...prev }; delete n[row.id]; return n; })}
                                    className="text-xs px-3 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
                                  >
                                    ביטול
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="text-sm text-gray-600">👤 {row.parent_name}</p>
                                <p className="text-sm text-gray-600" dir="ltr">📞 {row.parent_phone}</p>
                                <p className="text-sm text-gray-600">📧 {row.parent_email}</p>
                                <p className="text-sm text-gray-600">
                                  📅 שיחה טלפונית בזמן רצוי: {row.preferred_slot || '—'}
                                </p>
                                <p className="text-sm text-gray-600">
                                  🚫 ימים לא פנויים:{' '}
                                  {Array.isArray(row.unavailable_days) && row.unavailable_days.length > 0
                                    ? row.unavailable_days.map(d => `יום ${d}`).join(', ')
                                    : 'ללא הגבלה'}
                                </p>
                              </>
                            )}
                          </div>

                          {/* Auto-assignment suggestions for continuing students */}
                          {row.type === 'continue' && (
                            <div className="space-y-2 mb-3">
                              <h4 className="font-semibold text-gray-700 mb-1">שיבוץ אוטומטי</h4>
                              {getOrchestraForInstruments(row.instruments) && (
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 border border-green-200 text-sm">
                                  <span className="text-green-600">🎼</span>
                                  <span className="text-green-700">
                                    תזמורת/מקהלה: <strong>{row.orchestra || getOrchestraForInstruments(row.instruments)}</strong>
                                  </span>
                                  {!row.orchestra && (
                                    <button
                                      type="button"
                                      onClick={() => updateAssignment(row.id, 'orchestra', getOrchestraForInstruments(row.instruments))}
                                      className="mr-auto text-xs text-green-600 underline"
                                    >
                                      אשר
                                    </button>
                                  )}
                                </div>
                              )}
                              {row.assigned_day && (
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 border border-blue-200 text-sm">
                                  <span className="text-blue-600">📚</span>
                                  <span className="text-blue-700">
                                    תיאוריה מוצעת: <strong>יום {(() => { const d = row.theory_day ?? row.assigned_day; const n = Number(d); return (!isNaN(n) && n >= 0 && n <= 6) ? DAY_NAMES[n] : d; })()}</strong>
                                  </span>
                                  {!row.theory_day && (
                                    <button
                                      type="button"
                                      onClick={() => updateAssignment(row.id, 'theory_day', row.assigned_day)}
                                      className="mr-auto text-xs text-blue-600 underline"
                                    >
                                      אשר
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Assignment */}
                          <div>
                            <h4 className="font-semibold text-gray-700 mb-2">שיבוץ</h4>
                            <div className="space-y-2">
                              <select
                                className="admin-input"
                                value={row.teacher || ''}
                                onChange={(e) => updateAssignment(row.id, 'teacher', e.target.value)}
                              >
                                <option value="">— בחר מורה —</option>
                                {teachers.map(t => (
                                  <option key={t.id} value={t.name}>{t.name}{t.instrument_type ? ` (${t.instrument_type})` : ''}</option>
                                ))}
                              </select>
                              {(() => {
                                const selectedTeacher = teachers.find(t => t.name === row.teacher);
                                const days = selectedTeacher?.available_days || [];
                                const hours = selectedTeacher?.available_hours || {};

                                // Days from attendance app via teacher_availability_ranges
                                const availRanges = (selectedTeacher?.teacher_availability_ranges || [])
                                  .slice()
                                  .sort((a, b) => a.day_of_week - b.day_of_week);

                                if (availRanges.length > 0) {
                                  const lessonDuration = getLessonDuration(row.selected_course);
                                  const teacherAssignments = rows.filter(r =>
                                    r.teacher === row.teacher &&
                                    r.id !== row.id &&
                                    r.assigned_day != null &&
                                    !['בוטל', 'ממתין לשיחת היכרות', 'רשימת המתנה'].includes(r.status) &&
                                    r.registration_status !== 'Cancelled'
                                  );
                                  return (
                                    <div className="space-y-2">
                                      <div className="flex gap-1 flex-wrap">
                                        {availRanges.map((s, i) => {
                                          const isSelected = String(row.assigned_day) === String(s.day_of_week);
                                          const winStart = timeToMins(s.start_time);
                                          const winEnd = timeToMins(s.end_time);
                                          const occupied = [];
                                          let hasOnlyGroupOccupied = true;
                                          for (const r of teacherAssignments) {
                                            if (String(r.assigned_day) !== String(s.day_of_week)) continue;
                                            const rStart = timeToMins(r.assigned_time);
                                            if (rStart == null) continue;
                                            occupied.push({ start: rStart, end: rStart + getLessonDuration(r.selected_course) });
                                            const rGroup = r.group_id ? groups.find(g => String(g.id) === String(r.group_id)) : null;
                                            if (!rGroup || INDIVIDUAL_LESSON_TYPES.has(rGroup.lesson_type)) hasOnlyGroupOccupied = false;
                                          }
                                          const tGroups = groups.filter(g => g.teacher_id === selectedTeacher?.id);
                                          for (const g of tGroups) {
                                            const sched = (g.group_schedules || []).find(sc => String(sc.day_of_week) === String(s.day_of_week));
                                            if (!sched?.start_time) continue;
                                            const gStart = timeToMins(sched.start_time);
                                            const gEnd = sched.end_time ? timeToMins(sched.end_time) : gStart + 60;
                                            occupied.push({ start: gStart, end: gEnd });
                                            if (INDIVIDUAL_LESSON_TYPES.has(g.lesson_type)) hasOnlyGroupOccupied = false;
                                          }
                                          occupied.sort((a, b) => a.start - b.start);
                                          let cursor = winStart ?? 0;
                                          let nextSlotStart = null;
                                          if (winStart != null) {
                                            for (const occ of occupied) {
                                              const occStart = Math.max(occ.start, winStart);
                                              const occEnd = winEnd != null ? Math.min(occ.end, winEnd) : occ.end;
                                              if (occStart >= (winEnd ?? Infinity)) break;
                                              if (cursor + lessonDuration <= occStart) { nextSlotStart = cursor; break; }
                                              if (occEnd > cursor) cursor = occEnd;
                                            }
                                            if (nextSlotStart === null && (winEnd == null || cursor + lessonDuration <= winEnd)) {
                                              nextSlotStart = cursor;
                                            }
                                          }
                                          const selectedGroupId = selectedGroups[row.id];
                                          const selectedGroupSched = selectedGroupId
                                            ? groups.find(g => String(g.id) === String(selectedGroupId))
                                                ?.group_schedules?.find(sc => String(sc.day_of_week) === String(s.day_of_week))
                                            : null;
                                          const isFull = !selectedGroupSched && !hasOnlyGroupOccupied && winStart != null && winEnd != null && nextSlotStart === null;
                                          const nextTime = selectedGroupSched?.start_time
                                            ? selectedGroupSched.start_time
                                            : (nextSlotStart != null ? minsToTime(nextSlotStart) : s.start_time);
                                          let gapEnd = winEnd;
                                          if (nextSlotStart != null) {
                                            for (const occ of occupied) {
                                              if (occ.start > nextSlotStart) { gapEnd = occ.start; break; }
                                            }
                                          }
                                          const slotEndTime = gapEnd != null ? minsToTime(gapEnd) : s.end_time;
                                          return (
                                            <button
                                              key={i}
                                              type="button"
                                              disabled={isFull}
                                              onClick={() => {
                                                if (isFull) return;
                                                updateAssignment(row.id, 'assigned_day', s.day_of_week);
                                                updateAssignment(row.id, 'assigned_time', nextTime || s.start_time || '');
                                              }}
                                              className={`px-3 py-1 rounded-lg text-sm border transition-all ${
                                                isFull
                                                  ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                                                  : isSelected
                                                  ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                                                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
                                              }`}
                                            >
                                              יום {DAY_NAMES[s.day_of_week] ?? s.day_of_week}
                                              {isFull ? (
                                                <span className="text-xs mr-1 text-red-400">לא פנוי</span>
                                              ) : (
                                                s.start_time && (
                                                  <span className="text-xs opacity-60 mr-1">
                                                    {s.start_time.slice(0,5)}{s.end_time ? `–${s.end_time.slice(0,5)}` : ''}
                                                  </span>
                                                )
                                              )}
                                            </button>
                                          );
                                        })}
                                      </div>
                                      {row.assigned_day != null && row.assigned_day !== '' && (
                                        <div className="flex gap-2 items-center">
                                          <input
                                            type="time"
                                            dir="ltr"
                                            className="admin-input flex-1"
                                            value={row.assigned_time || ''}
                                            onChange={(e) => updateAssignment(row.id, 'assigned_time', e.target.value)}
                                          />
                                          {row.assigned_time && (
                                            <>
                                              <span className="text-xs text-gray-400 shrink-0">עד</span>
                                              <input
                                                type="time"
                                                dir="ltr"
                                                className="admin-input flex-1"
                                                value={row.assigned_end_time || minsToTime(timeToMins(row.assigned_time) + getLessonDuration(row.selected_course))}
                                                onChange={(e) => updateAssignment(row.id, 'assigned_end_time', e.target.value)}
                                              />
                                            </>
                                          )}
                                        </div>
                                      )}
                                      {(() => {
                                        const teacherGroups = groups.filter(g => g.teacher_id === selectedTeacher?.id);
                                        return availRanges.map(s => {
                                          const dayGroups = teacherGroups.filter(g =>
                                            g.group_schedules?.some(sched => String(sched.day_of_week) === String(s.day_of_week))
                                          );
                                          const dayGroupIds = new Set(dayGroups.map(g => String(g.id)));
                                          // Hide students already represented by a group badge
                                          const dayStudents = teacherAssignments.filter(r =>
                                            String(r.assigned_day) === String(s.day_of_week) &&
                                            (!r.group_id || !dayGroupIds.has(String(r.group_id)))
                                          );
                                          if (dayStudents.length === 0 && dayGroups.length === 0) return null;
                                          const items = [
                                            ...dayGroups.map(g => {
                                              const sched = g.group_schedules?.find(sc => String(sc.day_of_week) === String(s.day_of_week));
                                              return { key: g.id, time: sched?.start_time || '', type: 'group', group: g, sched };
                                            }),
                                            ...dayStudents.map(r => ({ key: r.id, time: r.assigned_time || '', type: 'student', reg: r })),
                                          ].sort((a, b) => a.time.localeCompare(b.time));
                                          return (
                                            <div key={s.day_of_week} className="text-xs flex flex-wrap gap-1 items-center">
                                              <span className="text-gray-500 shrink-0">יום {DAY_NAMES[s.day_of_week]}:</span>
                                              {items.map(item => item.type === 'group' ? (
                                                <span key={item.key} className="bg-blue-50 border border-blue-200 text-blue-700 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                                  🎵 {item.group.name}{item.sched?.start_time ? ` · ${item.sched.start_time}${item.sched.end_time ? `–${item.sched.end_time.slice(0,5)}` : ''}` : ''}
                                                  <button
                                                    type="button"
                                                    title="מחק קבוצה"
                                                    onClick={async () => {
                                                      if (!confirm(`למחוק את הקבוצה "${item.group.name}"?\nתלמידי הקבוצה יוסרו גם כן מאפליקציית הנוכחות.`)) return;
                                                      const res = await fetch('/api/groups', {
                                                        method: 'DELETE',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ id: item.group.id }),
                                                      });
                                                      if (res.ok) {
                                                        setGroups(prev => prev.filter(x => x.id !== item.group.id));
                                                      } else {
                                                        const j = await res.json();
                                                        alert(j.error || 'שגיאה במחיקה');
                                                      }
                                                    }}
                                                    className="text-blue-300 hover:text-red-500 font-bold leading-none transition-colors"
                                                  >×</button>
                                                </span>
                                              ) : (
                                                <span key={item.key} className="bg-amber-50 border border-amber-200 text-amber-700 px-1.5 py-0.5 rounded-md">
                                                  {item.reg.student_name}{item.reg.assigned_time ? ` · ${item.reg.assigned_time}` : ''}
                                                </span>
                                              ))}
                                            </div>
                                          );
                                        });
                                      })()}
                                    </div>
                                  );
                                }

                                if (days.length > 0) {
                                  return (
                                    <div className="space-y-2">
                                      <div className="flex gap-1 flex-wrap">
                                        {days.map(d => {
                                          const lessonDuration = getLessonDuration(row.selected_course);
                                          const free = freeMinutesOnDay(hours, d, selectedTeacher?.used_minutes_per_day?.[d]);
                                          const isFull = free < lessonDuration;
                                          return (
                                            <button
                                              key={d}
                                              type="button"
                                              disabled={isFull}
                                              onClick={() => {
                                                if (isFull) return;
                                                updateAssignment(row.id, 'assigned_day', d);
                                                updateAssignment(row.id, 'assigned_time', '');
                                              }}
                                              className={`px-3 py-1 rounded-lg text-sm border transition-all ${
                                                isFull
                                                  ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                                                  : row.assigned_day === d
                                                  ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                                                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
                                              }`}
                                            >
                                              יום {d}
                                              {isFull
                                                ? <span className="text-xs mr-1 text-red-400">מלא</span>
                                                : hours[d] && <span className="text-xs opacity-60 mr-1">{hours[d].from}–{hours[d].to}</span>
                                              }
                                            </button>
                                          );
                                        })}
                                      </div>
                                      {row.assigned_day && (
                                        <input
                                          type="time"
                                          dir="ltr"
                                          className="admin-input w-full"
                                          value={row.assigned_time || ''}
                                          min={hours[row.assigned_day]?.from}
                                          max={hours[row.assigned_day]?.to}
                                          onChange={(e) => updateAssignment(row.id, 'assigned_time', e.target.value)}
                                        />
                                      )}
                                    </div>
                                  );
                                }

                                return (
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      placeholder="יום השיעור"
                                      className="admin-input flex-1"
                                      value={row.assigned_day || ''}
                                      onChange={(e) => updateAssignment(row.id, 'assigned_day', e.target.value)}
                                    />
                                    <input
                                      type="text"
                                      placeholder="שעה"
                                      className="admin-input flex-1"
                                      value={row.assigned_time || ''}
                                      onChange={(e) => updateAssignment(row.id, 'assigned_time', e.target.value)}
                                    />
                                  </div>
                                );
                              })()}
                              {creatingGroupFor === row.id ? (
                                <div className="space-y-2">
                                  <input
                                    autoFocus
                                    type="text"
                                    className="admin-input w-full"
                                    placeholder="שם הקבוצה החדשה"
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Escape') { setCreatingGroupFor(null); setNewGroupName(''); setNewGroupType(''); }
                                    }}
                                  />
                                  <select
                                    className="admin-input w-full"
                                    value={newGroupType}
                                    onChange={(e) => setNewGroupType(e.target.value)}
                                  >
                                    <option value="">— סוג שיעור —</option>
                                    <option value="individual_45">פרטני 45 דקות</option>
                                    <option value="individual_60">פרטני 60 דקות</option>
                                    <option value="group">קבוצתי</option>
                                    <option value="orchestra">תזמורת</option>
                                    <option value="choir">מקהלה</option>
                                    <option value="theory">תיאוריה</option>
                                    <option value="melodies_individual">מנגינות פרטני</option>
                                    <option value="melodies_group">מנגינות קבוצתי</option>
                                  </select>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleCreateGroup(row.id, row.teacher, row.assigned_day, row.assigned_time)}
                                      disabled={!newGroupName.trim() || !newGroupType}
                                      className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      צור שיעור
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setCreatingGroupFor(null); setNewGroupName(''); setNewGroupType(''); }}
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
                                        setNewGroupName('');
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
                              {(() => {
                                const selId = selectedGroups[row.id];
                                if (!selId) return null;
                                const grp = groups.find(g => String(g.id) === String(selId));
                                const schedules = grp?.group_schedules || [];
                                if (schedules.length === 0) return null;
                                return (
                                  <div className="flex flex-wrap gap-2 mt-1">
                                    {schedules
                                      .slice()
                                      .sort((a, b) => a.day_of_week - b.day_of_week)
                                      .map((s, i) => (
                                        <span key={i} className="text-xs bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-2 py-1">
                                          יום {DAY_NAMES[s.day_of_week] ?? s.day_of_week}
                                          {s.start_time && s.end_time ? ` · ${s.start_time}–${s.end_time}` : s.start_time ? ` · ${s.start_time}` : ''}
                                        </span>
                                      ))}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Notes */}
                          <div className={row.availability_notes ? '' : 'sm:col-span-2'}>
                            <h4 className="font-semibold text-gray-700 mb-2">הערות מנהל</h4>
                            <textarea
                              className="admin-input h-20 resize-none"
                              value={row.admin_notes || ''}
                              onChange={(e) => updateAssignment(row.id, 'admin_notes', e.target.value)}
                              onBlur={(e) => saveNotes(row.id, e.target.value)}
                              placeholder="הוסף הערות פנימיות..."
                            />
                          </div>
                          {row.availability_notes && (
                            <div>
                              <h4 className="font-semibold text-gray-700 mb-2">הערות זמינות</h4>
                              <div className="admin-input h-20 overflow-y-auto text-sm text-gray-600 bg-amber-50 border-amber-200">
                                {row.availability_notes}
                              </div>
                            </div>
                          )}

                          {/* Message log */}
                          {row.message_log && row.message_log.length > 0 && (
                            <div className="sm:col-span-2">
                              <h4 className="font-semibold text-gray-700 mb-2">לוג הודעות</h4>
                              <div className="space-y-1">
                                {row.message_log.map((log, i) => (
                                  <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
                                    <span className={log.status === 'sent' ? 'text-green-600' : 'text-yellow-600'}>
                                      {log.status === 'sent' ? '✓' : '⏳'}
                                    </span>
                                    <span>{log.action}</span>
                                    {log.sent_at && (
                                      <span>{new Date(log.sent_at).toLocaleString('he-IL')}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Save button + payment status buttons */}
                          <div className="sm:col-span-2 flex flex-wrap items-center gap-2 justify-end">
                            <button
                              onClick={() => deleteRegistration(row.id, row.student_name)}
                              disabled={updating === row.id}
                              className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-40 disabled:cursor-not-allowed ml-auto"
                            >
                              🗑 מחק רישום
                            </button>
                            <button
                              onClick={() => updatePaymentStatus(row.id, 'Confirmed')}
                              disabled={updating === row.id || row.registration_status === 'Confirmed'}
                              className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              ✓ סמן כשולם
                            </button>
                            <button
                              onClick={() => updatePaymentStatus(row.id, 'Cancelled')}
                              disabled={updating === row.id || row.registration_status === 'Cancelled'}
                              className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              ✗ בטל
                            </button>
                            <button
                              onClick={() => updatePaymentStatus(row.id, 'Pending')}
                              disabled={updating === row.id || row.registration_status === 'Pending'}
                              className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              ↺ ממתין
                            </button>
                            <button
                              onClick={() => saveAssignment(row)}
                              disabled={updating === row.id}
                              className={`text-sm px-4 py-2 rounded-xl font-semibold transition-colors ${saved === row.id ? 'bg-green-500 text-white' : 'btn-primary'}`}
                            >
                              {updating === row.id ? '⏳ שומר...' : saved === row.id ? '✓ נשמר!' : '💾 שמור שיבוץ'}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-left">
        מציג {filtered.length} מתוך {rows.length} רישומים
      </p>
    </div>
  );
}
