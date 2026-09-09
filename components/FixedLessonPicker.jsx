'use client';

import { useEffect, useRef } from 'react';
import { categoryGroups, WEEK_DAYS } from '../lib/teacherSchedulePicker';
import { labelsForCategories } from '../lib/fixedLessonTypes';
import { matchesGroupLabel } from '../lib/groupNaming';

export default function FixedLessonPicker({ picker, row, groups, teachers, fixedLessonTypes, saving, notRequired, onChange, onChoose, onNotRequired, onClose }) {
  const dialog = useRef(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const isTheory = picker.kind === 'theory';
  const labelOptions = labelsForCategories(fixedLessonTypes, isTheory ? ['theory'] : ['orchestra', 'choir']);
  const matching = categoryGroups(groups, picker.kind).filter(group => !picker.label || matchesGroupLabel(group.name, picker.label));

  return (
    <dialog ref={dialog} onCancel={onClose} dir="rtl" className="w-[94vw] max-w-xl max-h-[88vh] rounded-2xl p-0 shadow-2xl backdrop:bg-black/40">
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">הוספת שיבוץ ל{isTheory ? 'תיאוריה' : 'הרכב'}</h2>
          <p className="text-sm text-gray-500">{row.student_name}</p>
        </div>
        <button type="button" onClick={onClose} disabled={saving} className="px-3 py-2 rounded-lg border">סגור ×</button>
      </div>
      <div className="p-4 space-y-3">
        <select className="admin-input w-full" value={picker.label || ''} onChange={event => onChange(event.target.value)}>
          <option value="">{isTheory ? 'כל אפשרויות התיאוריה' : 'כל אפשרויות ההרכב'}</option>
          {labelOptions.map(label => <option key={label} value={label}>{label}</option>)}
        </select>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {matching.map(group => {
            const teacherName = teachers.find(teacher => String(teacher.id) === String(group.teacher_id))?.name || 'ללא מורה';
            const schedules = (group.group_schedules || []).filter(schedule => schedule.start_time).sort((a, b) => a.day_of_week - b.day_of_week);
            return (
              <button key={group.id} type="button" disabled={saving} onClick={() => onChoose(group.id)} className="block w-full text-right rounded-xl border border-gray-200 p-3 hover:border-purple-400 hover:bg-purple-50 disabled:opacity-40">
                <span className="block font-semibold text-gray-800">{group.name}</span>
                <span className="block text-sm text-gray-600">{teacherName}</span>
                {schedules.map((schedule, index) => <span key={index} className="block text-sm text-gray-600">יום {WEEK_DAYS[schedule.day_of_week]} · {schedule.start_time.slice(0, 5)}{schedule.end_time ? `–${schedule.end_time.slice(0, 5)}` : ''}</span>)}
              </button>
            );
          })}
          {matching.length === 0 && <p className="text-sm text-gray-500 text-center py-6">אין אפשרויות שיבוץ זמינות.</p>}
        </div>
        <button type="button" disabled={saving} onClick={onNotRequired} className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-40">{notRequired ? 'בטל סימון „לא נדרש”' : 'לא נדרש'}</button>
      </div>
    </dialog>
  );
}
