'use client';
import { useState } from 'react';
import StatusSelect from './StatusSelect';
import { needsAttention } from '../lib/registrationWorkflow';
import { categoryGroups, WEEK_DAYS } from '../lib/teacherSchedulePicker';

export default function AssignmentPanel({ row, kind = 'individual', teachers, groups, updateStatus, updatePaymentStatus, clearAssignment, updatingIds, savedIds, onSave, onShowSchedule }) {
  const [showOptions, setShowOptions] = useState(false);
  const [groupId, setGroupId] = useState(row.group_id || '');
  const fixed = kind === 'theory' || kind === 'ensemble';
  const saving = updatingIds.includes(row.id);
  const options = categoryGroups(groups, kind);
  async function saveGroup() {
    const group = options.find(g => String(g.id) === String(groupId));
    const schedule = group?.group_schedules?.find(s => s.start_time);
    const teacher = teachers.find(t => String(t.id) === String(group?.teacher_id));
    if (!group || !schedule || !teacher) return;
    await onSave({ ...row, teacher: teacher.name, selected_course: group.name, assigned_day: schedule.day_of_week, assigned_time: schedule.start_time, assigned_end_time: schedule.end_time || null }, { groupId: group.id });
  }
  return (
    <div className={`border rounded-xl p-3 ${needsAttention(row) ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="font-semibold text-gray-800">{row.teacher || 'לא נבחר מורה'}</div><div className="text-sm text-gray-600">{row.selected_course || 'שיעור פרטני'}</div></div>
        <button type="button" onClick={() => fixed ? setShowOptions(v => !v) : onShowSchedule(row)} className="border border-purple-300 text-purple-700 bg-white rounded-lg px-4 py-2 text-sm font-semibold">{fixed ? 'הוסף שיבוץ' : 'הצג'}</button>
      </div>
      {fixed && showOptions && <div className="mt-3 space-y-2">
        <select aria-label={kind === 'theory' ? 'אפשרויות תיאוריה' : 'אפשרויות אנסמבל'} value={groupId} onChange={e => setGroupId(e.target.value)} className="admin-input">
          <option value="">בחרי {kind === 'theory' ? 'תיאוריה' : 'הרכב'}</option>
          {options.map(g => <option key={g.id} value={g.id}>{g.name} · {teachers.find(t => String(t.id) === String(g.teacher_id))?.name || 'ללא מורה'}</option>)}
        </select>
        {options.find(g => String(g.id) === String(groupId))?.group_schedules?.map((s,i) => <p className="text-sm text-gray-600" key={i}>יום {WEEK_DAYS[s.day_of_week]} · {s.start_time?.slice(0,5)}–{s.end_time?.slice(0,5)}</p>)}
        <button type="button" onClick={saveGroup} disabled={saving || !options.some(g => String(g.id) === String(groupId) && g.teacher_id && g.group_schedules?.some(s => s.start_time))} className="btn-primary text-sm disabled:opacity-40">{saving ? 'שומר…' : 'שמור שיבוץ'}</button>
        {options.length === 0 && <p className="text-sm text-gray-500">אין אפשרויות שיבוץ בתחום זה.</p>}
      </div>}
      <details className="mt-3 border-t pt-2">
        <summary className="cursor-pointer text-xs text-gray-600">תשלום ופעולות נוספות</summary>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <StatusSelect value={row.status} onChange={value => updateStatus(row.id, value)} disabled={saving} />
          {kind === 'individual' && <>
            <button type="button" onClick={() => updatePaymentStatus(row.id, 'Confirmed')} disabled={saving || row.registration_status === 'Confirmed'} className="text-xs px-3 py-2 rounded-lg bg-green-100 text-green-800 disabled:opacity-40">סמן כשולם</button>
            <button type="button" onClick={() => updatePaymentStatus(row.id, 'Pending')} disabled={saving || row.registration_status === 'Pending'} className="text-xs px-3 py-2 rounded-lg bg-amber-100 text-amber-800 disabled:opacity-40">לא שולם</button>
            <button type="button" onClick={() => updatePaymentStatus(row.id, 'Cancelled')} disabled={saving || row.registration_status === 'Cancelled'} className="text-xs px-3 py-2 rounded-lg bg-gray-100 disabled:opacity-40">בטל</button>
          </>}
          <button type="button" onClick={() => clearAssignment(row.id, row.student_name)} disabled={saving || row.status !== 'שובץ'} className="text-xs px-3 py-2 rounded-lg text-red-700 disabled:opacity-40">בטל שיבוץ</button>
        </div>
      </details>
      {savedIds.includes(row.id) && <p className="text-sm text-green-700 mt-2">נשמר בהצלחה</p>}
    </div>
  );
}
