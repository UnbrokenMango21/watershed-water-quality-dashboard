export type ParameterKey = 'temperature' | 'ph' | 'do' | 'conductivity' | 'nitrate' | 'doSat' | 'tds' | 'phosphate' | 'chloride' | 'sulfate' | 'discharge' | 'orp';

export type Parameter = {
  key: ParameterKey;
  name: string;
  unit: string;
  decimals: number;
  description: string;
  base: number;
  seasonal: number;
  noise: number;
};

export type Site = {
  id: string;
  code: string;
  name: string;
  watershed: string;
  county: string;
  state: 'PA';
  lat: number;
  lon: number;
  latestDate: string;
  monitoringStart: string;
  approvedCount: number;
  latest: Partial<Record<ParameterKey, number | null>>;
};

export type Observation = {
  date: string;
  timeET: string;
  value: number | null;
  approved: true;
};

export const parameters: Parameter[] = [
  { key: 'temperature', name: 'Water Temperature', unit: '°C', decimals: 1, description: 'Water temperature influences dissolved oxygen, biological activity, and many chemical processes in streams.', base: 13.2, seasonal: 8.4, noise: 1.8 },
  { key: 'ph', name: 'pH', unit: 'pH', decimals: 2, description: 'pH describes how acidic or basic the water is on a logarithmic scale. Interpretation depends on local geology, season, and stream conditions.', base: 7.42, seasonal: 0.18, noise: 0.12 },
  { key: 'do', name: 'Dissolved Oxygen', unit: 'mg/L', decimals: 1, description: 'Dissolved oxygen is the concentration of oxygen available in the water column. It commonly varies with temperature, flow, photosynthesis, and respiration.', base: 9.1, seasonal: 2.1, noise: 0.55 },
  { key: 'conductivity', name: 'Specific Conductivity', unit: 'µS/cm', decimals: 0, description: 'Specific conductivity reflects the water’s ability to conduct electrical current and is influenced by dissolved ions. It is not itself a health or safety score.', base: 315, seasonal: 38, noise: 28 },
  { key: 'nitrate', name: 'Nitrate', unit: 'mg/L', decimals: 2, description: 'Nitrate is a dissolved form of nitrogen. Concentrations can vary with land use, hydrology, season, and biological uptake.', base: 1.18, seasonal: 0.42, noise: 0.23 },
  { key: 'doSat', name: 'Dissolved Oxygen Saturation', unit: '%', decimals: 0, description: 'Dissolved oxygen saturation expresses measured oxygen relative to the amount water can hold at prevailing conditions.', base: 96, seasonal: 8, noise: 5 },
  { key: 'tds', name: 'Total Dissolved Solids', unit: 'mg/L', decimals: 0, description: 'Total dissolved solids estimate the concentration of dissolved material in water.', base: 205, seasonal: 25, noise: 18 },
  { key: 'phosphate', name: 'Phosphate', unit: 'mg/L', decimals: 2, description: 'Phosphate is a form of phosphorus that can be measured in water and varies with runoff, geology, and biological processes.', base: 0.08, seasonal: 0.03, noise: 0.02 },
  { key: 'chloride', name: 'Chloride', unit: 'mg/L', decimals: 1, description: 'Chloride is a dissolved ion that may reflect natural sources and human activities such as road-salt application.', base: 27, seasonal: 10, noise: 6 },
  { key: 'sulfate', name: 'Sulfate', unit: 'mg/L', decimals: 1, description: 'Sulfate is a naturally occurring dissolved ion whose concentration can also reflect local geology and land use.', base: 19, seasonal: 5, noise: 4 },
  { key: 'discharge', name: 'Discharge', unit: 'm³/s', decimals: 2, description: 'Discharge is the volume of water moving past a point per unit time. It changes substantially with rainfall and watershed size.', base: 2.4, seasonal: 1.2, noise: 0.8 },
  { key: 'orp', name: 'Oxidation-Reduction Potential', unit: 'mV', decimals: 0, description: 'Oxidation-reduction potential is an electrochemical measurement related to the tendency of the water environment to accept or donate electrons.', base: 236, seasonal: 24, noise: 18 }
];

export const primaryParameterKeys: ParameterKey[] = ['temperature', 'ph', 'do', 'conductivity', 'nitrate'];

