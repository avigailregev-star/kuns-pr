import { getLessonTypeValue, groupBaseLabel } from './groupNaming';

function find(parent, id) {
  let cur = id;
  while (parent.get(cur) !== cur) cur = parent.get(cur);
  return cur;
}

function union(parent, a, b) {
  const ra = find(parent, a);
  const rb = find(parent, b);
  if (ra !== rb) parent.set(ra, rb);
}

export function groupStudentRows(rows, lessonGroups = []) {
  const lessonTypeByGroupId = new Map(
    lessonGroups.map(group => [String(group.id), group.lesson_type])
  );
  const lessonGroupById = new Map(
    lessonGroups.map(group => [String(group.id), group])
  );
  const parent = new Map();
  for (const r of rows) parent.set(r.id, r.id);

  for (const r of rows) {
    if (r.linked_registration_id && parent.has(r.linked_registration_id)) {
      union(parent, r.id, r.linked_registration_id);
    }
  }

  const byNamePhone = new Map();
  for (const r of rows) {
    const name = (r.student_name || '').trim();
    const phone = (r.parent_phone || '').trim();
    if (!name || !phone) continue; // don't merge rows that are missing identifying info
    const key = `${name}|||${phone}`;
    if (byNamePhone.has(key)) {
      union(parent, r.id, byNamePhone.get(key));
    } else {
      byNamePhone.set(key, r.id);
    }
  }

  const clusters = new Map();
  for (const r of rows) {
    const root = find(parent, r.id);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(r);
  }

  const groups = [];
  for (const members of clusters.values()) {
    const byCreatedAtAsc = members.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const contactRow = byCreatedAtAsc[0];

    const categories = { individual: [], ensemble: [], theory: [] };
    for (const r of members) {
      // Custom fixed-lesson names are not necessarily part of the built-in
      // label list. Once a registration is attached to a real group, its
      // lesson_type is the authoritative category.
      const type = r.group_id != null
        ? lessonTypeByGroupId.get(String(r.group_id)) || getLessonTypeValue(groupBaseLabel(r.selected_course))
        : getLessonTypeValue(groupBaseLabel(r.selected_course));
      if (type === 'theory') categories.theory.push(r);
      else if (type === 'orchestra' || type === 'choir') categories.ensemble.push(r);
      else categories.individual.push(r);
    }

    // Legacy flows could create a second registration for the same fixed group.
    // Show one card per group without deleting either underlying audit record.
    for (const category of ['ensemble', 'theory']) {
      const unique = [];
      const indexByGroupId = new Map();
      for (const row of categories[category]) {
        if (row.group_id == null) { unique.push(row); continue; }
        const key = String(row.group_id);
        if (!indexByGroupId.has(key)) {
          indexByGroupId.set(key, unique.length);
          unique.push(row);
          continue;
        }
        const linkedGroup = lessonGroupById.get(key);
        if (linkedGroup?.name === row.selected_course) unique[indexByGroupId.get(key)] = row;
      }
      categories[category] = unique;
    }

    groups.push({ key: contactRow.id, contactRow, members, categories });
  }

  groups.sort((a, b) => {
    const aMax = Math.max(...a.members.map(m => new Date(m.created_at).getTime()));
    const bMax = Math.max(...b.members.map(m => new Date(m.created_at).getTime()));
    return bMax - aMax;
  });

  return groups;
}
