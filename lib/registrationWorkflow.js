// Display labels preserve the original database status and its history.
export function assignmentStatusLabel(status) {
  if (!status || status === 'חדש') return 'לא שובץ';
  if (status === 'שובץ' || status === 'בוטל') return status;
  return `לא שובץ · ${status}`;
}

export function missingStatusLabels(row, hasAssignment = false) {
  if (row.status === 'בוטל' || row.registration_status === 'Cancelled') return [];
  return [
    row.status !== 'שובץ' && !hasAssignment ? 'לא שובץ' : null,
    row.registration_status !== 'Confirmed' ? 'לא שולם' : null,
  ].filter(Boolean);
}

export function needsAttention(row, hasAssignment = false) {
  return row.status !== 'בוטל' && row.registration_status !== 'Cancelled' &&
    ((!hasAssignment && row.status !== 'שובץ') || row.registration_status !== 'Confirmed');
}

export function isStudentHandled(group) {
  if (!group.members.length) return false;
  const individualHandled = group.categories.individual.length > 0 &&
    group.categories.individual.every(row => row.status === 'שובץ' && row.registration_status === 'Confirmed');
  if (!individualHandled) return false;

  return ['ensemble', 'theory'].every(kind => {
    if (group.contactRow[`${kind}_not_required`] === true) return true;
    return group.categories[kind].length > 0 &&
      group.categories[kind].every(row => row.status === 'שובץ');
  });
}
