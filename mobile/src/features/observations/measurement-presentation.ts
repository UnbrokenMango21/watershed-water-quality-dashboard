import { unitForParameter } from '@/config/contracts';

const labels: Record<string, string> = {
  PH: 'pH',
  DO_MG_L: 'Dissolved oxygen',
  CONDUCTIVITY_US_CM: 'Conductivity',
  DO_PERCENT: 'Dissolved oxygen saturation',
  TDS_MG_L: 'Total dissolved solids',
  ORP_MV: 'Oxidation-reduction potential',
  CHLORIDE_MG_L: 'Chloride',
  SULFATE_MG_L: 'Sulfate',
  NITRATE_MG_L: 'Nitrate',
  PHOSPHATE_MG_L: 'Phosphate',
  DISCHARGE_M3_S: 'Discharge',
};

const decimalNumberPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

export function labelForParameter(parameterCode: string) {
  return labels[parameterCode] ?? parameterCode.toLowerCase().replaceAll('_', ' ');
}

export function unitLabelForParameter(parameterCode: string) {
  return unitForParameter(parameterCode) ?? 'value';
}

export function displayUnitForParameter(parameterCode: string) {
  const unit = unitLabelForParameter(parameterCode);
  if (unit === 'uS/cm') return 'µS/cm';
  if (unit === 'm3/s') return 'm³/s';
  return unit;
}

export function numericTextIsFinite(value: string) {
  const normalized = value.trim();
  return decimalNumberPattern.test(normalized) && Number.isFinite(Number(normalized));
}
