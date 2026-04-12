'use client';

import { useState, useEffect, useCallback } from 'react';
import StatusSelect from './StatusSelect';
import { getOrchestraForInstruments } from '../lib/autoAssign';

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/registrations');
      const json = await res.json();
      setRows(json.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetch('/api/groups')
      .then(r => r.json())
      .then(j => setGroups(j.data || []))
      .catch(() => {});
    fetch('/api/teachers')
      .then(r => r.json())
      .then(j => setTeachers(j.data || []))
      .catch(() => {});
  }, [fetchData]);

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
      await fetch('/api/update-status', {
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
      setSaved(row.id);
      setTimeout(() => setSaved(null), 3000);
    } finally {
      setUpdating(null);
    }
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
                <>
                  <tr key={row.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(row.created_at).toLocaleDateString('he-IL')}
                    </td>
                    <td className="px-4 py-3 font-medium">{row.student_name}</td>
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
                    <tr key={`${row.id}-expand`} className="bg-primary-50">
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
                                    תיאוריה מוצעת: <strong>יום {row.theory_day || row.assigned_day}</strong>
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
                              {groups.length > 0 && (
                                <select
                                  className="admin-input"
                                  value={selectedGroups[row.id] || ''}
                                  onChange={(e) => setSelectedGroups(prev => ({ ...prev, [row.id]: e.target.value }))}
                                >
                                  <option value="">— הוסף לקבוצה בנוכחות —</option>
                                  {groups.map(g => (
                                    <option key={g.id} value={g.id}>
                                      {g.name}{g.is_mangan_school && g.school_name ? ` (${g.school_name})` : ''}
                                    </option>
                                  ))}
                                </select>
                              )}
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
                </>
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
