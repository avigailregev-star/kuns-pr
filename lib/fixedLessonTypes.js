export const FIXED_LESSON_CATEGORIES = [
  { value: 'theory', label: 'תיאוריה / קבוצתי' },
  { value: 'choir', label: 'מקהלה' },
  { value: 'orchestra', label: 'תזמורת / הרכב' },
];

export const BUILTIN_FIXED_LESSON_TYPES = [
  { label: 'תיאוריה', category: 'theory' },
  { label: 'פיתוח קשב', category: 'theory' },
  { label: 'קצב לכולם', category: 'theory' },
  { label: 'קומפוזיציה', category: 'theory' },
  { label: 'פיתוח שמיעה', category: 'theory' },
  { label: 'מקהלה צעירה', category: 'choir' },
  { label: 'הזמיר- מקהלה ייצוגית', category: 'choir' },
  { label: 'מקהלת קולות הנגב', category: 'choir' },
  { label: 'תזמורת נשיפה', category: 'orchestra' },
  { label: 'תזמורת כלי קשת', category: 'orchestra' },
  { label: 'אנסמבל מוזיקה מן המזרח א', category: 'orchestra' },
  { label: 'אנסמבל מוזיקה מן המזרח ב', category: 'orchestra' },
  { label: 'תזמורת מקאם דימונה', category: 'orchestra' },
  { label: 'מעבדת פופ רוק ייצוגי', category: 'orchestra' },
];

const CATEGORY_LABELS = Object.fromEntries(
  FIXED_LESSON_CATEGORIES.map(({ value, label }) => [value, label])
);

export function categoryLabel(category) {
  return CATEGORY_LABELS[category] || category;
}

export function mergeFixedLessonTypes(dbTypes = []) {
  const byLabel = new Map();

  for (const [index, type] of BUILTIN_FIXED_LESSON_TYPES.entries()) {
    byLabel.set(type.label, {
      id: null,
      label: type.label,
      category: type.category,
      sort_order: index,
      deletable: false,
    });
  }

  for (const type of dbTypes) {
    byLabel.set(type.label, {
      id: type.id,
      label: type.label,
      category: type.category,
      sort_order: type.sort_order ?? 1000,
      deletable: true,
    });
  }

  return Array.from(byLabel.values()).sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.label.localeCompare(b.label, 'he');
  });
}

export function labelsForCategories(fixedTypes, categories) {
  return fixedTypes
    .filter((type) => categories.includes(type.category))
    .map((type) => type.label);
}

export function categoryForLabel(label, fixedTypes) {
  return fixedTypes.find((type) => type.label === label)?.category ?? null;
}

export function isValidFixedLessonCategory(category) {
  return FIXED_LESSON_CATEGORIES.some((item) => item.value === category);
}
