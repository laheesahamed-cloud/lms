// Sorting in the database adds a sort pass that counts every row twice in
// rows examined; small lists are sorted in the app instead, in the same order
// as the columns' utf8mb4_general_ci collation: case- and accent-insensitive,
// otherwise plain character order (a space sorts before "—"). Equal names are
// ordered by id, so the order is always the same.
export function generalCiKey(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}

export function sortByName<T extends Record<string, any>>(rows: T[], name: (row: T) => string) {
  return rows.sort((a, b) => {
    const x = generalCiKey(name(a));
    const y = generalCiKey(name(b));
    if (x !== y) return x < y ? -1 : 1;
    return Number(a.id) - Number(b.id);
  });
}
