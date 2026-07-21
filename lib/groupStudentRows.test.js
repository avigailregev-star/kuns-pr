import { groupStudentRows } from './groupStudentRows';

function reg(overrides) {
  return {
    id: 'id',
    student_name: 'שם',
    parent_phone: '050-0000000',
    selected_course: null,
    linked_registration_id: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('groupStudentRows — clustering', () => {
  test('a lone individual registration becomes its own single-member group', () => {
    const rows = [reg({ id: 'r1', student_name: 'דני כהן' })];
    const groups = groupStudentRows(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toEqual([rows[0]]);
    expect(groups[0].contactRow).toBe(rows[0]);
  });

  test('rows linked via linked_registration_id join the same group', () => {
    const source = reg({ id: 'src', student_name: 'דני כהן', created_at: '2026-01-01T00:00:00Z' });
    const theoryAddon = reg({ id: 'addon1', student_name: 'דני כהן', selected_course: 'תיאוריה', linked_registration_id: 'src', created_at: '2026-01-05T00:00:00Z' });
    const ensembleAddon = reg({ id: 'addon2', student_name: 'דני כהן', selected_course: 'תזמורת כלי קשת', linked_registration_id: 'src', created_at: '2026-01-06T00:00:00Z' });
    const groups = groupStudentRows([source, theoryAddon, ensembleAddon]);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(3);
    expect(groups[0].contactRow).toBe(source);
  });

  test('two independent individual registrations with the same student_name and parent_phone are merged', () => {
    const piano = reg({ id: 'p1', student_name: 'נועה ברקאי', parent_phone: '050-3334445', selected_course: 'פסנתר 45 דקות', created_at: '2026-01-10T00:00:00Z' });
    const violin = reg({ id: 'p2', student_name: 'נועה ברקאי', parent_phone: '050-3334445', selected_course: 'כינור 45 דקות', created_at: '2026-01-08T00:00:00Z' });
    const groups = groupStudentRows([piano, violin]);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(2);
    // Earliest created_at wins as the contact row.
    expect(groups[0].contactRow).toBe(violin);
  });

  test('same student_name but different parent_phone stays as separate groups', () => {
    const a = reg({ id: 'a1', student_name: 'יוסי כהן', parent_phone: '050-1111111' });
    const b = reg({ id: 'b1', student_name: 'יוסי כהן', parent_phone: '050-2222222' });
    const groups = groupStudentRows([a, b]);
    expect(groups).toHaveLength(2);
  });

  test('two unrelated registrations with blank name and phone are not merged into one family', () => {
    const a = reg({ id: 'a1', student_name: '', parent_phone: '' });
    const b = reg({ id: 'b1', student_name: '', parent_phone: '' });
    const groups = groupStudentRows([a, b]);
    expect(groups).toHaveLength(2);
  });

  test('a trailing space on parent_phone does not block merging an otherwise-identical duplicate', () => {
    const a = reg({ id: 'a1', student_name: 'נועה ברקאי', parent_phone: '050-3334445', created_at: '2026-01-08T00:00:00Z' });
    const b = reg({ id: 'b1', student_name: 'נועה ברקאי', parent_phone: '050-3334445 ', created_at: '2026-01-09T00:00:00Z' });
    const groups = groupStudentRows([a, b]);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(2);
  });

  test('a group formed by two independent individuals can still absorb a linked add-on off either one', () => {
    const piano = reg({ id: 'p1', student_name: 'נועה ברקאי', parent_phone: '050-3334445', created_at: '2026-01-08T00:00:00Z' });
    const violin = reg({ id: 'p2', student_name: 'נועה ברקאי', parent_phone: '050-3334445', created_at: '2026-01-09T00:00:00Z' });
    const theoryAddon = reg({ id: 't1', student_name: 'נועה ברקאי', selected_course: 'תיאוריה', linked_registration_id: 'p2', created_at: '2026-01-10T00:00:00Z' });
    const groups = groupStudentRows([piano, violin, theoryAddon]);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(3);
  });
});

describe('groupStudentRows — category bucketing', () => {
  test('buckets theory, orchestra/choir, and everything else correctly', () => {
    const individual = reg({ id: 'i1', selected_course: 'פסנתר 45 דקות' });
    const unrecognized = reg({ id: 'i2', selected_course: 'משהו לא מוכר', linked_registration_id: null, student_name: 'אחר', parent_phone: '050-9999999' });
    const theory = reg({ id: 't1', selected_course: 'תיאוריה', linked_registration_id: 'i1' });
    const orchestra = reg({ id: 'o1', selected_course: 'תזמורת כלי קשת', linked_registration_id: 'i1' });
    const choir = reg({ id: 'c1', selected_course: 'מקהלה צעירה', linked_registration_id: 'i1' });

    const groups = groupStudentRows([individual, theory, orchestra, choir]);
    expect(groups).toHaveLength(1);
    expect(groups[0].categories.individual).toEqual([individual]);
    expect(groups[0].categories.theory).toEqual([theory]);
    expect(groups[0].categories.ensemble).toEqual([orchestra, choir]);

    const otherGroups = groupStudentRows([unrecognized]);
    expect(otherGroups[0].categories.individual).toEqual([unrecognized]);
  });
});

describe('groupStudentRows — group ordering', () => {
  test('groups are sorted by most recent member created_at, descending', () => {
    const older = reg({ id: 'o1', student_name: 'ישן', parent_phone: '050-1', created_at: '2026-01-01T00:00:00Z' });
    const newer = reg({ id: 'n1', student_name: 'חדש', parent_phone: '050-2', created_at: '2026-01-15T00:00:00Z' });
    const groups = groupStudentRows([older, newer]);
    expect(groups.map(g => g.contactRow.id)).toEqual(['n1', 'o1']);
  });
});
