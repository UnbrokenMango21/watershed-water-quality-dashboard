"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardSite, LatestSiteCondition } from "@/lib/data/DashboardDataSource";
import { completenessFor, completenessLabel } from "./dashboard-utils";
import { registerArcgisComponents } from "./registerArcgisComponents";
import { siteMarkerAttributes } from "./siteMarkers";

// Public, keyless Esri context layers. Order of emphasis, bottom to top: a quiet background, streams,
// restrained place names, watershed outlines only where they help, then the monitoring sites.
const BACKGROUND_URLS = {
  terrain: "https://services.arcgisonline.com/arcgis/rest/services/World_Terrain_Base/MapServer",
  topographic: "https://services.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer",
  imagery: "https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer",
} as const;
const STREAMS_URL = "https://tiles.arcgis.com/tiles/P3ePLMYs2RVChkJx/arcgis/rest/services/Esri_Hydro_Reference_Overlay/MapServer";
const PLACES_URL = "https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Reference_Overlay/MapServer";
const STATES_URL = "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_States_Generalized_Boundaries/FeatureServer/0";
const REGIONAL_WATERSHED_URL = "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/Watershed_Boundary_Dataset_HUC_8s/FeatureServer/0";
const WATERSHED_LAYER_URL = process.env.NEXT_PUBLIC_ARCGIS_WATERSHEDS_VIEW_URL
  || "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/Watershed_Boundary_Dataset_HUC_12s/FeatureServer/0";

// Statewide the map shows no watershed lines at all; larger (HUC8) watersheds appear at regional zoom and
// hand over to local (HUC12) watersheds close in, so the two outline sets never draw together.
const REGIONAL_WATERSHED_MIN_SCALE = 2_600_000;
const LOCAL_WATERSHED_MIN_SCALE = 420_000;
const SITE_LABEL_MIN_SCALE = 650_000;
// Local watershed names only once the view is close enough that they do not crowd stream and place labels.
const WATERSHED_LABEL_MIN_SCALE = 150_000;

export type MapBackground = keyof typeof BACKGROUND_URLS;
export type MapLayerKey = "sites" | "streams" | "watersheds" | "places";
export type MapLayerState = Record<MapLayerKey, boolean> & { streamsOpacity: number; background: MapBackground };
export const initialMapLayerState: MapLayerState = {
  sites: true,
  streams: true,
  watersheds: true,
  places: true,
  streamsOpacity: 0.85,
  background: "terrain",
};
export type HoverPoint = { siteId: string; x: number; y: number } | null;

// Brand colours as ArcGIS RGBA (Deep Water, Hemlock, Limestone, Night).
const WATER = [22, 122, 139] as const;
const HEMLOCK = [13, 92, 75] as const;
const LIMESTONE = [246, 243, 236] as const;
const NIGHT = [15, 26, 23] as const;
const rgba = (rgb: readonly [number, number, number], a = 1) => [rgb[0], rgb[1], rgb[2], a];

type Layer = { visible: boolean; opacity: number };
type ArcgisMapElement = HTMLElement & {
  map?: { add: (layer: unknown) => void };
  zoom?: number;
  ready?: boolean;
  stationary?: boolean;
  updating?: boolean;
  goTo: (target: unknown, options?: unknown) => Promise<unknown>;
  hitTest: (target: unknown, options?: unknown) => Promise<{ results: Array<Record<string, unknown>> }>;
};

