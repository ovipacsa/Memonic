export type ConditionCategory = 'sunny' | 'partly-cloudy' | 'overcast' | 'rainy';

export function wmoToCondition(code: number): ConditionCategory {
  if (code === 0) return 'sunny';
  if (code <= 2)  return 'partly-cloudy';
  if (code === 3) return 'overcast';
  return 'rainy'; // fog, drizzle, rain, snow, showers, thunderstorm
}