const corridors = [
  { stream: 'Spring Creek', watershed: 'Spring Creek', county: 'Centre', lat: 40.800, lon: -77.855 },
  { stream: 'Bald Eagle Creek', watershed: 'Bald Eagle Creek', county: 'Centre', lat: 40.940, lon: -77.785 },
  { stream: 'Penns Creek', watershed: 'Penns Creek', county: 'Centre', lat: 40.791, lon: -77.585 },
  { stream: 'Buffalo Run', watershed: 'Spring Creek', county: 'Centre', lat: 40.912, lon: -77.784 },
  { stream: 'Little Juniata River', watershed: 'Little Juniata River', county: 'Blair', lat: 40.635, lon: -78.295 },
  { stream: 'Standing Stone Creek', watershed: 'Juniata River', county: 'Huntingdon', lat: 40.488, lon: -78.012 },
  { stream: 'Juniata River', watershed: 'Juniata River', county: 'Mifflin', lat: 40.595, lon: -77.575 },
  { stream: 'Kishacoquillas Creek', watershed: 'Juniata River', county: 'Mifflin', lat: 40.635, lon: -77.565 },
  { stream: 'West Branch Susquehanna', watershed: 'West Branch Susquehanna', county: 'Clinton', lat: 41.137, lon: -77.445 },
  { stream: 'Pine Creek', watershed: 'Pine Creek', county: 'Lycoming', lat: 41.270, lon: -77.325 },
  { stream: 'Moshannon Creek', watershed: 'West Branch Susquehanna', county: 'Clearfield', lat: 40.915, lon: -78.155 },
  { stream: 'Raystown Branch Juniata', watershed: 'Juniata River', county: 'Huntingdon', lat: 40.305, lon: -78.285 }
] as const;

const countyOffsets: Record<string, { lat: number; lon: number }> = {
  Centre: { lat: 0.0, lon: 0.0 }, Blair: { lat: -0.06, lon: -0.04 }, Huntingdon: { lat: -0.05, lon: 0.03 }, Mifflin: { lat: 0.02, lon: 0.03 }, Clinton: { lat: 0.02, lon: 0.04 }, Lycoming: { lat: 0.02, lon: 0.05 }, Clearfield: { lat: 0.01, lon: -0.04 }
};

