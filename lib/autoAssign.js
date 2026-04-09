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

// מיפוי מילות מפתח בשם קורס (עברית) → תזמורת/מקהלה
const COURSE_KEYWORD_TO_ORCHESTRA = [
  { keywords: ['כינור', 'צ\'לו', 'צלו', 'ויולה', 'קונטרבס'], orchestra: 'תזמורת כלי קשת' },
  { keywords: ['חליל', 'חצוצרה', 'סקסופון', 'קלרינט', 'אבוב', 'טרומבון', 'טובה'], orchestra: 'תזמורת כלי נשיפה' },
  { keywords: ['פסנתר', 'שירה', 'קול'], orchestra: 'מקהלה' },
];

/**
 * מחזיר שם תזמורת/מקהלה לפי רשימת כלים (ערכים אנגליים מה-InstrumentPicker).
 */
export function getOrchestraForInstruments(instruments) {
  if (!instruments || instruments.length === 0) return null;
  const first = Array.isArray(instruments) ? instruments[0] : instruments;
  return INSTRUMENT_TO_ORCHESTRA[first] || null;
}

/**
 * מחזיר שם תזמורת/מקהלה לפי שם קורס (לתלמידים ממשיכים).
 * מחפש מילות מפתח בשם הקורס.
 */
export function getOrchestraFromCourse(courseName) {
  if (!courseName) return null;
  for (const { keywords, orchestra } of COURSE_KEYWORD_TO_ORCHESTRA) {
    if (keywords.some((kw) => courseName.includes(kw))) return orchestra;
  }
  return null;
}
