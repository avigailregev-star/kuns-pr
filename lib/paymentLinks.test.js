import { getCoursePriceTiers, getPaymentLink, getCourseNames } from './paymentLinks';

describe('getCoursePriceTiers', () => {
  // שיעורים אישיים 45 דק'
  test('45 דק רגיל', () => {
    expect(getCoursePriceTiers("פסנתר- מרינה גוטמן 45 דק'")).toEqual({ until18: 3800, until19: 4200, regular: 4600 });
  });

  test('60 דק רגיל', () => {
    expect(getCoursePriceTiers("פסנתר- מרינה גוטמן 60 דק'")).toEqual({ until18: 4200, until19: 4600, regular: 5000 });
  });

  // מוזיקה מהמזרח
  test('עוד 45 דק', () => {
    expect(getCoursePriceTiers("עוד- אורי לוי 45 דק'")).toEqual({ until18: 3800, until19: 4000, regular: 4600 });
  });

  test('בגלמה 45 דק', () => {
    expect(getCoursePriceTiers("בגלמה- ליאור חמו 45 דק'")).toEqual({ until18: 3800, until19: 4000, regular: 4600 });
  });

  test('קמנצ\'ה 45 דק', () => {
    expect(getCoursePriceTiers("קמנצ'ה- דניאל מרן 45 דק'")).toEqual({ until18: 3800, until19: 4000, regular: 4600 });
  });

  // פיתוח קול זוגי
  test('פיתוח קול זוגי', () => {
    expect(getCoursePriceTiers("פיתוח קול זוגי- אליטה צייטלין 45 דק'")).toEqual({ until18: 2500, until19: 2800, regular: 3000 });
  });

  // קבוצות
  test('הזמיר', () => {
    expect(getCoursePriceTiers('הזמיר')).toEqual({ regular: 1500 });
  });

  test('DJ', () => {
    expect(getCoursePriceTiers('קורס DJ - מיטב אדלגו אבגי')).toEqual({ until19: 2750, regular: 3000 });
  });

  test('CUBASE', () => {
    expect(getCoursePriceTiers('הפקה יוצרת CUBASE - אופק אוזן')).toEqual({ until19: 2250, regular: 2500 });
  });

  test('הפקה יוצרת', () => {
    expect(getCoursePriceTiers('הפקה יוצרת')).toEqual({ until19: 2250, regular: 2500 });
  });

  test('מדברנא', () => {
    expect(getCoursePriceTiers('אנסמבל מדברנא')).toEqual({ until19: 650, regular: 1000 });
  });

  test('מקהלת צעירים', () => {
    expect(getCoursePriceTiers('מקהלת צעירים ב-ו')).toEqual({ until19: 500, regular: 750 });
  });

  test('אנסמבל ללא מחיר', () => {
    expect(getCoursePriceTiers('אנסמבל נועם חיים')).toBeNull();
  });

  // מנגינות
  test("מנגינות שנה ב'", () => {
    expect(getCoursePriceTiers("מנגינות שנה ב' - כינור- אביגיל לויץ")).toEqual({ until18: 1200, until19: 1500, regular: 1750 });
  });

  test("מנגינות שנה ג'", () => {
    expect(getCoursePriceTiers("מנגינות שנה ג' - גיטרה- נתנאל יחיא")).toEqual({ until18: 1500, until19: 1750, regular: 2250 });
  });

  test("מנגינות שנה ד'", () => {
    expect(getCoursePriceTiers("מנגינות שנה ד' - עוד- רחל בלזר")).toEqual({ until18: 2750, until19: 3000, regular: 3500 });
  });

  // קלט לא תקין
  test('קורס ריק', () => {
    expect(getCoursePriceTiers('')).toBeNull();
  });

  test('קורס לא קיים', () => {
    expect(getCoursePriceTiers('משהו לא קיים')).toBeNull();
  });
});

describe('getPaymentLink', () => {
  test('קורס קיים מחזיר קישור', () => {
    const link = getPaymentLink("פסנתר- מרינה גוטמן 45 דק'");
    expect(link).toContain('hugim.org.il');
  });

  test('קורס לא קיים מחזיר null', () => {
    expect(getPaymentLink('קורס שלא קיים')).toBeNull();
  });
});

describe('getCourseNames', () => {
  test('מחזיר מערך לא ריק', () => {
    expect(getCourseNames().length).toBeGreaterThan(0);
  });

  test('מכיל קורסי קונסרבטוריון', () => {
    expect(getCourseNames()).toContain("פסנתר- מרינה גוטמן 45 דק'");
  });

  test('מכיל קורסי מנגינות', () => {
    expect(getCourseNames()).toContain("מנגינות שנה ב' - כינור- אביגיל לויץ");
  });
});
