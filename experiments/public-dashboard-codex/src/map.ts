import type { Site } from './data.js';

const REGION = { minLon: -78.8, maxLon: -76.85, minLat: 39.95, maxLat: 41.65 };
const MAP_W = 1000;
const MAP_H = 700;

export type ViewBox = { x: number; y: number; w: number; h: number };
export type MapCallbacks = {
  onSelect: (site: Site) => void;
  onHover: (site: Site | null, clientX?: number, clientY?: number) => void;
};

export function project(lon: number, lat: number): { x: number; y: number } {
  return { x: ((lon - REGION.minLon) / (REGION.maxLon - REGION.minLon)) * MAP_W, y: ((REGION.maxLat - lat) / (REGION.maxLat - REGION.minLat)) * MAP_H };
}

function pathFromCoords(coords: [number, number][]): string {
  return coords.map(([lon, lat], i) => { const p = project(lon, lat); return `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`; }).join(' ');
}

const counties = [
  { name: 'Clearfield', coords: [[-78.65,41.18],[-78.20,41.22],[-77.98,40.96],[-78.12,40.69],[-78.55,40.70],[-78.72,40.90]] as [number,number][] },
  { name: 'Centre', coords: [[-78.12,41.10],[-77.53,41.18],[-77.28,40.88],[-77.55,40.60],[-78.02,40.64],[-78.18,40.86]] as [number,number][] },
  { name: 'Clinton', coords: [[-77.82,41.51],[-77.08,41.55],[-77.02,41.08],[-77.54,41.17],[-77.88,41.12]] as [number,number][] },
  { name: 'Mifflin', coords: [[-77.70,40.76],[-77.29,40.83],[-77.22,40.48],[-77.55,40.42],[-77.83,40.56]] as [number,number][] },
  { name: 'Huntingdon', coords: [[-78.28,40.72],[-77.72,40.73],[-77.53,40.29],[-77.78,40.03],[-78.20,40.10],[-78.43,40.43]] as [number,number][] },
  { name: 'Blair', coords: [[-78.58,40.77],[-78.20,40.78],[-78.20,40.16],[-78.53,40.20],[-78.67,40.52]] as [number,number][] },
  { name: 'Lycoming', coords: [[-77.55,41.55],[-76.88,41.56],[-76.95,41.04],[-77.35,41.00],[-77.56,41.18]] as [number,number][] }
];

const streams: { name: string; major?: boolean; coords: [number, number][] }[] = [
  { name: 'West Branch Susquehanna', major: true, coords: [[-78.55,41.08],[-78.18,41.02],[-77.76,41.11],[-77.46,41.13],[-77.18,41.12],[-76.94,41.18]] },
  { name: 'Juniata River', major: true, coords: [[-78.48,40.23],[-78.18,40.33],[-77.96,40.48],[-77.61,40.59],[-77.35,40.51],[-77.10,40.46]] },
  { name: 'Little Juniata River', coords: [[-78.53,40.67],[-78.39,40.61],[-78.27,40.61],[-78.11,40.53],[-77.97,40.48]] },
  { name: 'Spring Creek', coords: [[-77.95,40.71],[-77.89,40.78],[-77.86,40.84],[-77.80,40.91],[-77.76,40.98]] },
  { name: 'Bald Eagle Creek', coords: [[-78.16,40.92],[-77.93,40.94],[-77.78,40.95],[-77.59,41.00],[-77.45,41.08]] },
  { name: 'Penns Creek', coords: [[-77.78,40.79],[-77.61,40.80],[-77.48,40.74],[-77.29,40.70],[-77.11,40.65]] },
  { name: 'Kishacoquillas Creek', coords: [[-77.77,40.73],[-77.67,40.67],[-77.57,40.63],[-77.49,40.59]] },
  { name: 'Standing Stone Creek', coords: [[-78.12,40.76],[-78.09,40.63],[-78.02,40.49],[-77.97,40.40]] },
  { name: 'Pine Creek', coords: [[-77.61,41.55],[-77.52,41.42],[-77.41,41.32],[-77.34,41.19],[-77.28,41.08]] },
  { name: 'Moshannon Creek', coords: [[-78.34,41.16],[-78.20,41.03],[-78.14,40.91],[-78.02,40.80]] },
  { name: 'Raystown Branch Juniata', coords: [[-78.60,40.06],[-78.40,40.20],[-78.28,40.31],[-78.14,40.37],[-78.04,40.44]] }
];

const contourPaths = Array.from({ length: 26 }, (_, i) => {
  const y = 28 + i * 25;
  const amp = 8 + (i % 4) * 3;
  let d = `M -20 ${y}`;
  for (let x = -20; x <= 1020; x += 65) {
    const yy = y + Math.sin((x + i * 37) / 115) * amp + Math.cos((x - i * 19) / 73) * 3.5;
    d += ` L ${x.toFixed(0)} ${yy.toFixed(1)}`;
  }
  return d;
});

