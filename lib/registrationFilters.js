export function filterRegistrations(rows, filters) {
  const { search, status, instrument, teacher, payment } = filters || {};

  return rows.filter((row) => {
    const matchSearch =
      !search ||
      row.student_name?.includes(search) ||
      row.parent_name?.includes(search) ||
      row.parent_phone?.includes(search);
    const matchStatus = !status || row.status === status;
    const matchInstrument = !instrument || row.instruments?.includes(instrument);
    const matchTeacher = !teacher || row.teacher === teacher;
    const matchPayment = !payment || (row.registration_status || 'Pending') === payment;

    return matchSearch && matchStatus && matchInstrument && matchTeacher && matchPayment;
  });
}
