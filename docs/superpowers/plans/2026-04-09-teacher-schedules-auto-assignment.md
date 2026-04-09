# Teacher Schedules + Auto-Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ניהול לוח שעות מורים בממשק האדמין, ושיבוץ אוטומטי לתזמורת/מקהלה + הצעת שיבוץ לתיאוריה עבור תלמידים ממשיכים.

**Architecture:** טבלת `teachers` ב-Supabase עם זמינות קבועה. API routes לניהול CRUD. לשונית "מורים" בדף הניהול. לתלמידים ממשיכים — שדות `orchestra` ו-`theory_day` נוספים ל-`registrations`, מתמלאים אוטומטית (תזמורת) או כהצעה (תיאוריה) מתוך `AdminTable`.

**Tech Stack:** Next.js 14, Supabase, React

---

## File Map

| קובץ | שינוי |
|---|---|
| Supabase SQL | יצירת טבלת `teachers` + עמודות ב-`registrations` |
| `app/api/teachers/route.js` | GET רשימת מורים, POST מורה חדש |
| `app/api/teachers/[id]/route.js` | PUT עדכון, DELETE מחיקה |
| `lib/autoAssign.js` | לוגיקת מיפוי כלי → תזמורת/מקהלה |
| `components/TeacherForm.jsx` | טופס הוספה/עריכת מורה |
| `components/TeachersTab.jsx` | לשונית מורים מלאה |
| `app/admin/(protected)/page.js` | הוספת לשונית מורים |
| `components/AdminTable.jsx` | שיבוץ אוטומטי + הצעות לתלמידים ממשיכים |
| `app/api/update-status/route.js` | שמירת orchestra + theory_day |

---

### Task 1: יצירת טבלת `teachers` ב-Supabase + עמודות ב-`registrations`

**Files:**
- Supabase SQL Editor

- [ ] **Step 1: הרץ את ה-SQL הבא ב-Supabase Dashboard → SQL Editor**

```sql
-- טבלת מורים
create table if not exists teachers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  instrument_type text not null, -- 'קשת' | 'נשיפה' | 'פסנתר' | 'שירה' | 'אחר'
  available_days text[] not null default '{}',
  available_hours jsonb not null default '{}',
  created_at timestamptz default now()
);

-- הרשאות
alter table teachers enable row level security;
create policy "allow_all_authenticated" on teachers
  for all using (true) with check (true);

-- עמודות חדשות ב-registrations
alter table registrations
  add column if not exists orchestra text,
  add column if not exists theory_day text;
```

- [ ] **Step 2: ודא שהטבלה נוצרה**

ב-Supabase → Table Editor — ודא שהטבלה `teachers` מופיעה ושלטבלת `registrations` יש עמודות `orchestra` ו-`theory_day`.

- [ ] **Step 3: Commit הערה**

```bash
git commit --allow-empty -m "chore: add teachers table and orchestra/theory_day columns to registrations (Supabase migration)"
```

---

### Task 2: יצירת `lib/autoAssign.js`

**Files:**
- Create: `lib/autoAssign.js`

- [ ] **Step 1: צור את הקובץ**

```js
// מיפוי ערך כלי נגינה (מ-InstrumentPicker) → שם תזמורת/מקהלה
const INSTRUMENT_TO_ORCHESTRA = {
  violin: 'תזמורת כלי קשת',
  cello: 'תזמורת כלי קשת',
  flute: 'תזמורת כלי נשיפה',
  trumpet: 'תזמורת כלי נשיפה',
  saxophone: 'תזמורת כלי נשיפה',
  piano: 'מקהלה',
  voice: 'מקהלה',
};

/**
 * מחזיר שם תזמורת/מקהלה לפי רשימת כלים.
 * לוקח את הכלי הראשון ברשימה.
 * מחזיר null אם הכלי לא ממופה (גיטרה, תופים וכו').
 */
export function getOrchestraForInstruments(instruments) {
  if (!instruments || instruments.length === 0) return null;
  const first = Array.isArray(instruments) ? instruments[0] : instruments;
  return INSTRUMENT_TO_ORCHESTRA[first] || null;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/autoAssign.js
git commit -m "feat: add auto-assignment logic for orchestra/choir"
```

