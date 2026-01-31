
export const parseLocalYYYYMMDD = (s: string | null | undefined): Date | undefined => {
  if (!s) return undefined;
  const p = s.split('-').map(Number);
  if (p.some(isNaN)) return undefined;
  if (p.length !== 3) return undefined;
  const d = new Date(p[0], p[1] - 1, p[2]);
  if (isNaN(d.getTime())) return undefined;
  return d;
};

export const toYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
