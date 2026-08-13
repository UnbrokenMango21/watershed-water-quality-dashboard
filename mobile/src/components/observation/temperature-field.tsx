import { MeasurementField } from '@/components/observation/measurement-field';
import { firebaseSchema } from '@/config/contracts';
import { displayNumericText, numericTextIsFinite } from '@/features/observations/measurement-presentation';
import {
  convertTemperature as convertTemperatureValue,
  counterpartUnit,
  type TemperatureUnit,
} from '@/features/observations/temperature-presentation';

export type { TemperatureUnit } from '@/features/observations/temperature-presentation';

type TemperatureFieldProps = {
  value: string;
  unit: TemperatureUnit | null;
  onCommit: (value: string, unit: TemperatureUnit) => void;
  error?: string | null;
};

const units = [
  { value: 'C', label: '°C', accessibilityLabel: 'degrees Celsius' },
  { value: 'F', label: '°F', accessibilityLabel: 'degrees Fahrenheit' },
] as const;

function counterpart(value: string, unit: string) {
  if (!numericTextIsFinite(value)) return null;
  const numeric = Number(value);
  const precision = firebaseSchema.temperatureBehavior.displayPrecision;
  const enteredUnit = unit as TemperatureUnit;
  const converted = convertTemperatureValue(numeric, enteredUnit, counterpartUnit(enteredUnit));
  return `≈ ${displayNumericText(converted.toFixed(precision))} °${counterpartUnit(enteredUnit)}`;
}

function convertTemperatureText(value: string, fromUnit: string, toUnit: string) {
  if (fromUnit === toUnit || !numericTextIsFinite(value)) return value;
  const converted = convertTemperatureValue(
    Number(value),
    fromUnit as TemperatureUnit,
    toUnit as TemperatureUnit,
  );
  return converted.toFixed(firebaseSchema.temperatureBehavior.displayPrecision);
}

export function TemperatureField({ value, unit, onCommit, error }: TemperatureFieldProps) {
  return (
    <MeasurementField
      allowNegative
      convertValue={convertTemperatureText}
      derivePreview={counterpart}
      derivedValue={unit ? counterpart(value, unit) : null}
      error={error}
      label="Water Temperature"
      onCommit={(nextValue, nextUnit) => onCommit(nextValue, nextUnit as TemperatureUnit)}
      required
      selectedUnit={unit}
      testID="measurement-temperature"
      units={units}
      value={value}
    />
  );
}