---

### Task 3: API Routes למורים

**Files:**
- Create: `app/api/teachers/route.js`
- Create: `app/api/teachers/[id]/route.js`

- [ ] **Step 1: צור `app/api/teachers/route.js`**

```js
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { getSupabaseClient } from '../../../lib/supabase';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('teachers')
    .select('*')
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });

  const body = await request.json();
  const { name, instrument_type, available_days, available_hours } = body;

  if (!name || !instrument_type) {
    return NextResponse.json({ error: 'שם וסוג כלי הם שדות חובה' }, { status: 400 });
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('teachers')
    .insert([{ name, instrument_type, available_days: available_days || [], available_hours: available_hours || {} }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
```

- [ ] **Step 2: צור תיקייה ואת `app/api/teachers/[id]/route.js`**

```js
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { getSupabaseClient } from '../../../../lib/supabase';

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });

  const body = await request.json();
  const { name, instrument_type, available_days, available_hours } = body;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('teachers')
    .update({ name, instrument_type, available_days, available_hours })
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'אינך מורשה' }, { status: 401 });

  const supabase = getSupabaseClient();
  const { error } = await supabase.from('teachers').delete().eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/teachers/
git commit -m "feat: add teachers API routes (CRUD)"
```

---

### Task 4: קומפוננטת `TeacherForm`

**Files:**
- Create: `components/TeacherForm.jsx`

- [ ] **Step 1: צור `components/TeacherForm.jsx`**

```jsx
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
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="שם פרטי ומשפחה"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">סוג כלי *</label>
          <select className="form-input" value={instrumentType} onChange={(e) => setInstrumentType(e.target.value)}>
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
                  className="form-input py-1 text-sm"
                  value={availableHours[day]?.from || ''}
                  onChange={(e) => setHours(day, 'from', e.target.value)}
                />
                <span className="text-gray-400">עד</span>
                <input
                  type="time"
                  className="form-input py-1 text-sm"
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
```

- [ ] **Step 2: Commit**

```bash
git add components/TeacherForm.jsx
git commit -m "feat: add TeacherForm component"
```

---

### Task 5: קומפוננטת `TeachersTab`

**Files:**
- Create: `components/TeachersTab.jsx`

- [ ] **Step 1: צור `components/TeachersTab.jsx`**