type Cluster = { x: number; y: number; sites: Site[] };

export class MapController {
  private svg: SVGSVGElement;
  private marks: SVGGElement;
  private filtered: Site[] = [];
  private selectedId: string | null = null;
  private callbacks: MapCallbacks;
  private view: ViewBox = { x: 0, y: 0, w: MAP_W, h: MAP_H };
  private initialView: ViewBox = { x: 0, y: 0, w: MAP_W, h: MAP_H };
  private dragging = false;
  private dragStart = { x: 0, y: 0 };
  private startView = { x: 0, y: 0, w: MAP_W, h: MAP_H };
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchStartDistance = 0;
  private pinchAnchor = { x: 0, y: 0 };

  constructor(svg: SVGSVGElement, marks: SVGGElement, callbacks: MapCallbacks) {
    this.svg = svg;
    this.marks = marks;
    this.callbacks = callbacks;
    this.renderBase();
    this.bindInteractions();
  }

  setSites(sites: Site[], selectedId: string | null): void { this.filtered = sites; this.selectedId = selectedId; this.renderMarks(); }
  setSelected(id: string | null): void { this.selectedId = id; this.renderMarks(); }

  fitSites(sites = this.filtered): void {
    if (!sites.length) return;
    const pts = sites.map((s) => project(s.lon, s.lat));
    const minX = Math.min(...pts.map((p) => p.x)), maxX = Math.max(...pts.map((p) => p.x));
    const minY = Math.min(...pts.map((p) => p.y)), maxY = Math.max(...pts.map((p) => p.y));
    const padX = Math.max(65, (maxX - minX) * 0.12), padY = Math.max(55, (maxY - minY) * 0.18);
    const target = this.constrain({ x: minX - padX, y: minY - padY, w: Math.max(180, maxX - minX + padX * 2), h: Math.max(150, maxY - minY + padY * 2) });
    this.initialView = { ...target };
    this.animateTo(target);
  }

  reset(): void { this.animateTo(this.initialView); }

  zoomToSite(site: Site): void {
    const p = project(site.lon, site.lat);
    const w = 310;
    const h = w * (this.svg.clientHeight / Math.max(1, this.svg.clientWidth));
    this.animateTo(this.constrain({ x: p.x - w / 2, y: p.y - h / 2, w, h }));
  }

  zoomBy(factor: number, anchor?: { x: number; y: number }): void {
    const center = anchor ?? { x: this.view.x + this.view.w / 2, y: this.view.y + this.view.h / 2 };
    const newW = this.view.w * factor, newH = this.view.h * factor;
    const rx = (center.x - this.view.x) / this.view.w, ry = (center.y - this.view.y) / this.view.h;
    this.setView(this.constrain({ x: center.x - rx * newW, y: center.y - ry * newH, w: newW, h: newH }));
  }

  private constrain(view: ViewBox): ViewBox {
    const minW = 105, maxW = MAP_W * 1.12;
    const aspect = this.svg.clientWidth > 0 ? this.svg.clientHeight / this.svg.clientWidth : 0.7;
    const w = Math.min(maxW, Math.max(minW, view.w));
    const h = Math.min(MAP_H * 1.12, Math.max(minW * aspect, view.h));
    const x = Math.min(MAP_W - w * 0.1, Math.max(-w * 0.1, view.x));
    const y = Math.min(MAP_H - h * 0.1, Math.max(-h * 0.1, view.y));
    return { x, y, w, h };
  }

  private setView(view: ViewBox): void {
    this.view = view;
    this.svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    this.renderMarks();
  }

