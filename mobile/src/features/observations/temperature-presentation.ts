export type TemperatureUnit = 'C' | 'F';

export function convertTemperature(
  value: number,
  fromUnit: TemperatureUnit,
  toUnit: TemperatureUnit,
) {
  if (fromUnit === toUnit) return value;
  return toUnit === 'F' ? (value * 9) / 5 + 32 : ((value - 32) * 5) / 9;
}

export function counterpartUnit(unit: TemperatureUnit): TemperatureUnit {
  return unit === 'C' ? 'F' : 'C';
}
