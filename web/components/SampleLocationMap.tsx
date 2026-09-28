'use client';

/**
 * ArcGIS map of where the sample was taken, drawn over real imagery or terrain so a reviewer can see
 * whether the collector stood at the stream the catalogued site describes.
 *
 * It plots only what the revision and catalogue already store: the catalogued site, the site tolerance
 * radius, the sample position, and the GPS accuracy radius. Nothing is recomputed for the record; the
 * stored `site_distance_m` stays the value the console reports.
 *
 * Basemap tiles come from Esri's public, keyless services (the same ones the public dashboard uses).
 * Tile requests reveal only the map area being viewed, never record data. If the ArcGIS SDK or tiles
 * fail to load, the dependency-free LocationDiagram is shown instead so review is never blocked.
 */
import { useEffect, useRef, useState } from 'react';

import '@arcgis/core/assets/esri/themes/light/main.css';

import LocationDiagram, { describeLocation } from '@/components/LocationDiagram';
import { brandPalette } from '@/lib/brandTokens';
import type { Nullable } from '@/lib/types';

const IMAGERY_URL = 'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer';
const TOPO_URL = 'https://services.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer';
const PLACES_URL = 'https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places/MapServer';

type BasemapChoice = 'imagery' | 'topo';

/** "#RRGGBB" plus alpha -> ArcGIS [r, g, b, a]. */
function rgba(hex: string, alpha = 1): [number, number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha];
}

type Props = {
  siteLat: Nullable<number>;
  siteLon: Nullable<number>;
  sampleLat: Nullable<number>;
  sampleLon: Nullable<number>;
  toleranceM: Nullable<number>;
  gpsAccuracyM: Nullable<number>;
  distanceM: Nullable<number>;
};

type BasemapSetter = (choice: BasemapChoice) => void;
type Zoomer = (step: 1 | -1) => void;

