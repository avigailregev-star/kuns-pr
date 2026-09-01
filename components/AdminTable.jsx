'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { STATUS_OPTIONS, STATUS_COLORS } from './StatusSelect';
import { INSTRUMENTS } from './InstrumentPicker';
import AssignmentPanel from './AssignmentPanel';
import { getOrchestraForInstruments } from '../lib/autoAssign';
import { getLessonDuration } from '../lib/lessonDuration';
import { getLessonTypeValue, computeGroupName, matchesGroupLabel } from '../lib/groupNaming';
import { assignRowColors, downloadExcelFile, paymentStatusLabel } from '../lib/excelExport';
import { filterRegistrations } from '../lib/registrationFilters';
import { groupStudentRows } from '../lib/groupStudentRows';
import { labelsForCategories, mergeFixedLessonTypes } from '../lib/fixedLessonTypes';

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const INDIVIDUAL_LESSON_TYPES = new Set(['individual_45', 'individual_60', 'melodies_individual']);
const LOCKED_ASSIGNMENT_STATUSES = ['נדחה', 'בוטל', 'רשימת המתנה'];

function timeToMins(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}
function minsToTime(m) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const TYPE_LABELS = {
  new: 'חדש/ה',
  continue: 'ממשיך/ה',
  adult: 'בוגר/ת',
  trial: 'ניסיון',
};