  private animateTo(target: ViewBox): void {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { this.setView(target); return; }
    const start = { ...this.view }, started = performance.now(), duration = 260;
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / duration), eased = 1 - Math.pow(1 - t, 3);
      this.setView({ x: start.x + (target.x - start.x) * eased, y: start.y + (target.y - start.y) * eased, w: start.w + (target.w - start.w) * eased, h: start.h + (target.h - start.h) * eased });
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  private renderBase(): void {
    const base = this.svg.querySelector<SVGGElement>('[data-map-base]');
    if (!base) return;
    base.innerHTML = `
      <rect class="map-land" x="0" y="0" width="1000" height="700"></rect>
      <g class="map-contours" aria-hidden="true">${contourPaths.map((d) => `<path d="${d}"></path>`).join('')}</g>
      <g class="map-counties">${counties.map((county) => {
        const points = county.coords.map(([lon, lat]) => { const p = project(lon, lat); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(' ');
        const centroid = county.coords.reduce((acc, [lon, lat]) => ({ lon: acc.lon + lon / county.coords.length, lat: acc.lat + lat / county.coords.length }), { lon: 0, lat: 0 });
        const label = project(centroid.lon, centroid.lat);
        return `<polygon points="${points}"></polygon><text x="${label.x.toFixed(1)}" y="${label.y.toFixed(1)}">${county.name.toUpperCase()}</text>`;
      }).join('')}</g>
      <g class="map-streams">${streams.map((stream) => `<path class="${stream.major ? 'major' : ''}" d="${pathFromCoords(stream.coords)}"></path>`).join('')}</g>
      <g class="stream-labels">${streams.filter((_, i) => i < 8).map((stream) => { const mid = stream.coords[Math.floor(stream.coords.length / 2)]!; const p = project(mid[0], mid[1]); return `<text x="${(p.x + 8).toFixed(1)}" y="${(p.y - 8).toFixed(1)}">${stream.name}</text>`; }).join('')}</g>
      <g class="place-labels" aria-hidden="true">
        <text x="${project(-77.86,40.793).x}" y="${project(-77.86,40.793).y}">STATE COLLEGE</text>
        <text x="${project(-77.778,40.913).x}" y="${project(-77.778,40.913).y}">BELLEFONTE</text>
        <text x="${project(-78.394,40.518).x}" y="${project(-78.394,40.518).y}">ALTOONA</text>
        <text x="${project(-77.571,40.599).x}" y="${project(-77.571,40.599).y}">LEWISTOWN</text>
        <text x="${project(-77.447,41.137).x}" y="${project(-77.447,41.137).y}">LOCK HAVEN</text>
        <text x="${project(-77.998,40.484).x}" y="${project(-77.998,40.484).y}">HUNTINGDON</text>
      </g>`;
  }

  private getClusters(): Cluster[] {
    const zoom = MAP_W / this.view.w;
    const radius = zoom < 1.6 ? 28 : zoom < 2.8 ? 20 : 11;
    if (zoom > 4.2) return this.filtered.map((site) => ({ ...project(site.lon, site.lat), sites: [site] }));
    const buckets = new Map<string, Cluster>();
    for (const site of this.filtered) {
      const p = project(site.lon, site.lat), gx = Math.round(p.x / radius), gy = Math.round(p.y / radius), key = `${gx}:${gy}`;
      const existing = buckets.get(key);
      if (existing) { const count = existing.sites.length; existing.x = (existing.x * count + p.x) / (count + 1); existing.y = (existing.y * count + p.y) / (count + 1); existing.sites.push(site); }
      else buckets.set(key, { x: p.x, y: p.y, sites: [site] });
    }
    return [...buckets.values()];
  }

  private renderMarks(): void {
    const zoom = MAP_W / this.view.w, scale = 1 / Math.max(0.8, zoom), clusters = this.getClusters();
    this.marks.innerHTML = clusters.map((cluster) => {
      if (cluster.sites.length > 1) {
        const selectedInside = this.selectedId ? cluster.sites.some((s) => s.id === this.selectedId) : false;
        const r = Math.max(10, Math.min(18, 8 + Math.log2(cluster.sites.length) * 2.2)) * scale;
        return `<g class="map-cluster ${selectedInside ? 'contains-selected' : ''}" tabindex="0" role="button" aria-label="${cluster.sites.length} monitoring sites; activate to zoom" data-cluster="${cluster.sites.map((s) => s.id).join(',')}" transform="translate(${cluster.x} ${cluster.y})"><circle r="${r}"></circle><text y="${1.2 * scale}" style="font-size:${8.8 * scale}px">${cluster.sites.length}</text></g>`;
      }
      const site = cluster.sites[0]!, selected = site.id === this.selectedId, r = (selected ? 8.5 : 5.1) * scale;
      return `<g class="map-site ${selected ? 'selected' : ''}" tabindex="0" role="button" aria-label="Select ${site.name}, ${site.county} County" data-site-id="${site.id}" transform="translate(${cluster.x} ${cluster.y})"><circle class="site-halo" r="${(selected ? 14 : 9) * scale}"></circle><circle class="site-dot" r="${r}"></circle></g>`;
    }).join('');
    this.bindMarks();
  }

