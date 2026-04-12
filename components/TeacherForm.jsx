'use client';

import { useState } from 'react';

const DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו'];
const INSTRUMENT_TYPES = ['קשת', 'נשיפה', 'פסנתר', 'שירה', 'אחר'];

export default function TeacherForm({ initial = {}, onSave, onCancel }) {
  const [name, setName] = useState(initial.name || '');
  const [instrumentType, setInstrumentType] = useState(initial.instrument_type || '');
  const [availableDays, setAvailableDays] = useState(initial.available_days || []);
  const [availableHours, setAvailableHours] = useState(initial.available_hours || {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !instrumentType) {
      setError('שם וסוג כלי הם שדות חובה');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({ name, instrument_type: instrumentType, available_days: availableDays, available_hours: availableHours });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border border-gray-200 rounded-lg bg-white">
      <div className="grid grid-cols-2 gap-4">
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
          <label className="block text-sm font-medium text-gray-700 mb-1">סוג כלי *</label>
          <select className="admin-input" value={instrumentType} onChange={(e) => setInstrumentType(e.target.value)}>
            <option value="">— בחר —</option>
            {INSTRUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">ימים זמינים</label>
        <div className="flex gap-2 flex-wrap">
          {DAYS.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={`px-3 py-1 rounded-full text-sm border transition-all ${
                availableDays.includes(day)
                  ? 'bg-purple-100 border-purple-400 text-purple-700'
                  : 'bg-gray-50 border-gray-300 text-gray-600'
              }`}
            >
              יום {day}
            </button>
          ))}
        </div>
      </div>

      {availableDays.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">שעות לכל יום</label>
          <div className="space-y-2">
            {availableDays.map((day) => (
              <div key={day} className="flex items-center gap-3">
                <span className="text-sm w-10 text-gray-600">יום {day}:</span>
                <input
                  type="time"
                  className="admin-input py-1 text-sm"
                  value={availableHours[day]?.from || ''}
                  onChange={(e) => setHours(day, 'from', e.target.value)}
                />
                <span className="text-gray-400">עד</span>
                <input
                  type="time"
                  className="admin-input py-1 text-sm"
                  value={availableHours[day]?.to || ''}
                  onChange={(e) => setHours(day, 'to', e.target.value)}
                />
              </div>
            ))}
          </div>
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
