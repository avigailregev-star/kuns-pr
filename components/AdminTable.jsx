'use client';

import React, { useState, useEffect, useCallback } from 'react';
import StatusSelect from './StatusSelect';
import { getOrchestraForInstruments } from '../lib/autoAssign';
import { getLessonDuration } from '../lib/lessonDuration';
import { freeMinutesOnDay } from '../lib/teacherCapacity';

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

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
  const [updating, setUpdating] = useState(null);
  const [saved, setSaved] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [selectedGroups, setSelectedGroups] = useState({});
  const [creatingGroupFor, setCreatingGroupFor] = useState(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupType, setNewGroupType] = useState('');

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
      setRows(regJson.data || []);
      setGroups(groupsJson.data || []);
      setTeachers(teachersJson.data || []);
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
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newGroupName.trim(),
        lesson_type: newGroupType,
        teacher_id: teacher?.id || null,
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
                            <h4 className="font-semibold text-gray-700 mb-2">פרטי קשר</h4>
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
                                          for (const r of teacherAssignments) {
                                            if (String(r.assigned_day) !== String(s.day_of_week)) continue;
                                            const rStart = timeToMins(r.assigned_time);
                                            if (rStart == null) continue;
                                            occupied.push({ start: rStart, end: rStart + getLessonDuration(r.selected_course) });
                                          }
                                          const tGroups = groups.filter(g => g.teacher_id === selectedTeacher?.id);
                                          for (const g of tGroups) {
                                            const sched = (g.group_schedules || []).find(sc => String(sc.day_of_week) === String(s.day_of_week));
                                            if (!sched?.start_time) continue;
                                            const gStart = timeToMins(sched.start_time);
                                            const gEnd = sched.end_time ? timeToMins(sched.end_time) : gStart + 60;
                                            occupied.push({ start: gStart, end: gEnd });
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
                                          const isFull = winStart != null && winEnd != null && nextSlotStart === null;
                                          const nextTime = nextSlotStart != null ? minsToTime(nextSlotStart) : s.start_time;
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
                                        <input
                                          type="time"
                                          className="admin-input w-full"
                                          value={row.assigned_time || ''}
                                          onChange={(e) => updateAssignment(row.id, 'assigned_time', e.target.value)}
                                        />
                                      )}
                                      {(() => {
                                        const teacherGroups = groups.filter(g => g.teacher_id === selectedTeacher?.id);
                                        return availRanges.map(s => {
                                          const dayStudents = teacherAssignments.filter(r => String(r.assigned_day) === String(s.day_of_week));
                                          const dayGroups = teacherGroups.filter(g =>
                                            g.group_schedules?.some(sched => String(sched.day_of_week) === String(s.day_of_week))
                                          );
                                          if (dayStudents.length === 0 && dayGroups.length === 0) return null;
                                          return (
                                            <div key={s.day_of_week} className="text-xs flex flex-wrap gap-1 items-center">
                                              <span className="text-gray-500">יום {DAY_NAMES[s.day_of_week]}:</span>
                                              {dayStudents.map(r => (
                                                <span key={r.id} className="bg-amber-50 border border-amber-200 text-amber-700 px-1.5 py-0.5 rounded-md">
                                                  {r.student_name}{r.assigned_time ? ` · ${r.assigned_time}` : ''}
                                                </span>
                                              ))}
                                              {dayGroups.map(g => {
                                                const sched = g.group_schedules?.find(sc => String(sc.day_of_week) === String(s.day_of_week));
                                                return (
                                                  <span key={g.id} className="bg-blue-50 border border-blue-200 text-blue-700 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                                    🎵 {g.name}{sched?.start_time ? ` · ${sched.start_time}` : ''}
                                                    <button
                                                      type="button"
                                                      title="מחק קבוצה"
                                                      onClick={async () => {
                                                        if (!confirm(`למחוק את הקבוצה "${g.name}"?\nתלמידי הקבוצה יוסרו גם כן מאפליקציית הנוכחות.`)) return;
                                                        const res = await fetch('/api/groups', {
                                                          method: 'DELETE',
                                                          headers: { 'Content-Type': 'application/json' },
                                                          body: JSON.stringify({ id: g.id }),
                                                        });
                                                        if (res.ok) {
                                                          setGroups(prev => prev.filter(x => x.id !== g.id));
                                                        } else {
                                                          const j = await res.json();
                                                          alert(j.error || 'שגיאה במחיקה');
                                                        }
                                                      }}
                                                      className="text-blue-300 hover:text-red-500 font-bold leading-none transition-colors"
                                                    >×</button>
                                                  </span>
                                                );
                                              })}
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
                                <select
                                  className="admin-input"
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
                          <div className="sm:col-span-2">
                            <h4 className="font-semibold text-gray-700 mb-2">הערות מנהל</h4>
                            <textarea
                              className="admin-input h-20 resize-none"
                              value={row.admin_notes || ''}
                              onChange={(e) => updateAssignment(row.id, 'admin_notes', e.target.value)}
                              onBlur={(e) => saveNotes(row.id, e.target.value)}
                              placeholder="הוסף הערות פנימיות..."
                            />
                          </div>

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
