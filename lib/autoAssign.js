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
