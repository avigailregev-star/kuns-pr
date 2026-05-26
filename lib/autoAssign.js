const INSTRUMENT_TO_ORCHESTRA = {
  violin: 'תזמורת כלי קשת',
  cello: 'תזמורת כלי קשת',
  flute: 'תזמורת כלי נשיפה',
  trumpet: 'תזמורת כלי נשיפה',
  saxophone: 'תזמורת כלי נשיפה',
  piano: 'מקהלה',
  voice: 'מקהלה',
};

const COURSE_KEYWORD_TO_ORCHESTRA = [
  { keywords: ['כינור', "צ'לו", 'צלו', 'ויולה', 'קונטרבס'], orchestra: 'תזמורת כלי קשת' },
  { keywords: ['חליל', 'חצוצרה', 'סקסופון', 'קלרינט', 'אבוב', 'טרומבון', 'טובה'], orchestra: 'תזמורת כלי נשיפה' },
  { keywords: ['פסנתר', 'שירה', 'קול'], orchestra: 'מקהלה' },
];

export function getOrchestraForInstruments(instruments) {
  if (!instruments || instruments.length === 0) return null;
  const list = Array.isArray(instruments) ? instruments : [instruments];

  // ✅ תיקון: מנסה כל כלי עד שמוצאת תזמורת
  for (const instrument of list) {
    const orchestra = INSTRUMENT_TO_ORCHESTRA[instrument];
    if (orchestra) return orchestra;
  }
  return null;
}

export function getOrchestraFromCourse(courseName) {
  if (!courseName) return null;
  for (const { keywords, orchestra } of COURSE_KEYWORD_TO_ORCHESTRA) {
    if (keywords.some((kw) => courseName.includes(kw))) return orchestra;
  }
  return null;
}