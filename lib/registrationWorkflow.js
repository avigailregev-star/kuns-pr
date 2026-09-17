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
    if (group.categories[kind].length > 0) {
      return group.categories[kind].every(row => row.status === 'שובץ');
    }
    return group.contactRow[`${kind}_not_required`] === true;
  });
}

// The admin table can contain several registration rows for one student
// (private lesson, ensemble and theory). Dashboard totals must count the
// student once, using the primary/private registration as its workflow state.
export function registrationStudentStats(groups) {
  const primaryRows = groups.map(group =>
    group.categories.individual[0] || group.contactRow
  );

  return {
    total: groups.length,
    new: primaryRows.filter(row => row?.status === 'חדש').length,
    reviewing: primaryRows.filter(row => row?.status === 'בבדיקה').length,
    // "Assigned students" means the entire registration is complete: the
    // private lesson is assigned and paid, and every required fixed lesson is
    // assigned (or explicitly marked as not required).
    assigned: groups.filter(isStudentHandled).length,
  };
}
