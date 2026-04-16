'use client';

const STATUS_OPTIONS = ['חדש', 'בבדיקה', 'שובץ', 'נדחה', 'רשימת המתנה', 'ממתין לשיחת היכרות'];

const STATUS_COLORS = {
  'חדש':                    'bg-blue-100 text-blue-800',
  'בבדיקה':                 'bg-yellow-100 text-yellow-800',
  'שובץ':                   'bg-green-100 text-green-800',
  'נדחה':                   'bg-red-100 text-red-800',
  'רשימת המתנה':            'bg-orange-100 text-orange-800',
  'ממתין לשיחת היכרות':    'bg-purple-100 text-purple-800',
};

export default function StatusSelect({ value, onChange, disabled }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:ring-2 focus:ring-primary ${
        STATUS_COLORS[value] || 'bg-gray-100 text-gray-600'
      }`}
    >
      {STATUS_OPTIONS.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}