export default function SampleLocationMap(props: Props) {
  const { siteLat, siteLon, sampleLat, sampleLon, toleranceM, gpsAccuracyM, distanceM } = props;
  const host = useRef<HTMLDivElement>(null);
  const setBasemapRef = useRef<BasemapSetter | null>(null);
  const zoomRef = useRef<Zoomer | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [basemap, setBasemap] = useState<BasemapChoice>('imagery');

  const hasSample = sampleLat != null && sampleLon != null;
  const hasSite = siteLat != null && siteLon != null;
  const withinTolerance = toleranceM != null && distanceM != null && distanceM <= toleranceM;

  useEffect(() => {
    if (!hasSample || !host.current) return;
    let cancelled = false;
    let destroy: (() => void) | null = null;
    setReady(false);
    setFailed(false);

    (async () => {
      const [
        { default: ArcgisMap },
        { default: MapView },
        { default: Basemap },
        { default: TileLayer },
        { default: GraphicsLayer },
        { default: Graphic },
        { default: Point },
        { default: Circle },
        { default: Polyline },
        { default: Extent },
      ] = await Promise.all([
        import('@arcgis/core/Map.js'),
        import('@arcgis/core/views/MapView.js'),
        import('@arcgis/core/Basemap.js'),
        import('@arcgis/core/layers/TileLayer.js'),
        import('@arcgis/core/layers/GraphicsLayer.js'),
        import('@arcgis/core/Graphic.js'),
        import('@arcgis/core/geometry/Point.js'),
        import('@arcgis/core/geometry/Circle.js'),
        import('@arcgis/core/geometry/Polyline.js'),
        import('@arcgis/core/geometry/Extent.js'),
      ]);
      if (cancelled || !host.current) return;

      const basemaps: Record<BasemapChoice, InstanceType<typeof Basemap>> = {
        imagery: new Basemap({
          id: 'qc-imagery',
          baseLayers: [new TileLayer({ url: IMAGERY_URL })],
          // The imagery itself shows the water at this scale. Esri's hydro overlay is a sparse cache that
          // has no tiles away from mapped streams, so it is left out here rather than filling the console with 404s.
          referenceLayers: [new TileLayer({ url: PLACES_URL, opacity: 0.85 })],
        }),
        // Topographic draws streams and keeps detail at street scale, where a 30 m tolerance circle is readable.
        topo: new Basemap({ id: 'qc-topo', baseLayers: [new TileLayer({ url: TOPO_URL })] }),
      };

      const sample = new Point({ latitude: sampleLat as number, longitude: sampleLon as number });
      const site = hasSite ? new Point({ latitude: siteLat as number, longitude: siteLon as number }) : null;
      const overlay = new GraphicsLayer({ title: 'Sample location' });
      const toleranceColor = withinTolerance ? brandPalette.fern : brandPalette.goldenrod;

      // Site tolerance: the radius the collector was meant to stay inside.
      const toleranceCircle = site && toleranceM != null && toleranceM > 0
        ? new Circle({ center: site, radius: toleranceM, radiusUnit: 'meters', geodesic: true, numberOfPoints: 90 })
        : null;
      if (toleranceCircle) {
        overlay.add(new Graphic({
          geometry: toleranceCircle,
          symbol: {
            type: 'simple-fill',
            color: rgba(toleranceColor, 0.16),
            outline: { color: rgba(toleranceColor, 1), width: 1.75, style: 'dash' },
          },
        }));
      }

      // GPS accuracy halo around the sample position.
      const accuracyCircle = gpsAccuracyM != null && gpsAccuracyM > 0
        ? new Circle({ center: sample, radius: gpsAccuracyM, radiusUnit: 'meters', geodesic: true, numberOfPoints: 60 })
        : null;
      if (accuracyCircle) {
        overlay.add(new Graphic({
          geometry: accuracyCircle,
          symbol: {
            type: 'simple-fill',
            color: rgba(brandPalette.deepWater300, 0.22),
            outline: { color: rgba(brandPalette.deepWater300, 0.95), width: 1 },
          },
        }));
      }

      // Line from the catalogued site to where the sample was actually taken.
      if (site) {
        overlay.add(new Graphic({
          geometry: new Polyline({ paths: [[[site.longitude as number, site.latitude as number], [sample.longitude as number, sample.latitude as number]]] }),
          symbol: { type: 'simple-line', color: rgba(brandPalette.limestone50, 0.95), width: 1.5, style: 'short-dot' },
        }));
      }

      overlay.add(new Graphic({
        geometry: sample,
        symbol: {
          type: 'simple-marker',
          style: 'circle',
          size: 11,
          color: rgba(brandPalette.deepWater, 1),
          outline: { color: rgba(brandPalette.limestone50, 1), width: 2 },
        },
      }));

      // The catalogued site is drawn last as an open diamond, so it stays visible when the sample sits on it.
      if (site) {
        for (const [color, width] of [[brandPalette.limestone50, 3.5], [brandPalette.hemlock, 1.75]] as const) {
          overlay.add(new Graphic({
            geometry: site,
            symbol: { type: 'simple-marker', style: 'diamond', size: 20, color: [0, 0, 0, 0], outline: { color: rgba(color, 1), width } },
          }));
        }
      }

      const map = new ArcgisMap({ basemap: basemaps.imagery, layers: [overlay] });
      const view = new MapView({
        container: host.current,
        map,
        center: sample,
        zoom: 17,
        constraints: { maxZoom: 20, minZoom: 5, rotationEnabled: false },
        popupEnabled: false,
        // Zoom buttons are React controls below, so no SDK widget assets are loaded.
        ui: { components: [] },
      });
      // Page scrolling must keep working over the map; zoom stays on the buttons, pinch and double-click.
      view.on('mouse-wheel', (event) => event.stopPropagation());

      destroy = () => view.destroy();
      setBasemapRef.current = (choice) => { map.basemap = basemaps[choice]; };
      zoomRef.current = (step) => { void view.goTo({ zoom: view.zoom + step }).catch(() => undefined); };

      await view.when();
      if (cancelled) return;

      // Frame everything drawn, with room around the largest circle.
      let frame: InstanceType<typeof Extent> | null = null;
      for (const geometry of [toleranceCircle, accuracyCircle]) {
        const extent = geometry?.extent;
        if (extent) frame = frame ? frame.union(extent) : extent.clone();
      }
      if (site) {
        const pair = new Extent({
          xmin: Math.min(site.longitude as number, sample.longitude as number),
          ymin: Math.min(site.latitude as number, sample.latitude as number),
          xmax: Math.max(site.longitude as number, sample.longitude as number),
          ymax: Math.max(site.latitude as number, sample.latitude as number),
          spatialReference: { wkid: 4326 },
        });
        frame = frame ? frame.union(pair) : pair;
      }
      if (frame && frame.width > 0) {
        await view.goTo(frame.expand(2.2), { animate: false }).catch(() => undefined);
      }
      if (!cancelled) setReady(true);
    })().catch(() => {
      if (!cancelled) setFailed(true);
    });

    return () => {
      cancelled = true;
      setBasemapRef.current = null;
      zoomRef.current = null;
      destroy?.();
    };
  }, [hasSample, hasSite, sampleLat, sampleLon, siteLat, siteLon, toleranceM, gpsAccuracyM, withinTolerance]);

  useEffect(() => {
    setBasemapRef.current?.(basemap);
  }, [basemap, ready]);

  if (!hasSample) return null;
  if (failed) return <LocationDiagram {...props} />;

  return (
    <figure className="location-figure location-map-figure">
      <div className="location-map-frame">
        <div
          ref={host}
          className="location-map"
          role="img"
          aria-label={`Map. ${describeLocation(distanceM, toleranceM, gpsAccuracyM)}`}
        />
        <div className="location-map-zoom" role="group" aria-label="Zoom">
          <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => zoomRef.current?.(1)}>+</button>
          <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => zoomRef.current?.(-1)}>−</button>
        </div>
        <div className="location-map-basemaps" role="group" aria-label="Basemap">
          {(['imagery', 'topo'] as const).map((choice) => (
            <button
              key={choice}
              type="button"
              aria-pressed={basemap === choice}
              className={basemap === choice ? 'active' : undefined}
              onClick={() => setBasemap(choice)}
            >
              {choice === 'imagery' ? 'Imagery' : 'Topographic'}
            </button>
          ))}
        </div>
      </div>
      <figcaption>
        <ul className="location-map-key">
          {hasSite ? (
            <li><span className="key-site" aria-hidden="true" />Catalogued site</li>
          ) : null}
          <li><span className="key-sample" aria-hidden="true" />Sample</li>
          {gpsAccuracyM != null && gpsAccuracyM > 0 ? (
            <li><span className="key-accuracy" aria-hidden="true" />GPS accuracy</li>
          ) : null}
          {hasSite && toleranceM != null && toleranceM > 0 ? (
            <li>
              <span className={withinTolerance ? 'key-tolerance ok' : 'key-tolerance warn'} aria-hidden="true" />
              Site tolerance
            </li>
          ) : null}
        </ul>
      </figcaption>
    </figure>
  );
}