export function useDashboardMap({
  sites,
  conditions,
  selectedSite,
  hoveredSite,
  layerState,
  onSelectSite,
  onHoverSite,
}: {
  sites: DashboardSite[];
  conditions: Record<string, LatestSiteCondition | null>;
  selectedSite: DashboardSite | null;
  hoveredSite: DashboardSite | null;
  layerState: MapLayerState;
  onSelectSite: (siteId: string) => void;
  onHoverSite: (siteId: string | null) => void;
}) {
  const mapHost = useRef<HTMLDivElement>(null);
  const mapElementRef = useRef<ArcgisMapElement | null>(null);
  const selectionUpdaterRef = useRef<((site: DashboardSite | null) => void) | null>(null);
  const hoverUpdaterRef = useRef<((site: DashboardSite | null) => void) | null>(null);
  const watershedSelectionUpdaterRef = useRef<((site: DashboardSite | null) => void) | null>(null);
  const waitForStableRef = useRef<(() => Promise<void>) | null>(null);
  const layersRef = useRef<{ background: Record<MapBackground, Layer>; streams: Layer; places: Layer; watersheds: Layer[]; sites: Layer | null } | null>(null);
  const layerStateRef = useRef(layerState);
  const selectedSiteRef = useRef<DashboardSite | null>(selectedSite);
  const [hoverPoint, setHoverPoint] = useState<HoverPoint>(null);

  useEffect(() => { selectedSiteRef.current = selectedSite; }, [selectedSite]);

  useEffect(() => {
    let cancelled = false;
    const host = mapHost.current;
    if (!host) return;

    async function initializeMap() {
      const [graphicsModule, featureLayerModule, graphicsLayerModule, pointModule, markerSymbolModule, fillSymbolModule, rendererModule, uniqueValueModule, reactiveUtils, basemapModule, tileLayerModule, labelClassModule] = await Promise.all([
        import("@arcgis/core/Graphic.js"),
        import("@arcgis/core/layers/FeatureLayer.js"),
        import("@arcgis/core/layers/GraphicsLayer.js"),
        import("@arcgis/core/geometry/Point.js"),
        import("@arcgis/core/symbols/SimpleMarkerSymbol.js"),
        import("@arcgis/core/symbols/SimpleFillSymbol.js"),
        import("@arcgis/core/renderers/SimpleRenderer.js"),
        import("@arcgis/core/renderers/UniqueValueRenderer.js"),
        import("@arcgis/core/core/reactiveUtils.js"),
        import("@arcgis/core/Basemap.js"),
        import("@arcgis/core/layers/TileLayer.js"),
        import("@arcgis/core/layers/support/LabelClass.js"),
        registerArcgisComponents(),
      ]);
      if (cancelled || !mapHost.current) return;

      const Graphic = graphicsModule.default;
      const FeatureLayer = featureLayerModule.default;
      const GraphicsLayer = graphicsLayerModule.default;
      const Point = pointModule.default;
      const SimpleMarkerSymbol = markerSymbolModule.default;
      const SimpleFillSymbol = fillSymbolModule.default;
      const SimpleRenderer = rendererModule.default;
      const UniqueValueRenderer = uniqueValueModule.default;
      const TileLayer = tileLayerModule.default;
      const LabelClass = labelClassModule.default;
      const state = layerStateRef.current;

      const map = document.createElement("arcgis-map") as unknown as ArcgisMapElement;
      map.id = "watershed-map";
      const background = {
        terrain: new TileLayer({ url: BACKGROUND_URLS.terrain, visible: state.background === "terrain" }),
        topographic: new TileLayer({ url: BACKGROUND_URLS.topographic, visible: state.background === "topographic" }),
        imagery: new TileLayer({ url: BACKGROUND_URLS.imagery, visible: state.background === "imagery" }),
      };
      const streams = new TileLayer({ url: STREAMS_URL, opacity: state.streamsOpacity, visible: state.streams });
      // Topographic already carries its own labels, so the place-name overlay only draws on the other backgrounds.
      const places = new TileLayer({ url: PLACES_URL, opacity: 0.5, visible: state.places && state.background !== "topographic" });
      (map as unknown as { basemap: unknown }).basemap = new basemapModule.default({
        id: "pww-context",
        title: "Background",
        baseLayers: [background.terrain, background.topographic, background.imagery],
        referenceLayers: [streams, places],
      });
      map.setAttribute("center", "-77.85,40.9");
      map.setAttribute("zoom", "7");
      map.setAttribute("popup-disabled", "");
      map.setAttribute("attribution-mode", "light");
      map.className = "map-element";
      map.dataset.viewReady = "false";
      map.dataset.viewStable = "false";
      map.dataset.watershedLayerReady = "false";
      map.setAttribute("aria-label", "Central Pennsylvania watershed monitoring map");

      const component = (tag: string, slot: string, attrs: Record<string, string> = {}) => {
        const element = document.createElement(tag);
        element.setAttribute("slot", slot);
        Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
        return element;
      };

      map.append(
        component("arcgis-zoom", "top-left"),
        component("arcgis-home", "top-left", { label: "Reset map extent" }),
        component("arcgis-locate", "top-left", { label: "Locate me" }),
        component("arcgis-fullscreen", "top-left", { label: "Fullscreen map" }),
        component("arcgis-search", "top-right"),
        component("arcgis-scale-bar", "bottom-left", { unit: "dual" }),
      );

      const syncStableState = () => {
        const ready = Boolean(map.ready);
        map.dataset.viewReady = ready ? "true" : "false";
        map.dataset.viewStable = ready && Boolean(map.stationary) && !map.updating ? "true" : "false";
      };

      const waitForStableView = async () => {
        map.dataset.viewStable = "false";
        await reactiveUtils.whenOnce(() => Boolean(map.ready && map.stationary && !map.updating));
        if (!cancelled) syncStableState();
      };
      waitForStableRef.current = waitForStableView;

      const onReady = () => {
        syncStableState();
        void waitForStableView();
        if (!map.map) return;

        // Neighbouring states are softly veiled so Pennsylvania reads first; no outline noise.
        const neighbours = new FeatureLayer({
          url: STATES_URL,
          title: "Neighbouring states",
          definitionExpression: "STATE_ABBR <> 'PA'",
          outFields: ["STATE_ABBR"],
          popupEnabled: false,
          listMode: "hide",
          renderer: new SimpleRenderer({
            symbol: new SimpleFillSymbol({ style: "solid", color: rgba(LIMESTONE, 0.42), outline: { color: [0, 0, 0, 0], width: 0 } }),
          }),
        });

        const watershedLabel = (field: string, size: number) => new LabelClass({
          labelExpressionInfo: { expression: `Proper($feature.${field})` },
          minScale: WATERSHED_LABEL_MIN_SCALE,
          labelPlacement: "always-horizontal",
          symbol: {
            type: "text",
            color: rgba(WATER, 0.78),
            haloColor: rgba(LIMESTONE, 0.9),
            haloSize: 1.25,
            font: { family: "Arial", size, style: "italic" },
          },
        });

        // Public USGS/Esri Watershed Boundary Dataset reference geography, independent of monitoring data.
        const regionalWatersheds = new FeatureLayer({
          url: REGIONAL_WATERSHED_URL,
          title: "Larger watersheds",
          definitionExpression: "states LIKE '%PA%'",
          outFields: ["huc8", "name"],
          popupEnabled: false,
          minScale: REGIONAL_WATERSHED_MIN_SCALE,
          maxScale: LOCAL_WATERSHED_MIN_SCALE,
          // Unlabelled: at regional zoom the streams and towns already carry the names.
          renderer: new SimpleRenderer({
            symbol: new SimpleFillSymbol({ style: "none", outline: { color: rgba(WATER, 0.55), width: 1.2 } }),
          }),
        });
        const watershedLayer = new FeatureLayer({
          url: WATERSHED_LAYER_URL,
          title: "Watersheds (USGS HUC12)",
          definitionExpression: "states LIKE '%PA%'",
          outFields: ["huc12", "name", "states"],
          popupEnabled: false,
          minScale: LOCAL_WATERSHED_MIN_SCALE,
          maxScale: 0,
          labelingInfo: [watershedLabel("name", 8.5)],
          renderer: new SimpleRenderer({
            // Thin and muted: context for the sites, never competing with them.
            symbol: new SimpleFillSymbol({ style: "none", outline: { color: rgba(WATER, 0.34), width: 0.7 } }),
          }),
        });
        regionalWatersheds.visible = state.watersheds;
        watershedLayer.visible = state.watersheds;
        const watershedSelectionLayer = new GraphicsLayer({ title: "Selected watershed", listMode: "hide" });
        map.map.add(neighbours);
        map.map.add(regionalWatersheds);
        map.map.add(watershedLayer);
        map.map.add(watershedSelectionLayer);
        layersRef.current = { background, streams, places, watersheds: [regionalWatersheds, watershedLayer], sites: null };

        watershedSelectionUpdaterRef.current = (site) => {
          watershedSelectionLayer.removeAll();
          if (!site) return;
          const point = new Point({ longitude: site.longitude, latitude: site.latitude });
          void watershedLayer.queryFeatures({
            geometry: point,
            spatialRelationship: "intersects",
            returnGeometry: true,
            outFields: ["huc12", "name"],
          }).then((result) => {
            if (cancelled || selectedSiteRef.current?.id !== site.id) return;
            const watershed = result.features[0];
            if (!watershed?.geometry) return;
            watershedSelectionLayer.add(new Graphic({
              geometry: watershed.geometry,
              attributes: watershed.attributes,
              symbol: new SimpleFillSymbol({
                style: "solid",
                // Hemlock marks the selected site's local watershed.
                color: rgba(HEMLOCK, 0.13),
                outline: { color: rgba(HEMLOCK, 0.9), width: 2.25 },
              }),
            }));
          }).catch(() => undefined);
        };
        watershedSelectionUpdaterRef.current(selectedSiteRef.current);

        void watershedLayer.load().then(async () => {
          if (cancelled) return;
          map.dataset.watershedLayerReady = "true";
          await waitForStableView();
        }).catch(() => {
          if (!cancelled) map.dataset.watershedLayerReady = "error";
        });

        // Plots whatever sites the active source returned, in production and demo alike.
        if (sites.length === 0) return;

        const markers = siteMarkerAttributes(sites, (siteId) => completenessLabel(completenessFor(conditions[siteId])));
        const siteGraphics = markers.map((attributes, index) => new Graphic({
          geometry: new Point({ longitude: sites[index].longitude, latitude: sites[index].latitude }),
          attributes,
        }));
        const siteLayer = new FeatureLayer({
          title: "Monitoring sites",
          source: siteGraphics,
          objectIdField: "ObjectID",
          geometryType: "point",
          spatialReference: { wkid: 4326 },
          fields: [
            { name: "ObjectID", alias: "ObjectID", type: "oid" },
            { name: "siteId", alias: "Site ID", type: "string" },
            { name: "name", alias: "Site", type: "string" },
            { name: "code", alias: "Code", type: "string" },
            { name: "status", alias: "Sample status", type: "string" },
          ],
          // Without outFields a hit test returns only the object ID, and hover or click could not resolve the site.
          outFields: ["*"],
          popupEnabled: false,
          visible: state.sites,
          effect: `drop-shadow(0px, 1px, 2px, rgba(${NIGHT.join(",")}, 0.35))`,
          // Deep Water with a Limestone halo, matching the iOS site map. A site without a reviewed sample
          // is drawn open, so a visitor can tell "no data yet" from "has data" at a glance.
          renderer: new UniqueValueRenderer({
            field: "status",
            defaultSymbol: new SimpleMarkerSymbol({ style: "circle", color: rgba(WATER, 0.95), size: 11, outline: { color: rgba(LIMESTONE), width: 1.75 } }),
            uniqueValueInfos: [
              { value: "No sample", label: "No reviewed sample yet", symbol: new SimpleMarkerSymbol({ style: "circle", color: rgba(LIMESTONE, 0.95), size: 10, outline: { color: rgba(WATER), width: 2 } }) },
            ],
          }),
          labelingInfo: [new LabelClass({
            labelExpressionInfo: { expression: "$feature.name" },
            labelPlacement: "above-center",
            minScale: SITE_LABEL_MIN_SCALE,
            symbol: { type: "text", color: rgba(NIGHT, 0.9), haloColor: rgba(LIMESTONE), haloSize: 1.5, font: { family: "Arial", size: 9.5, weight: "bold" } },
          })],
        });
        const hoverLayer = new GraphicsLayer({ title: "Hover", listMode: "hide" });
        const selectionLayer = new GraphicsLayer({ title: "Selection", listMode: "hide" });
        map.map.add(siteLayer);
        map.map.add(hoverLayer);
        map.map.add(selectionLayer);
        layersRef.current.sites = siteLayer;

        const updateRing = (layer: InstanceType<typeof GraphicsLayer>, site: DashboardSite | null, selected: boolean) => {
          layer.removeAll();
          if (!site) return;
          const point = new Point({ longitude: site.longitude, latitude: site.latitude });
          if (selected) {
            // A soft halo under a firm Hemlock ring; the site marker stays visible in the middle.
            layer.add(new Graphic({ geometry: point, symbol: new SimpleMarkerSymbol({ style: "circle", color: rgba(HEMLOCK, 0.16), size: 30, outline: { color: [0, 0, 0, 0], width: 0 } }) }));
            layer.add(new Graphic({ geometry: point, symbol: new SimpleMarkerSymbol({ style: "circle", color: [0, 0, 0, 0], size: 20, outline: { color: rgba(HEMLOCK), width: 2.75 } }) }));
          } else {
            layer.add(new Graphic({ geometry: point, symbol: new SimpleMarkerSymbol({ style: "circle", color: [0, 0, 0, 0], size: 18, outline: { color: rgba(WATER, 0.85), width: 2 } }) }));
          }
        };
        selectionUpdaterRef.current = (site) => updateRing(selectionLayer, site, true);
        hoverUpdaterRef.current = (site) => updateRing(hoverLayer, site, false);
        selectionUpdaterRef.current(selectedSiteRef.current);

        let pointerHitInFlight = false;
        map.addEventListener("arcgisViewPointerMove", (event) => {
          if (pointerHitInFlight) return;
          pointerHitInFlight = true;
          const detail = (event as CustomEvent).detail as { x: number; y: number };
          requestAnimationFrame(() => {
            void map.hitTest(detail, { include: siteLayer }).then((response) => {
              const hit = response.results.find((result) => {
                const graphic = result.graphic as { attributes?: Record<string, unknown> } | undefined;
                return result.type === "graphic" && typeof graphic?.attributes?.siteId === "string";
              });
              const graphic = hit?.graphic as { attributes?: Record<string, unknown> } | undefined;
              const siteId = graphic?.attributes?.siteId;
              const id = typeof siteId === "string" ? siteId : null;
              onHoverSite(id);
              setHoverPoint(id ? { siteId: id, x: detail.x, y: detail.y } : null);
              map.style.cursor = id ? "pointer" : "";
            }).catch(() => { onHoverSite(null); setHoverPoint(null); }).finally(() => { pointerHitInFlight = false; });
          });
        });
        map.addEventListener("arcgisViewPointerLeave", () => { onHoverSite(null); setHoverPoint(null); });
        void siteLayer.load().then(async () => {
          await map.goTo(siteLayer.fullExtent?.clone().expand(1.25), { duration: 0 });
          await waitForStableView();
        }).catch(() => undefined);
      };

      map.addEventListener("arcgisViewReadyChange", onReady, { once: true });
      map.addEventListener("arcgisViewChange", syncStableState);
      map.addEventListener("arcgisViewClick", async (event) => {
        if (sites.length === 0) return;
        try {
          const response = await map.hitTest((event as CustomEvent).detail);
          const hit = response.results.find((result) => {
            const graphic = result.graphic as { attributes?: Record<string, unknown> } | undefined;
            return result.type === "graphic" && typeof graphic?.attributes?.siteId === "string";
          });
          const graphic = hit?.graphic as { attributes?: Record<string, unknown> } | undefined;
          const siteId = graphic?.attributes?.siteId;
          if (typeof siteId === "string") onSelectSite(siteId);
        } catch {
          // Basemap/watershed clicks with no monitoring feature are intentionally a no-op.
        }
      });

      mapHost.current.replaceChildren(map);
      mapElementRef.current = map;
    }

    void initializeMap();
    return () => {
      cancelled = true;
      selectionUpdaterRef.current = null;
      hoverUpdaterRef.current = null;
      watershedSelectionUpdaterRef.current = null;
      waitForStableRef.current = null;
      mapElementRef.current = null;
      layersRef.current = null;
      setHoverPoint(null);
      host.replaceChildren();
    };
  }, [conditions, onHoverSite, onSelectSite, sites]);

  // Layer panel changes apply to the live layers without rebuilding the map.
  useEffect(() => {
    layerStateRef.current = layerState;
    const layers = layersRef.current;
    if (!layers) return;
    (Object.keys(layers.background) as MapBackground[]).forEach((key) => { layers.background[key].visible = key === layerState.background; });
    layers.streams.visible = layerState.streams;
    layers.streams.opacity = layerState.streamsOpacity;
    layers.places.visible = layerState.places && layerState.background !== "topographic";
    layers.watersheds.forEach((layer) => { layer.visible = layerState.watersheds; });
    if (layers.sites) layers.sites.visible = layerState.sites;
    if (!layerState.sites) setHoverPoint(null);
  }, [layerState]);

  useEffect(() => {
    selectionUpdaterRef.current?.(selectedSite);
    watershedSelectionUpdaterRef.current?.(selectedSite);
    // The view is about to re-centre, so a hover card at the old pointer position would be stale.
    setHoverPoint(null);
    if (!selectedSite || !mapElementRef.current) return;
    const map = mapElementRef.current;
    const currentZoom = map.zoom ?? 8;
    const targetZoom = Math.min(Math.max(currentZoom, 9), 11);
    map.dataset.viewStable = "false";
    void map.goTo({ center: [selectedSite.longitude, selectedSite.latitude], zoom: targetZoom }, { duration: 300 })
      .then(() => waitForStableRef.current?.())
      .catch(() => undefined);
  }, [selectedSite]);

  useEffect(() => { hoverUpdaterRef.current?.(hoveredSite); }, [hoveredSite]);
  return { mapHost, hoverPoint };
}