```jsx
'use client';

import { useState, useEffect } from 'react';
import TeacherForm from './TeacherForm';

export default function TeachersTab() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // teacher object or null

  useEffect(() => {
    fetchTeachers();
  }, []);

  async function fetchTeachers() {
    setLoading(true);
    const res = await fetch('/api/teachers');
    const json = await res.json();
    setTeachers(json.data || []);
    setLoading(false);
  }

  async function handleSave(data) {
    if (editing) {
      await fetch(`/api/teachers/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } else {
      await fetch('/api/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    }
    setShowForm(false);
    setEditing(null);
    fetchTeachers();
  }

  async function handleDelete(id) {
    if (!confirm('למחוק מורה זה?')) return;
    await fetch(`/api/teachers/${id}`, { method: 'DELETE' });
    fetchTeachers();
  }

  if (loading) return <p className="text-gray-500 text-sm">טוען מורים...</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">מורים</h2>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="btn-primary text-sm"
        >
          + הוסף מורה
        </button>
      </div>

      {(showForm && !editing) && (
        <TeacherForm
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
        />
      )}

      {teachers.length === 0 && !showForm && (
        <p className="text-gray-400 text-sm">אין מורים עדיין. לחץ "הוסף מורה" להתחלה.</p>
      )}

      <div className="space-y-3">
        {teachers.map((t) => (
          <div key={t.id}>
            {editing?.id === t.id ? (
              <TeacherForm
                initial={t}
                onSave={handleSave}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-white">
                <div>
                  <p className="font-semibold text-gray-800">{t.name}</p>
                  <p className="text-sm text-gray-500">
                    {t.instrument_type} ·{' '}
                    {t.available_days.length > 0
                      ? t.available_days.map((d) => `יום ${d}`).join(', ')
                      : 'אין ימים מוגדרים'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing(t)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    ערוך
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="text-sm text-red-500 hover:underline"
                  >
                    מחק
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/TeachersTab.jsx
git commit -m "feat: add TeachersTab component"
```

---

### Task 6: הוספת לשונית מורים לדף הניהול

**Files:**
- Modify: `app/admin/(protected)/page.js`

- [ ] **Step 1: עדכן את `app/admin/(protected)/page.js`**

החלף את תוכן הקובץ כולו:

```js
import AdminTable from '../../../components/AdminTable';
import TeachersTab from '../../../components/TeachersTab';

export const metadata = {
  title: 'לוח בקרה | ניהול קונסרבטוריון',
};

export default function AdminDashboard({ searchParams }) {
  const tab = searchParams?.tab || 'registrations';

  return (
    <div>
      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <a
          href="/admin"
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            tab === 'registrations'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          רישומים
        </a>
        <a
          href="/admin?tab=teachers"
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            tab === 'teachers'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          מורים
        </a>
      </div>

      {tab === 'registrations' && (
        <>
          <h1 className="text-2xl font-bold text-gray-800 mb-6">ניהול רישומים</h1>
          <AdminTable />
        </>
      )}

      {tab === 'teachers' && <TeachersTab />}
    </div>
  );
}
```

- [ ] **Step 2: בדוק ידנית**

הרץ `npm run dev`, עבור ל-`/admin` — ודא שמופיעות שתי לשוניות "רישומים" ו-"מורים". לחץ על "מורים" ובדוק שמופיע הממשק.

- [ ] **Step 3: Commit**

```bash
git add app/admin/\(protected\)/page.js
git commit -m "feat: add teachers tab to admin dashboard"
```

---

### Task 7: שיבוץ אוטומטי ב-AdminTable לתלמידים ממשיכים

**Files:**
- Modify: `components/AdminTable.jsx`
- Modify: `app/api/update-status/route.js`

- [ ] **Step 1: עדכן את `app/api/update-status/route.js` — הוסף שמירת `orchestra` ו-`theory_day`**

מצא:
```js
    if (teacher !== undefined) updateData.teacher = teacher;
    if (assignedDay !== undefined) updateData.assigned_day = assignedDay;
    if (assignedTime !== undefined) updateData.assigned_time = assignedTime;
    if (adminNotes !== undefined) updateData.admin_notes = adminNotes;
```

החלף ב:
```js
    if (teacher !== undefined) updateData.teacher = teacher;
    if (assignedDay !== undefined) updateData.assigned_day = assignedDay;
    if (assignedTime !== undefined) updateData.assigned_time = assignedTime;
    if (adminNotes !== undefined) updateData.admin_notes = adminNotes;
    if (body.orchestra !== undefined) updateData.orchestra = body.orchestra;
    if (body.theoryDay !== undefined) updateData.theory_day = body.theoryDay;
```

גם עדכן את ה-destructuring בראש הפונקציה:
```js
    const { id, newStatus, teacher, assignedDay, assignedTime, adminNotes, groupId } = body;
```
— ה-`orchestra` ו-`theoryDay` נקראים ישירות מ-`body` אז אין שינוי ב-destructuring.

- [ ] **Step 2: עדכן את `components/AdminTable.jsx` — הוסף import ולוגיקת שיבוץ אוטומטי**

בראש הקובץ, הוסף את ה-import:
```js
import { getOrchestraForInstruments } from '../lib/autoAssign';
```

- [ ] **Step 3: עדכן את `saveAssignment` ב-AdminTable להכיל orchestra ו-theoryDay**

מצא את הפונקציה `saveAssignment`:
```js
  async function saveAssignment(row) {
    setUpdating(row.id);
    try {
      await fetch('/api/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: row.id,
          newStatus: row.status,
          teacher: row.teacher,
          assignedDay: row.assigned_day,
          assignedTime: row.assigned_time,
          adminNotes: row.admin_notes,
          groupId: selectedGroups[row.id] || null,
        }),
      });
    } finally {
      setUpdating(null);
    }
  }
```

החלף ב:
```js
  async function saveAssignment(row) {
    setUpdating(row.id);
    // לתלמידים ממשיכים — חשב orchestra אוטומטית
    const orchestraAuto = row.type === 'continue'
      ? (row.orchestra || getOrchestraForInstruments(row.instruments))
      : undefined;
    try {
      await fetch('/api/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: row.id,
          newStatus: row.status,
          teacher: row.teacher,
          assignedDay: row.assigned_day,
          assignedTime: row.assigned_time,
          adminNotes: row.admin_notes,
          groupId: selectedGroups[row.id] || null,
          orchestra: orchestraAuto,
          theoryDay: row.theory_day,
        }),
      });
    } finally {
      setUpdating(null);
    }
  }
```

- [ ] **Step 4: הוסף הצגת badges שיבוץ אוטומטי ב-AdminTable עבור רשומות `continue`**

מצא את הבלוק שמסתיים ב:
```jsx
                          {/* Assignment */}
                          <div>
                            <h4 className="font-semibold text-gray-700 mb-2">שיבוץ</h4>
```

הוסף **לפני** הבלוק הזה:

```jsx
                          {/* Auto-assignment suggestions for continuing students */}
                          {row.type === 'continue' && (
                            <div className="space-y-2">
                              <h4 className="font-semibold text-gray-700 mb-1">שיבוץ אוטומטי</h4>
                              {getOrchestraForInstruments(row.instruments) && (
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 border border-green-200 text-sm">
                                  <span className="text-green-600">🎼</span>
                                  <span className="text-green-700">
                                    תזמורת/מקהלה: <strong>{row.orchestra || getOrchestraForInstruments(row.instruments)}</strong>
                                  </span>
                                  {!row.orchestra && (
                                    <button
                                      type="button"
                                      onClick={() => updateAssignment(row.id, 'orchestra', getOrchestraForInstruments(row.instruments))}
                                      className="mr-auto text-xs text-green-600 underline"
                                    >
                                      אשר
                                    </button>
                                  )}
                                </div>
                              )}
                              {row.assigned_day && (
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 border border-blue-200 text-sm">
                                  <span className="text-blue-600">📚</span>
                                  <span className="text-blue-700">
                                    תיאוריה מוצעת: <strong>יום {row.theory_day || row.assigned_day}</strong>
                                  </span>
                                  {!row.theory_day && (
                                    <button
                                      type="button"
                                      onClick={() => updateAssignment(row.id, 'theory_day', row.assigned_day)}
                                      className="mr-auto text-xs text-blue-600 underline"
                                    >
                                      אשר
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
```

- [ ] **Step 5: בדוק ידנית**

הרץ `npm run dev`, עבור ל-`/admin`, פתח רשומה מסוג "ממשיך" עם כינור — ודא שמופיע badge ירוק "תזמורת כלי קשת". לחץ "אשר" ובדוק שה-badge מתעדכן. לחץ "שמור שיבוץ" ובדוק שלא נזרקת שגיאה.

- [ ] **Step 6: Commit**

```bash
git add components/AdminTable.jsx app/api/update-status/route.js
git commit -m "feat: auto-assign orchestra/choir and suggest theory day for continuing students"
```

---

### Task 8: Deploy

- [ ] **Step 1: Push ו-deploy**

```bash
git push
```

Vercel יעשה deploy אוטומטי. המתן כדקה ובדוק ב-`kunspr.vercel.app/admin?tab=teachers`.
