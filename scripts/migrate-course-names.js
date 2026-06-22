// סקריפט חד-פעמי לעדכון שמות קורסים אצל כל המורים במסד הנתונים
// הרצה: node scripts/migrate-course-names.js

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// טעינת משתני סביבה מ-.env.local
const envFile = readFileSync('.env.local', 'utf8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(line => line.includes('=') && !line.startsWith('#'))
    .map(line => {
      const [key, ...rest] = line.split('=');
      return [key.trim(), rest.join('=').trim().replace(/^"|"$/g, '')];
    })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

// מיפוי שם ישן → שם חדש
const COURSE_NAME_MAP = {
  "פסנתר אינה 45 דק'":                          "פסנתר אינה מרמלד - 45 דק'",
  "פסנתר אינה 60 דק'":                          "פסנתר אינה מרמלד - 60 דק'",
  "פסנתר אלונה 60 דק'":                         "פסנתר אלונה פיינשטיין - 60 דק'",
  "פסנתר אלכסנדרה 45 דק":                       "פסנתר אלכסנדרה דובגן - 45 דק'",
  "פסנתר ילנה 45 דק'":                          "פסנתר ילנה סטוליאר - 45 דק'",
  "פסנתר ילנה 60 דק'":                          "פסנתר ילנה סטוליאר - 60 דק'",
  "פסנתר מרינה 45 דק'":                         "פסנתר מרינה גוטמן - 45 דק'",
  "פסנתר מרינה 60 דק'":                         "פסנתר מרינה גוטמן - 60 דק'",
  "כלי הקשה נתנאל 45 דק":                       "כלי הקשה נתנאל יחיא - 45 דק'",
  "פיתוח קול אליטה 45 ד":                       "פיתוח קול אליטה ציילטין - 45 דק'",
  "פיתוח קול נועם- 45 ד":                       "פיתוח קול נועם אוחיון - 45 דק'",
  "פיתוח קול קארין 45 ד":                       "פיתוח קול קארין כרמלי - 45 דק'",
  "קיובייס אופק 90 דק'":                        "CUBASE אופק אוזן",
  "Cubase אופק 90 דק'":                         "CUBASE אופק אוזן",
  "גיטרה כלי 45 דק'":                           "גיטרה כלי אוחיון - 45 דק'",
  "גיטרה נתנאל 45 דק'":                         "גיטרה נתנאל יחיא - 45 דק'",
  "כינור מנטו רחל 45 דק":                       "כינור רחל מנטו - 45 דק'",
  "כינור מנטו רחל 60 דק":                       "כינור רחל מנטו - 60 דק'",
  "סקסופון ארקדי 45 דק'":                       "סקסופון ארקדי גופמן - 45 דק'",
  "סקסופון ארקדי 60 דק'":                       "סקסופון ארקדי גופמן - 60 דק'",
  "חצוצרה שני 45 דק'":                          "חצוצרה שני ניסים - 45 דק'",
  "חצוצרה שרלה 45 דק'":                         "חצוצרה עמנואל שרלה - 45 דק'",
  "חליל צד שירי 45 דק'":                        null, // הוסר
  "עוד אור 45 דק'":                             "עוד אור מועלם - 45 דק'",
  "עוד אוריה הרוש 45 דק":                       "עוד אוריה הרוש - 45 דק'",
  "דרבוקה 45 דק'":                              null, // הוסר
  "כינור יואב 45 דק'":                          null, // הוסר
  "גיטרה/עוד רחל 45 דק'":                       null, // הוסר
  "פיתוח קול רועי 45 דק":                       null, // הוסר
  "סקסופון- ורד קריימן - סקסופון 45 דק'":       null, // הוסר
  "סקסופון- ורד קריימן - סקסופון 60 דק'":       null, // הוסר
  "אורגנית קבוצתי":                             null, // הוסר
  "חלילית קבוצתי 60 דק'":                       null, // הוסר
  "קורס DJ- מיטב איבגי":                        "קורס DJ מיטב איבגי",
};

function migrateCourses(oldCourses) {
  if (!Array.isArray(oldCourses)) return oldCourses;
  const updated = [];
  for (const course of oldCourses) {
    if (course in COURSE_NAME_MAP) {
      const newName = COURSE_NAME_MAP[course];
      if (newName) updated.push(newName);
      // אם null — הקורס הוסר, לא מוסיפים
    } else {
      updated.push(course); // שם שלא השתנה — נשאר כמו שהוא
    }
  }
  return updated;
}

async function run() {
  console.log('מושך רשימת מורים...');
  const { data: teachers, error } = await supabase.from('teachers').select('id, name, courses');
  if (error) { console.error('שגיאה:', error.message); process.exit(1); }

  console.log(`נמצאו ${teachers.length} מורים\n`);
  let updated = 0;

  for (const teacher of teachers) {
    const newCourses = migrateCourses(teacher.courses);
    const changed = JSON.stringify(newCourses) !== JSON.stringify(teacher.courses);

    if (!changed) {
      console.log(`⏭  ${teacher.name} — ללא שינוי`);
      continue;
    }

    console.log(`✏️  ${teacher.name}`);
    console.log(`   לפני: ${(teacher.courses || []).join(', ')}`);
    console.log(`   אחרי: ${newCourses.join(', ')}`);

    const { error: updateError } = await supabase
      .from('teachers')
      .update({ courses: newCourses })
      .eq('id', teacher.id);

    if (updateError) {
      console.error(`   ❌ שגיאה: ${updateError.message}`);
    } else {
      console.log(`   ✅ עודכן`);
      updated++;
    }
  }

  console.log(`\nסיום. עודכנו ${updated} מורים.`);
}

run();
