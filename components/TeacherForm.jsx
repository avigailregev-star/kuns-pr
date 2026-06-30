'use client';

import { useState } from 'react';
import { COURSE_GROUPS } from '../lib/paymentLinks';

const DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];
const RANGE_DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const INSTRUMENT_TYPES = [
  'כינור',
  'חליל צד',
  'חצוצרה',
  'סקסופון',
  'קלרינט',
  'פסנתר',
  'תופים',
  'פיתוח קול',
  'גיטרה',
  'בגלמה',
  'עוד',
  "קמנצ'ה",
  'אחר',
];

export default function TeacherForm({ initial = {}, onSave, onCancel }) {
  const [name, setName] = useState(initial.name || '');
  const [instrumentTypes, setInstrumentTypes] = useState(() => {
    const v = initial.instrument_type || '';
    return v ? v.split(',').map(s => s.trim()).filter(Boolean) : [];
  });
  const [availableDays, setAvailableDays] = useState(initial.available_days || []);
  const [availableHours, setAvailableHours] = useState(initial.available_hours || {});
  const [maxStudents, setMaxStudents] = useState(
    initial.max_students != null ? String(initial.max_students) : ''
  );
  const [courses, setCourses] = useState(initial.courses || []);
  const [availabilityRanges, setAvailabilityRanges] = useState(() => {
    const map = {};
    for (const r of (initial.teacher_availability_ranges || [])) {
      map[r.day_of_week] = {
        start_time: (r.start_time || '').slice(0, 5),
        end_time: (r.end_time || '').slice(0, 5),
      };
    }
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Courses that don't auto-match by first name — these need explicit assignment
  const nameParts = name.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const assignableCourses = COURSE_GROUPS.flatMap((g) => g.courses).filter(
    (course) => {
      if (nameParts.length === 0) return true;
      const cl = course.toLowerCase();
      return !nameParts.every(part => cl.includes(part));
    }
  );

  function toggleDay(day) {
    setAvailableDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  function setHours(day, field, value) {
    setAvailableHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  }

  function toggleCourse(course) {
    setCourses((prev) =>
      prev.includes(course) ? prev.filter((c) => c !== course) : [...prev, course]
    );
  }

  function toggleDayRange(day) {
    setAvailabilityRanges((prev) => {
      const next = { ...prev };
      if (next[day]) { delete next[day]; } else { next[day] = { start_time: '', end_time: '' }; }
      return next;
    });
  }

  function setRangeTime(day, field, value) {
    setAvailabilityRanges((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || instrumentTypes.length === 0) {
      setError('שם וסוג כלי הם שדות חובה');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        name,
        instrument_type: instrumentTypes.join(', '),
        available_days: availableDays,
        available_hours: availableHours,
        max_students: maxStudents !== '' ? parseInt(maxStudents, 10) : null,
        courses,
        availability_ranges: Object.entries(availabilityRanges)
          .filter(([, t]) => t.start_time && t.end_time)
          .map(([day, t]) => ({ day_of_week: Number(day), start_time: t.start_time, end_time: t.end_time })),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border border-gray-200 rounded-lg bg-white">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">שם המורה *</label>
        <input
          type="text"
          className="admin-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="שם פרטי ומשפחה"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">כלים שהמורה מלמד *</label>
        <div className="max-h-44 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1 bg-gray-50">
          {INSTRUMENT_TYPES.map((inst) => {
            const id = `inst-${inst}`;
            return (
              <div key={inst} className="flex items-center gap-2 hover:bg-white px-2 py-1 rounded">
                <input
                  type="checkbox"
                  id={id}
                  checked={instrumentTypes.includes(inst)}
                  onChange={() => setInstrumentTypes((prev) =>
                    prev.includes(inst) ? prev.filter((i) => i !== inst) : [...prev, inst]
                  )}
                  className="accent-purple-500 cursor-pointer"
                />
                <label htmlFor={id} className="text-sm text-gray-700 cursor-pointer select-none">{inst}</label>
              </div>
            );
          })}
        </div>
        {instrumentTypes.length > 0 && (
          <p className="text-xs text-purple-600 mt-1">נבחרו: {instrumentTypes.join(', ')}</p>
        )}
      </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          מכסת תלמידים מקסימאלית
        </label>
        <input
          type="number"
          min="0"
          className="admin-input"
          value={maxStudents}
          onChange={(e) => setMaxStudents(e.target.value)}
          placeholder="ריק = ללא מכסה"
        />
      </div>


      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          זמינות מדויקת
          <span className="text-xs text-gray-400 font-normal mr-1">(גוברת על "ימים זמינים" בטופס הרשמה)</span>
        </label>
        <div className="space-y-2">
          {[0,1,2,3,4,5,6].map((day) => {
            const isOn = !!availabilityRanges[day];
            return (
              <div key={day} className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleDayRange(day)}
                  className={`text-xs px-3 py-1 rounded-full border transition-all w-20 text-center ${
                    isOn ? 'bg-purple-100 border-purple-400 text-purple-700' : 'bg-gray-50 border-gray-300 text-gray-500'
                  }`}
                >
                  יום {RANGE_DAY_NAMES[day]}
                </button>
                {isOn && (
                  <>
                    <input type="time" dir="ltr" className="admin-input py-1 text-sm"
                      value={availabilityRanges[day].start_time}
                      onChange={(e) => setRangeTime(day, 'start_time', e.target.value)} />
                    <span className="text-gray-400 text-sm">עד</span>
                    <input type="time" dir="ltr" className="admin-input py-1 text-sm"
                      value={availabilityRanges[day].end_time}
                      onChange={(e) => setRangeTime(day, 'end_time', e.target.value)} />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {assignableCourses.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            קורסים משויכים
            <span className="text-xs text-gray-400 font-normal mr-1">(קורסים שהשם אינו מופיע בשמם)</span>
          </label>
          <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1 bg-gray-50">
            {assignableCourses.map((course) => {
              const id = `course-${course.replace(/\s+/g, '-')}`;
              return (
                <div key={course} className="flex items-center gap-2 hover:bg-white px-2 py-1 rounded">
                  <input
                    type="checkbox"
                    id={id}
                    checked={courses.includes(course)}
                    onChange={() => toggleCourse(course)}
                    className="accent-purple-500 cursor-pointer"
                  />
                  <label htmlFor={id} className="text-sm text-gray-700 cursor-pointer select-none">
                    {course}
                  </label>
                </div>
              );
            })}
          </div>
          {courses.length > 0 && (
            <p className="text-xs text-purple-600 mt-1">נבחרו: {courses.join(', ')}</p>
          )}
        </div>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
          ביטול
        </button>
        <button type="submit" disabled={saving} className="btn-primary text-sm px-4 py-2">
          {saving ? 'שומר...' : 'שמור מורה'}
        </button>
      </div>
    </form>
  );
}
