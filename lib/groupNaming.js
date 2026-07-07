export const LESSON_TYPE_OPTIONS = [
  { label: 'פרטני 45 דקות', value: 'individual_45' },
  { label: 'פרטני 60 דקות', value: 'individual_60' },
  { label: 'שיעור זוגי אליטה', value: 'elite_duet' },
  { label: 'מנגינות שנה ב', value: 'melodies_individual' },
  { label: 'מנגינות שנה ג', value: 'melodies_individual' },
  { label: 'מנגינות שנה ד', value: 'melodies_individual' },
  { label: 'תיאוריה', value: 'theory' },
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
