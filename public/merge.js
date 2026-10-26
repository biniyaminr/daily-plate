// Import adds missing records; existing account values always take precedence.
// Browser originals remain untouched, including any conflicting values.
function mergeProgress(kind, cloud, local) {
  let conflicts = 0;
  const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  function merge(current, incoming, path = []) {
    if (incoming === undefined) return copy(current);
    if (current === undefined) return copy(incoming);
    if (JSON.stringify(current) === JSON.stringify(incoming)) return copy(current);
    if (kind === 'nutrition' && path[0] === 'days' && path.length === 2) {
      const rows = copy(current);
      for (const row of incoming) {
        const existing = rows.find(item => item.id === row.id);
        if (!existing) rows.push(copy(row));
        else if (JSON.stringify(existing) !== JSON.stringify(row)) conflicts++;
      }
      return rows;
    }
    if (current && incoming && typeof current === 'object' && typeof incoming === 'object' && !Array.isArray(current) && !Array.isArray(incoming)) {
      return Object.fromEntries([...new Set([...Object.keys(current), ...Object.keys(incoming)])].map(key => [key, merge(current[key], incoming[key], [...path, key])]));
    }
    // Checklist arrays can be extended without clearing existing checkmarks.
    if (Array.isArray(current) && Array.isArray(incoming) && ['meals', 'shopping'].includes(path.at(-1))) {
      return Array.from({ length: Math.max(current.length, incoming.length) }, (_, i) => merge(current[i] ?? undefined, incoming[i] ?? undefined, [...path, i]) ?? null);
    }
    conflicts++;
    return copy(current);
  }
  return { value: merge(cloud, local), conflicts };
}
globalThis.PlateMerge = mergeProgress;
