'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { buildScheduleGrid, minsToTime, SLOT_MINUTES } from '../lib/scheduleGrid';

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
const BLOCKED_STATUSES = ['נדחה', 'בוטל', 'רשימת המתנה'];
const SLOT_HEIGHT = 44; // px — gives a 45-minute lesson enough room for all of its details
const BASE_DAY_WIDTH = 240;
const CONFLICT_COLUMN_WIDTH = 116;

export default function ScheduleGrid() {
  const [teachers, setTeachers] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [groupsById, setGroupsById] = useState({});
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [teachersRes, registrationsRes, groupsRes] = await Promise.all([
          fetch('/api/teachers'),
          fetch('/api/registrations'),
          fetch('/api/groups'),
        ]);
        const teachersJson = await teachersRes.json();
        const registrationsJson = await registrationsRes.json();
        const groupsJson = await groupsRes.json();
        if (teachersJson.error) throw new Error(teachersJson.error);
        if (registrationsJson.error) throw new Error(registrationsJson.error);
        if (groupsJson.error) throw new Error(groupsJson.error);
        setTeachers(teachersJson.data || []);
        setRegistrations(registrationsJson.data || []);
        setGroupsById(Object.fromEntries((groupsJson.data || []).map((g) => [g.id, g])));
        if (teachersJson.data?.length > 0) setSelectedTeacher(teachersJson.data[0].name);
      } catch (err) {
        setError(err.message || 'שגיאה בטעינת הנתונים');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const grid = useMemo(() => {
    if (!selectedTeacher) return null;
    return buildScheduleGrid(registrations, { teacherName: selectedTeacher, blockedStatuses: BLOCKED_STATUSES, groupsById });
  }, [registrations, groupsById, selectedTeacher]);

  const dayWidths = useMemo(() => {
    if (!grid) return [];
    return DAY_NAMES.map((_, dayIdx) => {
      const largestOverlap = Math.max(
        1,
        ...grid.lessons
          .filter((lesson) => lesson.day === dayIdx)
          .map((lesson) => lesson.columnCount)
      );
      return Math.max(BASE_DAY_WIDTH, largestOverlap * CONFLICT_COLUMN_WIDTH);
    });
  }, [grid]);

  if (loading) return <p className="text-gray-500">טוען...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">מערכת שעות</h1>
          <p className="mt-1 text-sm text-gray-500">תצוגה שבועית של השיעורים והשיבוצים</p>
        </div>

        <label className="block min-w-60 text-sm font-medium text-gray-700">
          <span className="mb-1.5 block">בחירת מורה</span>
          <select
            value={selectedTeacher}
            onChange={(e) => setSelectedTeacher(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            {teachers.map((t) => (
              <option key={t.id} value={t.name}>{t.name}</option>
            ))}
          </select>
        </label>
      </div>

      {teachers.length === 0 && <p className="text-gray-500">אין מורים במערכת.</p>}

      {grid && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex w-max min-w-full text-sm">
            <div className="sticky right-0 z-20 w-20 shrink-0 border-l border-gray-200 bg-white shadow-[-4px_0_8px_-6px_rgba(0,0,0,0.35)]">
              <div className="sticky top-0 z-10 flex h-12 items-center justify-center border-b border-gray-200 bg-gray-50 font-semibold text-gray-500">
                שעה
              </div>
              {grid.slots.map((slotMins) => (
                <div
                  key={slotMins}
                  className="flex items-start justify-center border-b border-gray-100 pt-2 text-xs font-medium text-gray-500"
                  style={{ height: SLOT_HEIGHT }}
                >
                  {minsToTime(slotMins)}
                </div>
              ))}
            </div>

            {DAY_NAMES.map((name, dayIdx) => (
              <div
                key={name}
                className="relative shrink-0 border-l border-gray-200"
                style={{ width: dayWidths[dayIdx] }}
              >
                <div className="sticky top-0 z-10 flex h-12 items-center justify-center border-b border-gray-200 bg-gray-50 font-semibold text-gray-700">
                  יום {name}
                </div>
                <div className="relative" style={{ height: grid.slots.length * SLOT_HEIGHT }}>
                  {grid.slots.map((slotMins) => (
                    <div key={slotMins} className="border-b border-gray-100" style={{ height: SLOT_HEIGHT }} />
                  ))}
                  {grid.lessons
                    .filter((l) => l.day === dayIdx)
                    .map((lesson) => (
                      <div
                        key={lesson.id}
                        title={`${lesson.studentName} | ${minsToTime(lesson.startMins)}–${minsToTime(lesson.endMins)} | ${lesson.course}`}
                        className={`absolute overflow-hidden rounded-lg px-2.5 py-1.5 shadow-sm ${
                          lesson.conflict
                            ? 'border-2 border-red-400 bg-red-50'
                            : 'border border-emerald-300 bg-emerald-50'
                        }`}
                        style={{
                          top: ((lesson.startMins - grid.rangeStart) / SLOT_MINUTES) * SLOT_HEIGHT + 2,
                          height: ((lesson.endMins - lesson.startMins) / SLOT_MINUTES) * SLOT_HEIGHT - 4,
                          left: `calc(${(lesson.columnIndex / lesson.columnCount) * 100}% + 2px)`,
                          width: `calc(${100 / lesson.columnCount}% - 4px)`,
                        }}
                      >
                        <div className="truncate text-sm font-semibold leading-5 text-gray-900">{lesson.studentName}</div>
                        <div className="truncate text-xs leading-4 text-gray-600" dir="ltr">
                          {minsToTime(lesson.startMins)}–{minsToTime(lesson.endMins)}
                        </div>
                        <div className="truncate text-xs leading-4 text-gray-500">{lesson.course}</div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
