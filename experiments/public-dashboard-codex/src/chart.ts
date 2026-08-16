import type { Observation, Parameter } from './data.js';

export type RangeKey = '12m' | '5y' | 'full';

function fmtDate(iso: string, short = false): string {
  const date = new Date(`${iso}T12:00:00Z`);
  return new Intl.DateTimeFormat('en-US', short ? { month: 'short', year: '2-digit', timeZone: 'UTC' } : { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!);
}

export function filterRange(observations: Observation[], range: RangeKey): Observation[] {
  if (!observations.length || range === 'full') return observations;
  const last = new Date(`${observations[observations.length - 1]!.date}T12:00:00Z`);
  const cutoff = new Date(last);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - (range === '12m' ? 1 : 5));
  return observations.filter((obs) => new Date(`${obs.date}T12:00:00Z`) >= cutoff);
}

export function renderChart(container: HTMLElement, observations: Observation[], parameter: Parameter, range: RangeKey): void {
  const filtered = filterRange(observations, range);
  const values = filtered.filter((obs) => obs.value !== null) as (Observation & { value: number })[];
  if (!filtered.length) {
    container.innerHTML = `<div class="chart-empty"><strong>No observations in this date range</strong><span>Try a broader range to inspect the site's approved record.</span></div>`;
    return;
  }
  if (!values.length) {
    container.innerHTML = `<div class="chart-empty"><strong>No ${escapeHtml(parameter.name.toLowerCase())} data</strong><span>Approved sampling events exist, but this parameter is missing for the selected range.</span></div>`;
    return;
  }

  const W = 820, H = 320;
  const margin = { left: 70, right: 24, top: 20, bottom: 48 };
  const plotW = W - margin.left - margin.right;
  const plotH = H - margin.top - margin.bottom;
  const dates = filtered.map((obs) => new Date(`${obs.date}T12:00:00Z`).getTime());
  const minT = Math.min(...dates), maxT = Math.max(...dates);
  const rawMin = Math.min(...values.map((obs) => obs.value));
  const rawMax = Math.max(...values.map((obs) => obs.value));
  const rawSpan = Math.max(0.0001, rawMax - rawMin);
  const pad = Math.max(rawSpan * 0.16, Math.abs(rawMax) * 0.018, parameter.key === 'ph' ? 0.08 : 0.02);
  const minY = rawMin - pad;
  const maxY = rawMax + pad;
  const x = (date: string) => margin.left + ((new Date(`${date}T12:00:00Z`).getTime() - minT) / Math.max(1, maxT - minT)) * plotW;
  const y = (value: number) => margin.top + (1 - (value - minY) / Math.max(0.0001, maxY - minY)) * plotH;
  const yTicks = Array.from({ length: 5 }, (_, i) => minY + (maxY - minY) * (i / 4));
  const xTickCount = range === '12m' ? 5 : 6;
  const xTicks = Array.from({ length: xTickCount }, (_, i) => new Date(minT + (maxT - minT) * (i / (xTickCount - 1))).toISOString().slice(0, 10));

  const segments: Observation[][] = [];
  let current: Observation[] = [];
  for (const obs of filtered) {
    if (obs.value === null) { if (current.length) segments.push(current); current = []; }
    else current.push(obs);
  }
  if (current.length) segments.push(current);
  const segmentPaths = segments.filter((segment) => segment.length > 1).map((segment) => `<path class="chart-line" d="${segment.map((obs, i) => `${i === 0 ? 'M' : 'L'} ${x(obs.date).toFixed(2)} ${y(obs.value!).toFixed(2)}`).join(' ')}"></path>`).join('');
  const points = values.map((obs, index) => `<circle class="chart-point" tabindex="0" role="button" aria-label="${escapeHtml(parameter.name)} ${obs.value} ${escapeHtml(parameter.unit)} on ${fmtDate(obs.date)} at ${obs.timeET}; approved observation" data-chart-point="${index}" cx="${x(obs.date).toFixed(2)}" cy="${y(obs.value).toFixed(2)}" r="4.3"></circle>`).join('');

  container.innerHTML = `
    <div class="chart-frame">
      <svg class="trend-svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="chart-title chart-desc">
        <title id="chart-title">${escapeHtml(parameter.name)} over time</title>
        <desc id="chart-desc">Approved observations from ${fmtDate(filtered[0]!.date)} through ${fmtDate(filtered[filtered.length - 1]!.date)}. Missing observations create breaks in the connecting line.</desc>
        <g class="chart-grid">${yTicks.map((tick) => `<line x1="${margin.left}" x2="${W - margin.right}" y1="${y(tick)}" y2="${y(tick)}"></line>`).join('')}</g>
        <g class="chart-axis-labels y-labels">${yTicks.map((tick) => `<text x="${margin.left - 12}" y="${y(tick) + 4}" text-anchor="end">${tick.toFixed(parameter.decimals)}</text>`).join('')}</g>
        <g class="chart-axis-labels x-labels">${xTicks.map((tick, i) => `<text x="${x(tick)}" y="${H - 18}" text-anchor="${i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'}">${fmtDate(tick, true)}</text>`).join('')}</g>
        <text class="axis-unit" transform="translate(17 ${margin.top + plotH / 2}) rotate(-90)" text-anchor="middle">${escapeHtml(parameter.unit)}</text>
        ${segmentPaths}${points}
      </svg>
      <div class="chart-tooltip" role="status" aria-live="polite" hidden></div>
    </div>
    <div class="chart-footnote"><span>Individual approved observations</span><span>Line connects consecutive collected values; gaps remain unconnected</span></div>
    <div class="sr-only" aria-live="polite">${values.slice(-12).map((obs) => `${fmtDate(obs.date)}: ${obs.value} ${parameter.unit}.`).join(' ')}</div>`;

  const tooltip = container.querySelector<HTMLElement>('.chart-tooltip')!;
  const svg = container.querySelector<SVGSVGElement>('.trend-svg')!;
  const show = (index: number, el: SVGCircleElement) => {
    const obs = values[index];
    if (!obs) return;
    tooltip.hidden = false;
    tooltip.innerHTML = `<strong>${obs.value.toFixed(parameter.decimals)} <span>${escapeHtml(parameter.unit)}</span></strong><span>${fmtDate(obs.date)} · ${obs.timeET}</span><span class="tooltip-status">Approved observation · Quality reviewed</span>`;
    const svgRect = svg.getBoundingClientRect();
    const pointRect = el.getBoundingClientRect();
    tooltip.style.left = `${Math.max(8, Math.min(svgRect.width - 190, pointRect.left - svgRect.left - 70))}px`;
    tooltip.style.top = `${Math.max(8, pointRect.top - svgRect.top - 92)}px`;
  };
  container.querySelectorAll<SVGCircleElement>('[data-chart-point]').forEach((el) => {
    const index = Number(el.dataset.chartPoint);
    el.addEventListener('pointerenter', () => show(index, el));
    el.addEventListener('focus', () => show(index, el));
    el.addEventListener('click', () => show(index, el));
    el.addEventListener('pointerleave', () => { if (document.activeElement !== el) tooltip.hidden = true; });
    el.addEventListener('blur', () => { tooltip.hidden = true; });
  });
}
