export const MIN_AGE = 14;

export function computeAge(dobIso: string, now: Date = new Date()): number {
  const dob = new Date(dobIso);
  if (isNaN(dob.getTime())) return -1;
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

export function isOldEnough(dobIso: string): boolean {
  return computeAge(dobIso) >= MIN_AGE;
}