  private bindMarks(): void {
    this.marks.querySelectorAll<SVGGElement>('[data-site-id]').forEach((el) => {
      const site = this.filtered.find((item) => item.id === el.dataset.siteId);
      if (!site) return;
      const select = () => this.callbacks.onSelect(site);
      el.addEventListener('click', (event) => { event.stopPropagation(); select(); });
      el.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } });
      el.addEventListener('pointerenter', (event) => this.callbacks.onHover(site, event.clientX, event.clientY));
      el.addEventListener('pointermove', (event) => this.callbacks.onHover(site, event.clientX, event.clientY));
      el.addEventListener('pointerleave', () => this.callbacks.onHover(null));
    });
    this.marks.querySelectorAll<SVGGElement>('[data-cluster]').forEach((el) => {
      const ids = el.dataset.cluster!.split(','), group = this.filtered.filter((s) => ids.includes(s.id));
      const activate = () => this.fitSites(group);
      el.addEventListener('click', (event) => { event.stopPropagation(); activate(); });
      el.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); } });
    });
  }

  private bindInteractions(): void {
    this.svg.addEventListener('wheel', (event) => {
      event.preventDefault();
      const rect = this.svg.getBoundingClientRect(), rx = (event.clientX - rect.left) / rect.width, ry = (event.clientY - rect.top) / rect.height;
      this.zoomBy(event.deltaY > 0 ? 1.16 : 0.86, { x: this.view.x + rx * this.view.w, y: this.view.y + ry * this.view.h });
    }, { passive: false });
    this.svg.addEventListener('dblclick', (event) => {
      const rect = this.svg.getBoundingClientRect();
      this.zoomBy(0.65, { x: this.view.x + ((event.clientX - rect.left) / rect.width) * this.view.w, y: this.view.y + ((event.clientY - rect.top) / rect.height) * this.view.h });
    });
    this.svg.addEventListener('pointerdown', (event) => {
      if ((event.target as Element).closest('[data-site-id],[data-cluster]')) return;
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      this.svg.setPointerCapture(event.pointerId);
      if (this.pointers.size === 1) {
        this.dragging = true; this.dragStart = { x: event.clientX, y: event.clientY }; this.startView = { ...this.view }; this.svg.classList.add('dragging');
      } else if (this.pointers.size === 2) {
        this.dragging = false; this.svg.classList.remove('dragging');
        const [a, b] = [...this.pointers.values()];
        if (!a || !b) return;
        this.pinchStartDistance = Math.hypot(b.x - a.x, b.y - a.y);
        this.startView = { ...this.view };
        const rect = this.svg.getBoundingClientRect(), midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
        this.pinchAnchor = { x: this.startView.x + ((midX - rect.left) / rect.width) * this.startView.w, y: this.startView.y + ((midY - rect.top) / rect.height) * this.startView.h };
      }
    });
    this.svg.addEventListener('pointermove', (event) => {
      if (!this.pointers.has(event.pointerId)) return;
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const rect = this.svg.getBoundingClientRect();
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        if (!a || !b || this.pinchStartDistance <= 0) return;
        const distance = Math.max(24, Math.hypot(b.x - a.x, b.y - a.y)), factor = this.pinchStartDistance / distance;
        const newW = this.startView.w * factor, newH = this.startView.h * factor, midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
        this.setView(this.constrain({ x: this.pinchAnchor.x - ((midX - rect.left) / rect.width) * newW, y: this.pinchAnchor.y - ((midY - rect.top) / rect.height) * newH, w: newW, h: newH }));
        return;
      }
      if (!this.dragging) return;
      const dx = (event.clientX - this.dragStart.x) / rect.width * this.startView.w, dy = (event.clientY - this.dragStart.y) / rect.height * this.startView.h;
      this.setView(this.constrain({ ...this.startView, x: this.startView.x - dx, y: this.startView.y - dy }));
    });
    const endPointer = (event: PointerEvent) => {
      this.pointers.delete(event.pointerId);
      if (this.pointers.size === 1) {
        const remaining = [...this.pointers.values()][0]!;
        this.dragging = true; this.dragStart = { ...remaining }; this.startView = { ...this.view }; this.svg.classList.add('dragging');
      } else { this.dragging = false; this.svg.classList.remove('dragging'); }
    };
    this.svg.addEventListener('pointerup', endPointer);
    this.svg.addEventListener('pointercancel', endPointer);
    this.svg.addEventListener('keydown', (event) => {
      const panX = this.view.w * 0.08, panY = this.view.h * 0.08;
      if (event.key === 'ArrowLeft') { event.preventDefault(); this.setView(this.constrain({ ...this.view, x: this.view.x - panX })); }
      if (event.key === 'ArrowRight') { event.preventDefault(); this.setView(this.constrain({ ...this.view, x: this.view.x + panX })); }
      if (event.key === 'ArrowUp') { event.preventDefault(); this.setView(this.constrain({ ...this.view, y: this.view.y - panY })); }
      if (event.key === 'ArrowDown') { event.preventDefault(); this.setView(this.constrain({ ...this.view, y: this.view.y + panY })); }
      if (event.key === '+' || event.key === '=') { event.preventDefault(); this.zoomBy(0.82); }
      if (event.key === '-') { event.preventDefault(); this.zoomBy(1.22); }
      if (event.key === 'Home') { event.preventDefault(); this.fitSites(); }
    });
  }
}