function getTypeLabel(row) {
  if (row.type === 'melodies') {
    const yearMatch = (row.selected_course || '').match(/שנה [א-ת]+['׳]?/);
    return yearMatch ? `מנגינות ${yearMatch[0]}` : 'מנגינות';
  }
  return TYPE_LABELS[row.type] || row.type || '';
}

// Individual lessons get an auto-created 1-student group for attendance sync;
// the day and the time can each independently live on that group's schedule
// instead of directly on the registration, so fall back to it field-by-field
// (a row can have its own day but still be missing its own time, or vice versa).
function resolveAssignment(r, groups) {
  const ownDay = r.assigned_day != null && r.assigned_day !== '' ? Number(r.assigned_day) : null;
  const linkedGroup = r.group_id ? groups.find(g => String(g.id) === String(r.group_id)) : null;
  const groupScheds = (linkedGroup?.group_schedules || [])
    .filter(s => s.start_time)
    .sort((a, b) => a.day_of_week - b.day_of_week);
  const matchingSched = groupScheds.find(s => s.day_of_week === ownDay) || groupScheds[0];
  return {
    day: ownDay != null ? ownDay : matchingSched?.day_of_week,
    time: r.assigned_time || matchingSched?.start_time,
  };
}

function buildExportRows(rows, groups) {
  const headers = ['תאריך', 'תלמיד/ה', 'הורה', 'טלפון', 'אימייל', 'סוג', 'כלים', 'סטטוס', 'תשלום', 'מורה', 'יום', 'שעה', 'הערות'];
  const dataRows = rows.map(r => {
    const { day, time } = resolveAssignment(r, groups);
    return [
      new Date(r.created_at).toLocaleDateString('he-IL'),
      r.student_name || '',
      r.parent_name || '',
      r.parent_phone || '',
      r.parent_email || '',
      getTypeLabel(r),
      Array.isArray(r.instruments)
        ? (r.instruments.length > 0 ? r.instruments.join('; ') : (r.selected_course || ''))
        : (r.instruments || r.selected_course || ''),
      r.status || '',
      paymentStatusLabel(r.registration_status),
      r.teacher || '',
      day != null ? (DAY_NAMES[day] ?? day) : '',
      time ? time.slice(0, 5) : '',
      r.admin_notes || '',
    ];
  });
  return { headers, dataRows };
}

async function exportToExcel(rows, groups) {
  const { headers, dataRows } = buildExportRows(rows, groups);
  const rowColors = assignRowColors(rows);
  const filename = `רישומים_${new Date().toLocaleDateString('he-IL').replace(/\//g, '-')}.xlsx`;
  await downloadExcelFile({ sheetName: 'רישומים', headers, rows: dataRows, rowColors, filename });
}

async function postRegistrationsToSheet(headers, rows) {
  const res = await fetch('/api/registrations/export-to-sheet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ headers, rows }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || 'שגיאה בייצוא לגיליון');
  }
}

function printTable(rows, groups) {
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
      <thead><tr><th>תאריך</th><th>תלמיד/ה</th><th>הורה</th><th>טלפון</th><th>סוג</th><th>כלים</th><th>סטטוס</th><th>מורה</th><th>יום</th><th>שעה</th></tr></thead>
      <tbody>
        ${rows.map(r => {
          const { day, time } = resolveAssignment(r, groups);
          return `<tr>
          <td>${escapeHtml(new Date(r.created_at).toLocaleDateString('he-IL'))}</td>
          <td>${escapeHtml(r.student_name)}</td>
          <td>${escapeHtml(r.parent_name)}</td>
          <td>${escapeHtml(r.parent_phone)}</td>
          <td>${escapeHtml(getTypeLabel(r))}</td>
          <td>${escapeHtml(Array.isArray(r.instruments)
            ? (r.instruments.length > 0 ? r.instruments.join(', ') : (r.selected_course || ''))
            : (r.instruments || r.selected_course || ''))}</td>
          <td>${escapeHtml(r.status)}</td>
          <td>${escapeHtml(r.teacher)}</td>
          <td>${escapeHtml(day != null ? (DAY_NAMES[day] ?? day) : '')}</td>
          <td>${escapeHtml(time ? time.slice(0, 5) : '')}</td>
        </tr>`;
        }).join('')}
      </tbody>
    </table>
    </body></html>`;
  const win = window.open('', '_blank');
  win.document.write(content);
  win.document.close();
  win.print();
}

const PAYMENT_STATUS_STYLES = {
  Confirmed: 'bg-green-100 text-green-800',
  Pending:   'bg-yellow-100 text-yellow-800',
  Cancelled: 'bg-gray-100 text-gray-500',
};

function RegistrationStatusBadge({ status }) {
  const cls = PAYMENT_STATUS_STYLES[status] || PAYMENT_STATUS_STYLES.Pending;
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{paymentStatusLabel(status)}</span>;
}

export default function AdminTable() {
  const [rows, setRows] = useState([]);
  const [groups, setGroups] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterInstrument, setFilterInstrument] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [updatingIds, setUpdatingIds] = useState([]);
  const [savedIds, setSavedIds] = useState([]);
  const [sheetExporting, setSheetExporting] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [selectedGroups, setSelectedGroups] = useState({});
  const [creatingGroupFor, setCreatingGroupFor] = useState(null);
  const [newGroupStudents, setNewGroupStudents] = useState([]); // [{ id, name }]
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [groupTypeFilter, setGroupTypeFilter] = useState({}); // { [rowId]: label }
  const [editingDetails, setEditingDetails] = useState({});
  const [addonPickerFor, setAddonPickerFor] = useState(null); // { rowId, kind: 'theory' | 'ensemble', label }
  const [addonSaving, setAddonSaving] = useState(false);
  const [fixedLessonTypes, setFixedLessonTypes] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [regRes, groupsRes, teachersRes, fixedTypesRes] = await Promise.all([
        fetch('/api/registrations'),
        fetch('/api/groups'),
        fetch('/api/teachers'),
        fetch('/api/fixed-lesson-types'),
      ]);
      const [regJson, groupsJson, teachersJson, fixedTypesJson] = await Promise.all([
        regRes.json(),
        groupsRes.json(),
        teachersRes.json(),
        fixedTypesRes.json(),
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
      setFixedLessonTypes(mergeFixedLessonTypes(fixedTypesJson.data || []));
      setSelectedGroups(prev => {
        const next = { ...prev };
        for (const r of regs) {
          if (r.group_id != null) next[r.id] = String(r.group_id);
        }
        return next;
      });
      setGroupTypeFilter(prev => {
        const next = { ...prev };
        const groupsList = groupsJson.data || [];
        for (const r of regs) {
          if (r.group_id != null) {
            const grp = groupsList.find(g => String(g.id) === String(r.group_id));
            if (grp?.name) next[r.id] = grp.name;
          }
        }
        return next;
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const teacherNames = useMemo(
    () => Array.from(new Set(teachers.map((t) => t.name).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'he')),
    [teachers]
  );

  async function refreshTeachers() {
    const res = await fetch('/api/teachers');
    const json = await res.json();
    setTeachers(json.data || []);
  }

  async function updateStatus(id, newStatus) {
    setUpdatingIds(prev => [...prev, id]);
    try {
      const res = await fetch('/api/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, newStatus }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error || 'שגיאה בעדכון הסטטוס — נסה שוב');
        return;
      }
      setRows((prev) =>
        prev.map((r) => r.id === id ? { ...r, status: newStatus } : r)
      );
    } catch {
      alert('שגיאת רשת — בדוק חיבור ונסה שוב');
    } finally {
      setUpdatingIds(prev => prev.filter(x => x !== id));
    }
  }

  async function updateAssignment(id, field, value) {
    setRows((prev) =>
      prev.map((r) => r.id === id ? { ...r, [field]: value } : r)
    );
  }

  async function saveAssignment(row) {
    const orchestraAuto = row.type === 'continue'
      ? (row.orchestra || getOrchestraForInstruments(row.instruments))
      : undefined;
    const newStatus = !LOCKED_ASSIGNMENT_STATUSES.includes(row.status) && (row.teacher || orchestraAuto)
      ? 'שובץ'
      : row.status;

    // Orchestra/choir and lessons tied to a real shared group get their time
    // from that group's fixed schedule. An individual lesson also gets a
    // group_id (auto-created 1-student "group" for attendance sync), but that
    // group has no independent schedule of its own — checking group_id alone
    // would let a stale link from a previous save skip the time requirement.
    const groupIdForCheck = selectedGroups[row.id] || row.group_id;
    const linkedGroup = groupIdForCheck ? groups.find(g => String(g.id) === String(groupIdForCheck)) : null;
    const isSharedGroupSchedule = !!linkedGroup &&
      !INDIVIDUAL_LESSON_TYPES.has(linkedGroup.lesson_type) &&
      (linkedGroup.group_schedules || []).some(sc => sc.start_time);
    const isGroupAssignment = !!orchestraAuto || isSharedGroupSchedule;
    // A private lesson's time may already live on its one-student attendance
    // group even when registrations.assigned_time is empty. Use the same
    // field-by-field fallback as the UI/export before reporting a missing time.
    const resolvedTime = resolveAssignment(
      groupIdForCheck ? { ...row, group_id: groupIdForCheck } : row,
      groups
    ).time;
    if (newStatus === 'שובץ' && !isGroupAssignment && !resolvedTime) {
      alert('יש לבחור שעה כדי לשבץ תלמיד/ה לשיעור פרטני');
      return;
    }

    setUpdatingIds(prev => [...prev, row.id]);
    try {
      const res = await fetch('/api/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: row.id,
          newStatus,
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
      setSavedIds(prev => [...prev, row.id]);
      setTimeout(() => setSavedIds(prev => prev.filter(x => x !== row.id)), 3000);
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: newStatus } : r));
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
      setUpdatingIds(prev => prev.filter(x => x !== row.id));
    }
  }

  async function saveAllInGroup(group) {
    const allLessons = [...group.categories.individual, ...group.categories.ensemble, ...group.categories.theory];
    for (const lesson of allLessons) {
      await saveAssignment(lesson);
    }
  }

  async function handleExportToSheet() {
    if (rows.length === 0 && !confirm('אין רישומים כרגע — הגיליון יימחק ויישאר ריק. להמשיך?')) return;
    setSheetExporting(true);
    try {
      const { headers, dataRows } = buildExportRows(rows, groups);
      await postRegistrationsToSheet(headers, dataRows);
      alert('הייצוא לגיליון הושלם בהצלחה');
    } catch (err) {
      alert(err.message || 'שגיאת רשת — נסה שוב');
    } finally {
      setSheetExporting(false);
    }
  }

  async function handleCreateGroup(rowId, teacherName, assignedDay, assignedTime, groupType) {
    if (!groupType || newGroupStudents.length === 0) return;
    if (!assignedTime) {
      alert('יש לבחור שעה כדי ליצור שיעור');
      return;
    }
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

  async function handleAddAddon(row, groupId) {
    setAddonSaving(true);
    try {
      const res = await fetch('/api/registrations/addon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: row.id, groupId }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || 'שגיאה בהוספת שיבוץ');
        return;
      }
      setAddonPickerFor(null);
      await fetchData();
      setExpandedRow(row.id);
    } finally {
      setAddonSaving(false);
    }
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
    setUpdatingIds(prev => [...prev, id]);
    try {
      const res = await fetch('/api/registrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...details, updated_at: new Date().toISOString() }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error || 'שגיאה בשמירת הפרטים — נסה שוב');
        return;
      }
      setRows(prev => prev.map(r => r.id === id ? { ...r, ...details } : r));
      setEditingDetails(prev => { const n = { ...prev }; delete n[id]; return n; });
    } catch {
      alert('שגיאת רשת — בדוק חיבור ונסה שוב');
    } finally {
      setUpdatingIds(prev => prev.filter(x => x !== id));
    }
  }

async function deleteRegistration(id, studentName) {
    if (!confirm(`למחוק לחלוטין את הרישום של ${studentName}?\nפעולה זו אינה הפיכה.`)) return;
    setUpdatingIds(prev => [...prev, id]);
    try {
      const res = await fetch('/api/registrations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error || 'שגיאה במחיקה — נסה שוב');
        return;
      }
      setRows(prev => prev.filter(r => r.id !== id));
      setExpandedRow(null);
    } catch {
      alert('שגיאת רשת — בדוק חיבור ונסה שוב');
    } finally {
      setUpdatingIds(prev => prev.filter(x => x !== id));
    }
  }

  async function updatePaymentStatus(id, newPaymentStatus) {
    setUpdatingIds(prev => [...prev, id]);
    try {
      const res = await fetch('/api/registrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, registration_status: newPaymentStatus }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error || 'שגיאה בעדכון סטטוס התשלום — נסה שוב');
        return;
      }
      setRows((prev) => prev.map((r) => r.id === id ? { ...r, registration_status: newPaymentStatus } : r));
    } catch {
      alert('שגיאת רשת — בדוק חיבור ונסה שוב');
    } finally {
      setUpdatingIds(prev => prev.filter(x => x !== id));
    }
  }

  async function markAttendedOpenDay(id) {
    setUpdatingIds(prev => [...prev, id]);
    try {
      const res = await fetch('/api/registrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, attended_open_day: true }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error || 'שגיאה בסימון הנוכחות — נסה שוב');
        return;
      }
      setRows(prev => prev.map(r => r.id === id ? { ...r, attended_open_day: true } : r));
    } catch {
      alert('שגיאת רשת — בדוק חיבור ונסה שוב');
    } finally {
      setUpdatingIds(prev => prev.filter(x => x !== id));
    }
  }

  const allGroups = useMemo(() => groupStudentRows(rows), [rows]);
  const activeFilters = { search, status: filterStatus, instrument: filterInstrument, teacher: filterTeacher, payment: filterPayment };
  const filteredGroups = allGroups.filter(g => filterRegistrations(g.members, activeFilters).length > 0);
  const filtered = filteredGroups.flatMap(g => filterRegistrations(g.members, activeFilters));

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
          className="admin-search-input flex-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="admin-input sm:w-40"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">כל הסטטוסים</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          className="admin-input sm:w-40"
          value={filterInstrument}
          onChange={(e) => setFilterInstrument(e.target.value)}
        >
          <option value="">כל הכלים</option>
          {INSTRUMENTS.map((inst) => (
            <option key={inst.value} value={inst.value}>{inst.label}</option>
          ))}
        </select>
        <select
          className="admin-input sm:w-40"
          value={filterTeacher}
          onChange={(e) => setFilterTeacher(e.target.value)}
        >
          <option value="">כל המורים</option>
          {teacherNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <select
          className="admin-input sm:w-40"
          value={filterPayment}
          onChange={(e) => setFilterPayment(e.target.value)}
        >
          <option value="">כל התשלומים</option>
          <option value="Confirmed">{paymentStatusLabel('Confirmed')}</option>
          <option value="Pending">{paymentStatusLabel('Pending')}</option>
          <option value="Cancelled">{paymentStatusLabel('Cancelled')}</option>
        </select>
        <button
          onClick={fetchData}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
        >
          🔄 רענן
        </button>
        <button
          onClick={() => exportToExcel(filtered, groups)}
          className="px-4 py-2 border border-green-300 text-green-700 rounded-lg hover:bg-green-50 text-sm"
        >
          📊 ייצוא Excel
        </button>
        <button
          onClick={handleExportToSheet}
          disabled={sheetExporting}
          className="px-4 py-2 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 text-sm disabled:opacity-50"
        >
          {sheetExporting ? '⏳ מייצא...' : '📤 ייצוא לגיליון גוגל'}
        </button>
        <button
          onClick={() => printTable(filtered, groups)}
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
                <th className="px-4 py-3 text-right font-semibold text-gray-600">🎻 פרטני</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">🎼 הרכב</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">📘 תיאוריה</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredGroups.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-400">
                    לא נמצאו רישומים
                  </td>
                </tr>
              )}
              {filteredGroups.map((group) => {
                const { contactRow } = group;
                const renderCategoryCell = (categoryRows, emptyLabel) => (
                  <td className="px-4 py-3">
                    {categoryRows.length === 0 ? (
                      <span className="text-gray-300">—</span>
                    ) : (
                      <div className="space-y-1.5">
                        {categoryRows.map(r => {
                          const { day: displayDay, time: displayTime } = resolveAssignment(r, groups);
                          return (
                          <div key={r.id} className="text-xs bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5">
                            <div className="font-medium text-gray-700">{r.selected_course || emptyLabel}</div>
                            {r.teacher && displayDay != null && (
                              <div className="text-green-700">
                                {r.teacher} · יום {DAY_NAMES[displayDay]}
                                {displayTime ? ` ${displayTime.slice(0, 5)}` : ''}
                              </div>
                            )}
                            <div className="flex gap-1 mt-1">
                              <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}`}>
                                {r.status}
                              </span>
                              <RegistrationStatusBadge status={r.registration_status} />
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </td>
                );
                return (
                  <React.Fragment key={group.key}>
                    <tr className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(contactRow.created_at).toLocaleDateString('he-IL')}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {contactRow.student_name}
                        {contactRow.attended_open_day === false && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('לסמן שהתקיימה שיחת היכרות?')) markAttendedOpenDay(contactRow.id);
                            }}
                            className="mr-1 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium hover:bg-purple-200"
                          >
                            טרם שיחת היכרות
                          </button>
                        )}
                        {contactRow.has_accommodations && (
                          <span className="mr-1 text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full font-medium">
                            התאמות
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        <div>{contactRow.parent_name}</div>
                        <div className="text-xs" dir="ltr">{contactRow.parent_phone}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{getTypeLabel(contactRow)}</td>
                      {renderCategoryCell(group.categories.individual, 'פרטני')}
                      {renderCategoryCell(group.categories.ensemble, 'הרכב')}
                      {renderCategoryCell(group.categories.theory, 'תיאוריה')}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpandedRow(expandedRow === group.key ? null : group.key)}
                          className="text-primary text-xs hover:underline"
                        >
                          {expandedRow === group.key ? '▲ סגור' : '▼ פרטים'}
                        </button>
                      </td>
                    </tr>
                    {expandedRow === group.key && (
                      <tr className="bg-primary-50">
                        <td colSpan={8} className="px-6 py-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            {/* Contact — shown once per group, from contactRow */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold text-gray-700">פרטי קשר</h4>
                                {!editingDetails[contactRow.id] && (
                                  <button
                                    type="button"
                                    onClick={() => setEditingDetails(prev => ({ ...prev, [contactRow.id]: {
                                      student_name: contactRow.student_name,
                                      parent_name: contactRow.parent_name,
                                      parent_phone: contactRow.parent_phone,
                                      parent_email: contactRow.parent_email,
                                    }}))}
                                    className="text-xs text-blue-600 hover:underline"
                                  >
                                    ✏️ ערוך
                                  </button>
                                )}
                              </div>
                              {editingDetails[contactRow.id] ? (
                                <div className="space-y-2">
                                  <div>
                                    <label className="text-xs text-gray-500">שם תלמיד/ה</label>
                                    <input
                                      className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm"
                                      value={editingDetails[contactRow.id].student_name || ''}
                                      onChange={e => setEditingDetails(prev => ({ ...prev, [contactRow.id]: { ...prev[contactRow.id], student_name: e.target.value }}))}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-500">שם הורה</label>
                                    <input
                                      className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm"
                                      value={editingDetails[contactRow.id].parent_name || ''}
                                      onChange={e => setEditingDetails(prev => ({ ...prev, [contactRow.id]: { ...prev[contactRow.id], parent_name: e.target.value }}))}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-500">טלפון</label>
                                    <input
                                      className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm"
                                      dir="ltr"
                                      value={editingDetails[contactRow.id].parent_phone || ''}
                                      onChange={e => setEditingDetails(prev => ({ ...prev, [contactRow.id]: { ...prev[contactRow.id], parent_phone: e.target.value }}))}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-500">אימייל</label>
                                    <input
                                      className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm"
                                      dir="ltr"
                                      value={editingDetails[contactRow.id].parent_email || ''}
                                      onChange={e => setEditingDetails(prev => ({ ...prev, [contactRow.id]: { ...prev[contactRow.id], parent_email: e.target.value }}))}
                                    />
                                  </div>
                                  <div className="flex gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => saveDetails(contactRow.id)}
                                      disabled={updatingIds.includes(contactRow.id)}
                                      className="text-xs px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                                    >
                                      שמור
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingDetails(prev => { const n = { ...prev }; delete n[contactRow.id]; return n; })}
                                      className="text-xs px-3 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    >
                                      ביטול
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p className="text-sm text-gray-600">👤 {contactRow.parent_name}</p>
                                  <p className="text-sm text-gray-600" dir="ltr">📞 {contactRow.parent_phone}</p>
                                  <p className="text-sm text-gray-600">📧 {contactRow.parent_email}</p>
                                  <p className="text-sm text-gray-600">
                                    📅 שיחה טלפונית בזמן רצוי: {contactRow.preferred_slot || '—'}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    🚫 ימים לא פנויים:{' '}
                                    {Array.isArray(contactRow.unavailable_days) && contactRow.unavailable_days.length > 0
                                      ? contactRow.unavailable_days.map(d => `יום ${d}`).join(', ')
                                      : 'ללא הגבלה'}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    🏫 בית ספר: {contactRow.school_name || '—'}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    🎓 כיתה: {contactRow.grade || '—'}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    🎂 תאריך לידה: {contactRow.birthdate ? new Date(contactRow.birthdate).toLocaleDateString('he-IL') : '—'}
                                  </p>
                                </>
                              )}
                            </div>

                            {/* Notes — shared once per group, stored on the contact row */}
                            <div>
                              <h4 className="font-semibold text-gray-700 mb-2">הערות מנהל</h4>
                              <textarea
                                className="admin-input h-20 resize-none"
                                value={contactRow.admin_notes || ''}
                                onChange={(e) => updateAssignment(contactRow.id, 'admin_notes', e.target.value)}
                                onBlur={(e) => saveNotes(contactRow.id, e.target.value)}
                                placeholder="הוסף הערות פנימיות..."
                              />
                              {contactRow.availability_notes && (
                                <>
                                  <h4 className="font-semibold text-gray-700 mb-2 mt-3">הערות זמינות</h4>
                                  <div className="admin-input h-20 overflow-y-auto text-sm text-gray-600 bg-amber-50 border-amber-200">
                                    {contactRow.availability_notes}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          {/* One AssignmentPanel per lesson, grouped by category */}
                          <div className="space-y-4">
                            {[
                              { label: '🎻 פרטני', kind: 'individual', lessons: group.categories.individual, addonKind: null },
                              { label: '🎼 הרכב', kind: 'ensemble', lessons: group.categories.ensemble, addonKind: 'ensemble' },
                              { label: '📘 תיאוריה', kind: 'theory', lessons: group.categories.theory, addonKind: 'theory' },
                            ].map(section => (
                              <div key={section.kind}>
                                <h4 className="font-semibold text-gray-700 mb-2">{section.label}</h4>
                                {section.lessons.length > 0 ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {section.lessons.map(lesson => (
                                      <AssignmentPanel
                                        key={lesson.id}
                                        row={lesson}
                                        rows={rows}
                                        teachers={teachers}
                                        groups={groups}
                                        setGroups={setGroups}
                                        selectedGroups={selectedGroups}
                                        setSelectedGroups={setSelectedGroups}
                                        groupTypeFilter={groupTypeFilter}
                                        setGroupTypeFilter={setGroupTypeFilter}
                                        creatingGroupFor={creatingGroupFor}
                                        setCreatingGroupFor={setCreatingGroupFor}
                                        newGroupStudents={newGroupStudents}
                                        setNewGroupStudents={setNewGroupStudents}
                                        studentSearchQuery={studentSearchQuery}
                                        setStudentSearchQuery={setStudentSearchQuery}
                                        updateAssignment={updateAssignment}
                                        handleCreateGroup={handleCreateGroup}
                                        updateStatus={updateStatus}
                                        updatePaymentStatus={updatePaymentStatus}
                                        deleteRegistration={deleteRegistration}
                                        updatingIds={updatingIds}
                                        savedIds={savedIds}
                                        onSave={() => saveAssignment(lesson)}
                                      />
                                    ))}
                                  </div>
                                ) : section.addonKind ? (
                                  <button
                                    type="button"
                                    onClick={() => setAddonPickerFor({ rowId: contactRow.id, kind: section.addonKind === 'ensemble' ? 'ensemble' : 'theory', label: '' })}
                                    className="text-xs px-3 py-1.5 rounded-lg border border-dashed border-indigo-300 text-indigo-700 hover:bg-indigo-50 w-full"
                                  >
                                    + הוסף {section.addonKind === 'ensemble' ? 'הרכב' : 'תיאוריה'}
                                  </button>
                                ) : (
                                  <p className="text-xs text-gray-400">אין שיעור פרטני</p>
                                )}

                                {addonPickerFor?.rowId === contactRow.id && addonPickerFor.kind === section.addonKind && (() => {
                                  const wantedTypes = addonPickerFor.kind === 'theory' ? ['theory'] : ['orchestra', 'choir'];
                                  const labelOptions = addonPickerFor.kind === 'theory'
                                    ? labelsForCategories(fixedLessonTypes, ['theory'])
                                    : labelsForCategories(fixedLessonTypes, ['orchestra', 'choir']);
                                  const label = addonPickerFor.label || '';
                                  const matching = label
                                    ? groups.filter(g => wantedTypes.includes(g.lesson_type) && matchesGroupLabel(g.name, label))
                                    : [];
                                  return (
                                    <div className="border border-gray-200 rounded-lg p-2 space-y-1 max-h-56 overflow-y-auto mt-2">
                                      <select
                                        className="admin-input w-full"
                                        value={label}
                                        onChange={e => setAddonPickerFor(prev => ({ ...prev, label: e.target.value }))}
                                      >
                                        <option value="">— בחר/י סוג —</option>
                                        {labelOptions.map(l => (
                                          <option key={l} value={l}>{l}</option>
                                        ))}
                                      </select>
                                      {label && matching.map(g => {
                                        const teacherName = teachers.find(t => t.id === g.teacher_id)?.name || '—';
                                        const sched = (g.group_schedules || [])
                                          .filter(s => s.start_time)
                                          .sort((a, b) => a.day_of_week - b.day_of_week)[0];
                                        return (
                                          <button
                                            key={g.id}
                                            type="button"
                                            disabled={addonSaving}
                                            onClick={() => handleAddAddon(contactRow, g.id)}
                                            className="block w-full text-right px-2 py-1.5 text-sm rounded-lg hover:bg-indigo-50 disabled:opacity-40"
                                          >
                                            {g.name} · {teacherName}
                                            {sched ? ` · יום ${DAY_NAMES[sched.day_of_week]} ${sched.start_time.slice(0, 5)}` : ' · ללא שעה קבועה'}
                                          </button>
                                        );
                                      })}
                                      {label && matching.length === 0 && (
                                        <p className="text-xs text-gray-400 px-2 py-1">אין שיעורים קבועים מסוג זה — יש להוסיף שיעור בכרטיס המורה</p>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => setAddonPickerFor(null)}
                                        className="block w-full text-right px-2 py-1 text-xs text-gray-400 hover:text-gray-600"
                                      >
                                        ביטול
                                      </button>
                                    </div>
                                  );
                                })()}
                              </div>
                            ))}
                          </div>

                          {contactRow.message_log && contactRow.message_log.length > 0 && (
                            <div className="mt-4">
                              <h4 className="font-semibold text-gray-700 mb-2">לוג הודעות</h4>
                              <div className="space-y-1">
                                {contactRow.message_log.map((log, i) => (
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

                          <div className="flex justify-end mt-4">
                            <button
                              onClick={() => saveAllInGroup(group)}
                              className="text-sm px-4 py-2 rounded-xl font-semibold btn-primary"
                            >
                              💾 שמור הכל
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
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
