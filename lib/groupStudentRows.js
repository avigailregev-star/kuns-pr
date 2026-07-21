import { getLessonTypeValue } from './groupNaming';

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

export function groupStudentRows(rows) {
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
      const type = getLessonTypeValue(r.selected_course);
      if (type === 'theory') categories.theory.push(r);
      else if (type === 'orchestra' || type === 'choir') categories.ensemble.push(r);
      else categories.individual.push(r);
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
