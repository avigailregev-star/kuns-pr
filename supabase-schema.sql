-- ============================================================
-- סכימת Supabase לפרויקט קונסרבטוריון
-- הרץ בעורך ה-SQL של Supabase Dashboard
-- ============================================================

-- טבלת רישומים ראשית
CREATE TABLE IF NOT EXISTS registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name text NOT NULL,
  parent_name text NOT NULL,
  parent_phone text NOT NULL,
  parent_email text NOT NULL,
  type text NOT NULL DEFAULT 'new',
  birthdate date,
  grade text,
  school_name text,
  has_accommodations boolean NOT NULL DEFAULT false,
  instruments text[] DEFAULT '{}',
  unavailable_days text[] DEFAULT '{}',
  preferred_slot text,
  status text NOT NULL DEFAULT 'חדש',
  teacher text,
  assigned_day text,
  assigned_time text,
  admin_notes text,
  registration_status text NOT NULL DEFAULT 'Pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

-- טבלת לוג הודעות
CREATE TABLE IF NOT EXISTS message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid REFERENCES registrations(id) ON DELETE CASCADE,
  action text NOT NULL,
  sent_at timestamptz,
  status text DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- אינדקסים
CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status);
CREATE INDEX IF NOT EXISTS idx_registrations_created_at ON registrations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_log_registration_id ON message_log(registration_id);

-- ביטול RLS (ניהול פנימי בלבד דרך service key)
ALTER TABLE registrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE message_log DISABLE ROW LEVEL SECURITY;

-- מיגרציה: הוספת שדות תלמיד (הרץ פעם אחת ב-Supabase SQL Editor)
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS birthdate date;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS grade text;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS school_name text;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS has_accommodations boolean NOT NULL DEFAULT false;
