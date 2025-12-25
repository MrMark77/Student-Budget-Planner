export const formatDateRu = (iso: string) => {
  // iso: YYYY-MM-DD
  const [y, m, d] = iso.split("-").map((x) => Number(x));
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(dt);
};

export const formatMonthRu = (ym: string) => {
  // ym: YYYY-MM
  const [y, m] = ym.split("-").map((x) => Number(x));
  if (!y || !m) return ym;
  const dt = new Date(y, m - 1, 1);
  const s = new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric"
  }).format(dt);
  return s.charAt(0).toUpperCase() + s.slice(1);
};


