'use client';

import { useState } from 'react';

const EXAMPLE = `שם תלמיד,מורה,יום,שעה
יוסי לוי,דנה כהן,ב,15:00
שרה ישראלי,דנה כהן,ד,16:00
מיכל אברהם,אבי לוי,ג,14:30`;

export default function ImportAssignments({ onDone }) {
  const [text, setText] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleImport() {
    const lines = text.trim().split('\n').filter(Boolean);
    // skip header line if it matches the example header
    const dataLines = lines[0]?.includes('שם תלמיד') ? lines.slice(1) : lines;

    if (dataLines.length === 0) return;

    setLoading(true);
    const success = [], failed = [];

    for (const line of dataLines) {
      const parts = line.split(',').map(s => s.trim());
      const [studentName, teacher, day, time] = parts;
      if (!studentName || !teacher) { failed.push(line); continue; }

      try {
        const res = await fetch('/api/registrations/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentName, teacher, assignedDay: day || '', assignedTime: time || '' }),
        });
        if (res.ok) success.push(studentName);
        else failed.push(studentName);
      } catch {
        failed.push(studentName);
      }
    }

    setResults({ success, failed });
    setLoading(false);
    if (success.length > 0) onDone?.();
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-gray-800 mb-1">ייבוא שיבוצים מהשנה הקודמת</h3>
        <p className="text-xs text-gray-500">הדבק/י שורות בפורמט: שם תלמיד, מורה, יום, שעה</p>
      </div>

      <textarea
        className="admin-input h-40 resize-none font-mono text-sm"
        placeholder={EXAMPLE}
        value={text}
        onChange={e => setText(e.target.value)}
        dir="rtl"
      />

      <div className="text-xs text-gray-400 bg-gray-50 p-2 rounded-lg" dir="rtl">
        <strong>דוגמה:</strong><br />
        יוסי לוי,דנה כהן,ב,15:00<br />
        שרה ישראלי,דנה כהן,ד,16:00
      </div>

      {results && (
        <div className="space-y-1 text-sm">
          {results.success.length > 0 && (
            <p className="text-green-700">✓ עודכנו: {results.success.join(', ')}</p>
          )}
          {results.failed.length > 0 && (
            <p className="text-red-600">✗ לא נמצאו: {results.failed.join(', ')}</p>
          )}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <button onClick={() => onDone?.()} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
          סגור
        </button>
        <button
          onClick={handleImport}
          disabled={!text.trim() || loading}
          className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50"
        >
          {loading ? '⏳ מעבד...' : '📥 ייבא שיבוצים'}
        </button>
      </div>
    </div>
  );
}