function hash(text: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rand(seedText: string): number {
  let x = hash(seedText) || 1;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  return (x >>> 0) / 4294967295;
}

function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
function addDays(date: Date, days: number): Date { const copy = new Date(date); copy.setUTCDate(copy.getUTCDate() + days); return copy; }
function isoDate(date: Date): string { return date.toISOString().slice(0, 10); }

function latestValue(siteSeed: string, parameter: Parameter): number | null {
  if (rand(`${siteSeed}:${parameter.key}:missing`) < 0.055) return null;
  const shift = (rand(`${siteSeed}:${parameter.key}:shift`) - 0.5) * parameter.noise * 2.7;
  const seasonal = parameter.seasonal * Math.sin((hash(siteSeed) % 365) / 365 * Math.PI * 2);
  let value = parameter.base + shift + seasonal * 0.22;
  if (parameter.key === 'ph') value = clamp(value, 6.35, 8.65);
  if (parameter.key === 'nitrate' || parameter.key === 'phosphate' || parameter.key === 'discharge') value = Math.max(0.01, value);
  return Number(value.toFixed(parameter.decimals));
}

export function buildSites(): Site[] {
  const output: Site[] = [];
  corridors.forEach((corridor, corridorIndex) => {
    for (let i = 0; i < 27; i += 1) {
      const idx = corridorIndex * 27 + i;
      const seed = `${corridor.stream}:${i}`;
      const linePosition = (i - 13) / 13;
      const cross = (rand(`${seed}:cross`) - 0.5) * 0.045;
      const along = linePosition * 0.17 + (rand(`${seed}:along`) - 0.5) * 0.018;
      const orientation = (corridorIndex % 4) * Math.PI / 7 + 0.35;
      const offset = countyOffsets[corridor.county] ?? { lat: 0, lon: 0 };
      const lat = corridor.lat + Math.sin(orientation) * along + cross + offset.lat;
      const lon = corridor.lon + Math.cos(orientation) * along * 1.35 - cross * 0.9 + offset.lon;
      const latestBase = new Date(Date.UTC(2026, 6, 26));
      const ageRoll = rand(`${seed}:date`);
      const maxAgeDays = ageRoll < 0.72 ? 330 : ageRoll < 0.93 ? 980 : 1900;
      const latestDate = isoDate(addDays(latestBase, -Math.floor(rand(`${seed}:date:age`) * maxAgeDays)));
      const startYear = 2012 + Math.floor(rand(`${seed}:start`) * 10);
      const latest: Site['latest'] = {};
      parameters.forEach((parameter) => { latest[parameter.key] = latestValue(seed, parameter); });
      output.push({
        id: `sample-site-${String(idx + 1).padStart(3, '0')}`,
        code: `WW-${corridor.county.slice(0, 2).toUpperCase()}-${String(idx + 1).padStart(3, '0')}`,
        name: i === 13 ? `${corridor.stream} — Reference Reach` : `${corridor.stream} — Reach ${String(i + 1).padStart(2, '0')}`,
        watershed: corridor.watershed,
        county: corridor.county,
        state: 'PA',
        lat: Number(lat.toFixed(5)),
        lon: Number(lon.toFixed(5)),
        latestDate,
        monitoringStart: `${startYear}-04-01`,
        approvedCount: 48 + Math.floor(rand(`${seed}:count`) * 156),
        latest
      });
    }
  });
  return output;
}

export const sites = buildSites();

export function parameterByKey(key: ParameterKey): Parameter {
  const parameter = parameters.find((item) => item.key === key);
  if (!parameter) throw new Error(`Unknown parameter: ${key}`);
  return parameter;
}

export function buildObservations(site: Site, parameterKey: ParameterKey): Observation[] {
  const parameter = parameterByKey(parameterKey);
  const observations: Observation[] = [];
  const start = new Date(`${site.monitoringStart}T12:00:00Z`);
  const end = new Date(`${site.latestDate}T12:00:00Z`);
  let cursor = start;
  let n = 0;
  while (cursor <= end) {
    const dateKey = isoDate(cursor);
    const dayOfYear = Math.floor((cursor.getTime() - Date.UTC(cursor.getUTCFullYear(), 0, 0)) / 86400000);
    const seasonalSign = parameterKey === 'do' ? -1 : 1;
    const siteShift = (rand(`${site.id}:${parameterKey}:site`) - 0.5) * parameter.noise * 2.0;
    const seasonal = Math.sin((dayOfYear / 365.25) * Math.PI * 2 - 1.4) * parameter.seasonal * seasonalSign;
    const drift = ((cursor.getUTCFullYear() - start.getUTCFullYear()) / 14) * parameter.noise * (rand(`${site.id}:${parameterKey}:drift`) - 0.5);
    const noise = (rand(`${site.id}:${parameterKey}:${dateKey}`) - 0.5) * parameter.noise * 2;
    let value = parameter.base + siteShift + seasonal + drift + noise;
    if (parameterKey === 'ph') value = clamp(value, 6.25, 8.8);
    if (['nitrate', 'phosphate', 'discharge'].includes(parameterKey)) value = Math.max(0.01, value);
    const isMissing = rand(`${site.id}:${parameterKey}:${dateKey}:missing`) < (parameterKey === 'phosphate' ? 0.18 : 0.075);
    observations.push({
      date: dateKey,
      timeET: `${String(8 + (n % 5)).padStart(2, '0')}:${String((13 * n) % 60).padStart(2, '0')} ET`,
      value: isMissing ? null : Number(value.toFixed(parameter.decimals)),
      approved: true
    });
    const interval = 25 + Math.floor(rand(`${site.id}:${parameterKey}:${dateKey}:interval`) * 25);
    cursor = addDays(cursor, interval);
    n += 1;
  }
  if (observations.length) {
    const last = observations[observations.length - 1]!;
    const latest = site.latest[parameterKey];
    if (latest !== undefined) last.value = latest;
  }
  return observations;
}

export const watersheds = [...new Set(sites.map((site) => site.watershed))].sort();
export const counties = [...new Set(sites.map((site) => site.county))].sort();
