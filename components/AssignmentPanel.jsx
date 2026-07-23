'use client';

import React from 'react';
import StatusSelect from './StatusSelect';
import { getLessonDuration } from '../lib/lessonDuration';
import { freeMinutesOnDay, getGroupLessonDuration } from '../lib/teacherCapacity';
import { LESSON_TYPE_OPTIONS, getLessonTypeValue, matchesLessonType, groupBaseLabel } from '../lib/groupNaming';
import { FIXED_COURSE_TIMES, filterRangesToFixedDay } from '../lib/fixedCourseDays';

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

export default function AssignmentPanel({
  row,
  rows,
  teachers,
  groups,
  setGroups,
  selectedGroups,
  setSelectedGroups,
  groupTypeFilter,
  setGroupTypeFilter,
  creatingGroupFor,
  setCreatingGroupFor,
  newGroupStudents,
  setNewGroupStudents,
  studentSearchQuery,
  setStudentSearchQuery,
  updateAssignment,
  handleCreateGroup,
  updateStatus,
  updatePaymentStatus,
  deleteRegistration,
  updatingIds,
  savedIds,
  onSave,
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold text-gray-700">שיבוץ</h4>
        <StatusSelect
          value={row.status}
          onChange={(val) => updateStatus(row.id, val)}
          disabled={updatingIds.includes(row.id)}
        />
      </div>
      {row.linked_registration_id && getLessonTypeValue(groupBaseLabel(row.selected_course)) === 'theory' && (() => {
        // Match either the source registration itself (r.id === row.linked_registration_id)
        // or a sibling add-on row that shares the same source (r.linked_registration_id === row.linked_registration_id).
        const family = rows.filter(r =>
          r.id !== row.id &&
          (r.id === row.linked_registration_id || r.linked_registration_id === row.linked_registration_id) &&
          r.teacher && r.assigned_day != null && r.assigned_day !== ''
        );
        if (family.length === 0) return null;
        return (
          <div className="mb-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
            שיעורים נוספים של {row.student_name}:{' '}
            {family.map(r =>
              `${r.selected_course || r.teacher} · יום ${DAY_NAMES[Number(r.assigned_day)]}${r.assigned_time ? ` ${r.assigned_time.slice(0, 5)}` : ''}`
            ).join(' · ')}
          </div>
        );
      })()}
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

          // Days from attendance app via teacher_availability_ranges.
          // When the admin is placing this student into a group (e.g. a
          // choir), the day being picked here is for that group, not for
          // the student's own registered course — prefer the group type.
          const fixedCourseKey = groupTypeFilter[row.id] || row.selected_course;
          const availRanges = filterRangesToFixedDay(
            (selectedTeacher?.teacher_availability_ranges || [])
              .slice()
              .sort((a, b) => a.day_of_week - b.day_of_week),
            fixedCourseKey
          );
          // The teacher's availability range for a fixed-day course covers
          // her whole working day (e.g. individual lessons around the group
          // lesson too), so it can't be used as the group's actual meeting
          // time — use the known fixed time instead when there is one.
          const fixedTime = FIXED_COURSE_TIMES[fixedCourseKey];

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
                      const gEnd = sched.end_time ? timeToMins(sched.end_time) : gStart + getGroupLessonDuration(g.lesson_type);
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
                          updateAssignment(row.id, 'assigned_time', fixedTime?.start_time || nextTime || s.start_time || '');
                          if (fixedTime?.end_time) updateAssignment(row.id, 'assigned_end_time', fixedTime.end_time);
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
                        ) : fixedTime?.start_time ? (
                          <span className="text-xs opacity-60 mr-1">
                            {fixedTime.start_time}{fixedTime.end_time ? `–${fixedTime.end_time}` : ''}
                          </span>
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
                  fixedTime?.start_time ? (
                    <div className="p-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-600 text-center">
                      שעה קבועה: {fixedTime.start_time}{fixedTime.end_time ? `–${fixedTime.end_time}` : ''}
                    </div>
                  ) : (
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
                  )
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
        {(() => {
          const selectedTeacherForGroups = teachers.find(t => t.name === row.teacher);
          const selectedType = groupTypeFilter[row.id] || '';
          const matchingGroups = selectedType
            ? groups.filter(g => g.teacher_id === selectedTeacherForGroups?.id && matchesLessonType(g.name, selectedType))
            : [];

          return (
            <div className="space-y-2">
              <select
                className="admin-input w-full"
                value={selectedType}
                onChange={(e) => {
                  const value = e.target.value;
                  setGroupTypeFilter(prev => ({ ...prev, [row.id]: value }));
                  setSelectedGroups(prev => {
                    const next = { ...prev };
                    delete next[row.id];
                    return next;
                  });
                  setCreatingGroupFor(null);
                  setNewGroupStudents([]);
                  setStudentSearchQuery('');
                }}
              >
                <option value="">— סוג שיעור —</option>
                {LESSON_TYPE_OPTIONS.map(o => (
                  <option key={o.label} value={o.label}>{o.label}</option>
                ))}
              </select>

              {selectedType && (
                creatingGroupFor === row.id ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {newGroupStudents.map(s => (
                        <span
                          key={s.id}
                          className="inline-flex items-center gap-1 text-xs bg-purple-50 border border-purple-200 text-purple-700 rounded-lg px-2 py-1"
                        >
                          {s.name}
                          <button
                            type="button"
                            onClick={() => setNewGroupStudents(prev => prev.filter(x => x.id !== s.id))}
                            className="text-purple-400 hover:text-purple-700"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>

                    <input
                      type="text"
                      list={`new-group-student-options-${row.id}`}
                      className="admin-input w-full"
                      placeholder="הקלד/י שם תלמיד/ה להוספה... (מיועד למקהלות, תזמורות והרכבים בלבד)"
                      value={studentSearchQuery}
                      onChange={(e) => {
                        const value = e.target.value;
                        const match = rows.find(r =>
                          r.student_name === value && !newGroupStudents.some(s => s.id === r.id)
                        );
                        if (match) {
                          setNewGroupStudents(prev => [...prev, { id: match.id, name: match.student_name }]);
                          setStudentSearchQuery('');
                        } else {
                          setStudentSearchQuery(value);
                        }
                      }}
                    />
                    <datalist id={`new-group-student-options-${row.id}`}>
                      {rows
                        .filter(r => r.student_name && !newGroupStudents.some(s => s.id === r.id))
                        .map(r => (
                          <option key={r.id} value={r.student_name} />
                        ))}
                    </datalist>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleCreateGroup(row.id, row.teacher, row.assigned_day, row.assigned_time, selectedType)}
                        disabled={newGroupStudents.length === 0}
                        className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        צור שיעור
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCreatingGroupFor(null);
                          setNewGroupStudents([]);
                          setStudentSearchQuery('');
                        }}
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
                          setNewGroupStudents([{ id: row.id, name: row.student_name }]);
                          setStudentSearchQuery('');
                        } else {
                          setSelectedGroups(prev => ({ ...prev, [row.id]: e.target.value }));
                        }
                      }}
                    >
                      <option value="">— הוסף שיעור בנוכחות —</option>
                      {matchingGroups.map(g => (
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
                ))}
            </div>
          );
        })()}
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
      <div className="flex flex-wrap items-center gap-2 justify-end mt-3">
        <button
          onClick={() => deleteRegistration(row.id, row.student_name)}
          disabled={updatingIds.includes(row.id)}
          className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-40 disabled:cursor-not-allowed ml-auto"
        >
          🗑 מחק שיעור זה
        </button>
        <button
          onClick={() => updatePaymentStatus(row.id, 'Confirmed')}
          disabled={updatingIds.includes(row.id) || row.registration_status === 'Confirmed'}
          className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ✓ סמן כשולם
        </button>
        <button
          onClick={() => updatePaymentStatus(row.id, 'Cancelled')}
          disabled={updatingIds.includes(row.id) || row.registration_status === 'Cancelled'}
          className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ✗ בטל
        </button>
        <button
          onClick={() => updatePaymentStatus(row.id, 'Pending')}
          disabled={updatingIds.includes(row.id) || row.registration_status === 'Pending'}
          className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ↺ ממתין
        </button>
        <button
          onClick={onSave}
          disabled={updatingIds.includes(row.id)}
          className={`text-sm px-4 py-2 rounded-xl font-semibold transition-colors ${savedIds.includes(row.id) ? 'bg-green-500 text-white' : 'btn-primary'}`}
        >
          {updatingIds.includes(row.id) ? '⏳ שומר...' : savedIds.includes(row.id) ? '✓ נשמר!' : '💾 שמור'}
        </button>
      </div>
    </div>
  );
}
