export const LESSON_TYPE_OPTIONS = [
  { label: 'פרטני 45 דקות', value: 'individual_45' },
  { label: 'פרטני 60 דקות', value: 'individual_60' },
  { label: 'שיעור זוגי אליטה', value: 'elite_duet' },
  { label: 'מנגינות שנה ב', value: 'melodies_individual' },
  { label: 'מנגינות שנה ג', value: 'melodies_individual' },
  { label: 'מנגינות שנה ד', value: 'melodies_individual' },
  { label: 'תיאוריה', value: 'theory' },
  { label: 'פיתוח קשב', value: 'theory' },
  { label: 'קצב לכולם', value: 'theory' },
  { label: 'קומפוזיציה', value: 'theory' },
  { label: 'מקהלה צעירה', value: 'choir' },
  { label: 'הזמיר- מקהלה ייצוגית', value: 'choir' },
  { label: 'מקהלת קולות הנגב', value: 'choir' },
  { label: 'תזמורת נשיפה', value: 'orchestra' },
  { label: 'תזמורת כלי קשת', value: 'orchestra' },
  { label: 'אנסמבל מוזיקה מן המזרח א', value: 'orchestra' },
  { label: 'אנסמבל מוזיקה מן המזרח ב', value: 'orchestra' },
  { label: 'תזמורת מקאם דימונה', value: 'orchestra' },
];

export function getLessonTypeValue(label) {
  return LESSON_TYPE_OPTIONS.find(o => o.label === label)?.value ?? null;
}

export function computeGroupName(label, studentNames) {
  const names = (studentNames || []).filter(Boolean);
  if (names.length === 1) return `${label} - ${names[0]}`;
  return label;
}

export function matchesLessonType(groupName, selectedType) {
  if (!selectedType) return false;
  return groupName === selectedType || groupName.startsWith(`${selectedType} - `);
}

export const THEORY_LABEL = 'תיאוריה';

export const ENSEMBLE_LABELS = LESSON_TYPE_OPTIONS
  .filter(o => o.value === 'orchestra' || o.value === 'choir')
  .map(o => o.label);

export const THEORY_LABELS = LESSON_TYPE_OPTIONS
  .filter(o => o.value === 'theory')
  .map(o => o.label);

export function getAddonBadge(selectedCourse) {
  const value = getLessonTypeValue(selectedCourse);
  if (value === 'theory') return { emoji: '📘', label: 'תיאוריה' };
  if (value === 'orchestra' || value === 'choir') return { emoji: '🎻', label: 'הרכב' };
  return null;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Fixed-lesson groups (created in the Teachers tab) are named "<label> <n>"
// — e.g. "פיתוח קשב 1", "פיתוח קשב 2" — to tell apart several groups of the
// same type. These three helpers work with that convention; they are
// independent of computeGroupName/matchesLessonType above, which serve the
// older "<label> - <student name>" convention used by the individual-lesson
// group flow (AssignmentPanel's "צור שיעור חדש").
export function nextNumberedGroupName(label, existingGroupNames) {
  const re = new RegExp(`^${escapeRegExp(label)} (\\d+)$`);
  let max = 0;
  for (const name of existingGroupNames) {
    const m = re.exec(name);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${label} ${max + 1}`;
}

export function matchesGroupLabel(groupName, label) {
  return groupName === label || new RegExp(`^${escapeRegExp(label)} \\d+$`).test(groupName);
}

export function groupBaseLabel(groupName) {
  const m = /^(.*) \d+$/.exec(groupName);
  return m ? m[1] : groupName;
}
