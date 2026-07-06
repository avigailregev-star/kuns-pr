export const LESSON_TYPE_OPTIONS = [
  { label: 'פרטני 45 דקות', value: 'individual_45' },
  { label: 'פרטני 60 דקות', value: 'individual_60' },
  { label: 'שיעור זוגי אליטה', value: 'elite_duet' },
  { label: 'תזמורת', value: 'orchestra' },
  { label: 'מקהלה ב-ו', value: 'choir' },
  { label: 'מקהלה הזמיר', value: 'choir' },
  { label: 'מקהלה בוגרים', value: 'choir' },
  { label: 'תיאוריה', value: 'theory' },
  { label: 'מנגינות שנה ב', value: 'melodies_individual' },
  { label: 'מנגינות שנה ג', value: 'melodies_individual' },
  { label: 'מנגינות שנה ד', value: 'melodies_individual' },
];

export function getLessonTypeValue(label) {
  return LESSON_TYPE_OPTIONS.find(o => o.label === label)?.value ?? null;
}

export function computeGroupName(label, studentNames) {
  const names = (studentNames || []).filter(Boolean);
  if (names.length === 1) return `${label} - ${names[0]}`;
  return label;
}
