'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { buildScheduleGrid, minsToTime, SLOT_MINUTES } from '../lib/scheduleGrid';

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
const BLOCKED_STATUSES = ['נדחה', 'בוטל', 'רשימת המתנה'];
const SLOT_HEIGHT = 28; // px

export default function ScheduleGrid() {
  const [teachers, setTeachers] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [teachersRes, registrationsRes] = await Promise.all([
          fetch('/api/teachers'),
          fetch('/api/registrations'),
        ]);
        const teachersJson = await teachersRes.json();
        const registrationsJson = await registrationsRes.json();
        if (teachersJson.error) throw new Error(teachersJson.error);
        if (registrationsJson.error) throw new Error(registrationsJson.error);
        setTeachers(teachersJson.data || []);
        setRegistrations(registrationsJson.data || []);
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
    return buildScheduleGrid(registrations, { teacherName: selectedTeacher, blockedStatuses: BLOCKED_STATUSES });
  }, [registrations, selectedTeacher]);

  if (loading) return <p className="text-gray-500">טוען...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">מערכת שעות</h1>

      <select
        value={selectedTeacher}
        onChange={(e) => setSelectedTeacher(e.target.value)}
        className="mb-4 border border-gray-300 rounded px-3 py-2 text-sm"
      >
        {teachers.map((t) => (
          <option key={t.id} value={t.name}>{t.name}</option>
        ))}
      </select>

      {teachers.length === 0 && <p className="text-gray-500">אין מורים במערכת.</p>}

      {grid && (
        <div className="flex border border-gray-200 text-xs w-fit">
          <div className="w-16 shrink-0">
            <div className="h-10 border-b border-gray-200 bg-gray-50" />
            {grid.slots.map((slotMins) => (
              <div
                key={slotMins}
                className="border-b border-gray-100 flex items-center justify-center text-gray-400"
                style={{ height: SLOT_HEIGHT }}
              >
                {minsToTime(slotMins)}
              </div>
            ))}
          </div>

          {DAY_NAMES.map((name, dayIdx) => (
            <div key={name} className="w-40 border-r border-gray-200 relative">
              <div className="h-10 border-b border-gray-200 bg-gray-50 flex items-center justify-center font-medium text-gray-700">
                {name}
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
                      className={`absolute rounded px-1 py-0.5 overflow-hidden text-[11px] ${
                        lesson.conflict
                          ? 'bg-red-50 border-2 border-red-400'
                          : 'bg-green-50 border border-green-300'
                      }`}
                      style={{
                        top: ((lesson.startMins - grid.rangeStart) / SLOT_MINUTES) * SLOT_HEIGHT,
                        height: Math.max(1, (lesson.endMins - lesson.startMins) / SLOT_MINUTES) * SLOT_HEIGHT,
                        left: `${(lesson.columnIndex / lesson.columnCount) * 100}%`,
                        width: `${100 / lesson.columnCount}%`,
                      }}
                    >
                      <div className="font-medium text-gray-800 truncate">{lesson.studentName}</div>
                      <div className="text-gray-500 truncate">
                        {minsToTime(lesson.startMins)}–{minsToTime(lesson.endMins)}
                      </div>
                      <div className="text-gray-500 truncate">{lesson.course}</div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
