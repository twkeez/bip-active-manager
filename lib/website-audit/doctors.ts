// One doctor is often named two ways across a site ("Dr. Amy Kirkpatrick" on
// the staff page, "Dr. Kirkpatrick" on the tour). Counting both made Edgewater
// look like it had two doctors, one without a bio.

const keyOf = (name: string) =>
  name.toLowerCase().replace(/^dr\.?\s+/, "").replace(/,.*$/, "").replace(/\s+(dvm|vmd|ms|phd)\.?$/g, "").trim();

/** For the names found, a function giving each its doctor: a bare surname joins the one full name ending in it. */
export function doctorKeys(names: string[]): (name: string) => string {
  const full = [...new Set(names.map(keyOf))].filter((k) => k.includes(" "));
  return (name: string) => {
    const key = keyOf(name);
    if (key.includes(" ")) return key;
    const matches = full.filter((f) => f.endsWith(` ${key}`));
    return matches.length === 1 ? matches[0] : key;
  };
}
