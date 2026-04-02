'use client';

import { useState, useEffect, useCallback } from 'react';
import StatusSelect from './StatusSelect';

const TYPE_LABELS = {
  new: 'חדש/ה',
  continue: 'ממשיך/ה',
  adult: 'בוגר/ת',
  trial: 'ניסיון',
};

export default function AdminTable() {
  const [rows, setRows] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [updating, setUpdating] = useState(null);
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
        }),
      });
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
                <th className="px-4 py-3 text-right font-semibold text-gray-600">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400">
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
                      {Array.isArray(row.instruments) ? row.instruments.join(', ') : row.instruments}
                    </td>
                    <td className="px-4 py-3">
                      <StatusSelect
                        value={row.status}
                        onChange={(val) => updateStatus(row.id, val)}
                        disabled={updating === row.id}
                      />
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
                      <td colSpan={7} className="px-6 py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Contact */}
                          <div>
                            <h4 className="font-semibold text-gray-700 mb-2">פרטי קשר</h4>
                            <p className="text-sm text-gray-600">📧 {row.parent_email}</p>
                            <p className="text-sm text-gray-600">
                              📅 מועד רצוי: {row.preferred_slot || '—'}
                            </p>
                            <p className="text-sm text-gray-600">
                              🚫 ימים לא פנויים:{' '}
                              {Array.isArray(row.unavailable_days) && row.unavailable_days.length > 0
                                ? row.unavailable_days.map(d => `יום ${d}`).join(', ')
                                : 'ללא הגבלה'}
                            </p>
                          </div>

                          {/* Assignment */}
                          <div>
                            <h4 className="font-semibold text-gray-700 mb-2">שיבוץ</h4>
                            <div className="space-y-2">
                              <input
                                type="text"
                                placeholder="שם המורה"
                                className="form-input text-sm"
                                value={row.teacher || ''}
                                onChange={(e) => updateAssignment(row.id, 'teacher', e.target.value)}
                              />
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="יום השיעור"
                                  className="form-input text-sm flex-1"
                                  value={row.assigned_day || ''}
                                  onChange={(e) => updateAssignment(row.id, 'assigned_day', e.target.value)}
                                />
                                <input
                                  type="text"
                                  placeholder="שעה"
                                  className="form-input text-sm flex-1"
                                  value={row.assigned_time || ''}
                                  onChange={(e) => updateAssignment(row.id, 'assigned_time', e.target.value)}
                                />
                              </div>
                              {groups.length > 0 && (
                                <select
                                  className="form-input text-sm"
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
                              className="form-input text-sm h-20 resize-none"
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

                          {/* Save button */}
                          <div className="sm:col-span-2 flex justify-end">
                            <button
                              onClick={() => saveAssignment(row)}
                              disabled={updating === row.id}
                              className="btn-primary text-sm"
                            >
                              {updating === row.id ? '⏳ שומר...' : '💾 שמור שיבוץ'}
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
