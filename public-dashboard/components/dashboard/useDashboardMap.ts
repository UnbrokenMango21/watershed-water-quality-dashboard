"use client";

import { useEffect, useRef } from "react";
import type { DashboardSite, LatestSiteCondition } from "@/lib/data/DashboardDataSource";
import { completenessFor, completenessLabel } from "./dashboard-utils";
import { registerArcgisComponents } from "./registerArcgisComponents";
import { siteMarkerAttributes } from "./siteMarkers";

// Quiet public Esri context: terrain background, hydrography that appears as you zoom in, muted labels.
const TERRAIN_BASE_URL = "https://services.arcgisonline.com/arcgis/rest/services/World_Terrain_Base/MapServer";
const HYDRO_REFERENCE_URL = "https://tiles.arcgis.com/tiles/P3ePLMYs2RVChkJx/arcgis/rest/services/Esri_Hydro_Reference_Overlay/MapServer";
const PLACE_REFERENCE_URL = "https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Reference_Overlay/MapServer";
// HUC12 outlines only once the view is regional (about zoom 9 and closer); statewide they read as noise.
const WATERSHED_MIN_SCALE = 1_200_000;

const WATERSHED_LAYER_URL = process.env.NEXT_PUBLIC_ARCGIS_WATERSHEDS_VIEW_URL
  || "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/Watershed_Boundary_Dataset_HUC_12s/FeatureServer/0";

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
  onSelectSite,
  onHoverSite,
}: {
  sites: DashboardSite[];
  conditions: Record<string, LatestSiteCondition | null>;
  selectedSite: DashboardSite | null;
  hoveredSite: DashboardSite | null;
  onSelectSite: (siteId: string) => void;
  onHoverSite: (siteId: string | null) => void;
}) {
  const mapHost = useRef<HTMLDivElement>(null);
  const mapElementRef = useRef<ArcgisMapElement | null>(null);
  const selectionUpdaterRef = useRef<((site: DashboardSite | null) => void) | null>(null);
  const hoverUpdaterRef = useRef<((site: DashboardSite | null) => void) | null>(null);
  const watershedSelectionUpdaterRef = useRef<((site: DashboardSite | null) => void) | null>(null);
  const waitForStableRef = useRef<(() => Promise<void>) | null>(null);
  const selectedSiteRef = useRef<DashboardSite | null>(selectedSite);

  useEffect(() => { selectedSiteRef.current = selectedSite; }, [selectedSite]);

  useEffect(() => {
    let cancelled = false;
    const host = mapHost.current;
    if (!host) return;

    async function initializeMap() {
      const [graphicsModule, featureLayerModule, graphicsLayerModule, pointModule, markerSymbolModule, fillSymbolModule, rendererModule, reactiveUtils, basemapModule, tileLayerModule] = await Promise.all([
        import("@arcgis/core/Graphic.js"),
        import("@arcgis/core/layers/FeatureLayer.js"),
        import("@arcgis/core/layers/GraphicsLayer.js"),
        import("@arcgis/core/geometry/Point.js"),
        import("@arcgis/core/symbols/SimpleMarkerSymbol.js"),
        import("@arcgis/core/symbols/SimpleFillSymbol.js"),
        import("@arcgis/core/renderers/SimpleRenderer.js"),
        import("@arcgis/core/core/reactiveUtils.js"),
        import("@arcgis/core/Basemap.js"),
        import("@arcgis/core/layers/TileLayer.js"),
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
      const map = document.createElement("arcgis-map") as unknown as ArcgisMapElement;
      map.id = "watershed-map";
      const TileLayer = tileLayerModule.default;
      (map as unknown as { basemap: unknown }).basemap = new basemapModule.default({
        id: "pww-terrain",
        title: "Terrain and streams",
        baseLayers: [new TileLayer({ url: TERRAIN_BASE_URL })],
        referenceLayers: [
          new TileLayer({ url: HYDRO_REFERENCE_URL, opacity: 0.85 }),
          new TileLayer({ url: PLACE_REFERENCE_URL, opacity: 0.5 }),
        ],
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

        // Public USGS/Esri Watershed Boundary Dataset reference geography.
        // This is real geographic context and is intentionally independent of
        // whether production monitoring observations are connected.
        const watershedLayer = new FeatureLayer({
          url: WATERSHED_LAYER_URL,
          title: "Watersheds (USGS HUC12)",
          definitionExpression: "states LIKE '%PA%'",
          outFields: ["huc12", "name", "states"],
          popupEnabled: false,
          minScale: WATERSHED_MIN_SCALE,
          maxScale: 0,
          renderer: new SimpleRenderer({
            symbol: new SimpleFillSymbol({
              // Outline only, thin and muted: context for the sites, never competing with them.
              style: "none",
              outline: { color: [22, 122, 139, 0.32], width: 0.6 },
            }),
          }),
        });
        const watershedSelectionLayer = new GraphicsLayer({ title: "Selected watershed", listMode: "hide" });
        map.map.add(watershedLayer);
        map.map.add(watershedSelectionLayer);

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
                // Hemlock (brand #0D5C4B) marks the selected site's watershed.
                color: [13, 92, 75, 0.16],
                outline: { color: [13, 92, 75, 0.95], width: 2.35 },
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
        const markerSymbol = new SimpleMarkerSymbol({
          style: "circle",
          // Sites in Deep Water with a Limestone halo, matching the iOS site map.
          color: [22, 122, 139, 0.95],
          size: 10,
          outline: { color: [246, 243, 236, 1], width: 1.6 },
        });
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
          popupEnabled: false,
          renderer: new SimpleRenderer({ symbol: markerSymbol }),
        });
        const hoverLayer = new GraphicsLayer({ title: "Hover", listMode: "hide" });
        const selectionLayer = new GraphicsLayer({ title: "Selection", listMode: "hide" });
        map.map.add(siteLayer);
        map.map.add(hoverLayer);
        map.map.add(selectionLayer);

        const updateRing = (layer: InstanceType<typeof GraphicsLayer>, site: DashboardSite | null, selected: boolean) => {
          layer.removeAll();
          if (!site) return;
          layer.add(new Graphic({
            geometry: new Point({ longitude: site.longitude, latitude: site.latitude }),
            symbol: new SimpleMarkerSymbol({
              style: "circle",
              color: selected ? [246, 243, 236, 0.22] : [246, 243, 236, 0.1],
              size: selected ? 22 : 17,
              outline: { color: selected ? [13, 92, 75, 1] : [22, 122, 139, 0.85], width: selected ? 3 : 2 },
            }),
          }));
        };
        selectionUpdaterRef.current = (site) => updateRing(selectionLayer, site, true);
        hoverUpdaterRef.current = (site) => updateRing(hoverLayer, site, false);

        let pointerHitInFlight = false;
        map.addEventListener("arcgisViewPointerMove", (event) => {
          if (pointerHitInFlight) return;
          pointerHitInFlight = true;
          requestAnimationFrame(() => {
            void map.hitTest((event as CustomEvent).detail, { include: siteLayer }).then((response) => {
              const hit = response.results.find((result) => {
                const graphic = result.graphic as { attributes?: Record<string, unknown> } | undefined;
                return result.type === "graphic" && typeof graphic?.attributes?.siteId === "string";
              });
              const graphic = hit?.graphic as { attributes?: Record<string, unknown> } | undefined;
              const siteId = graphic?.attributes?.siteId;
              onHoverSite(typeof siteId === "string" ? siteId : null);
            }).catch(() => onHoverSite(null)).finally(() => { pointerHitInFlight = false; });
          });
        });
        map.addEventListener("arcgisViewPointerLeave", () => onHoverSite(null));
        void siteLayer.load().then(async () => {
          await map.goTo(siteLayer.fullExtent, { duration: 0 });
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
      host.replaceChildren();
    };
  }, [conditions, onHoverSite, onSelectSite, sites]);

  useEffect(() => {
    selectionUpdaterRef.current?.(selectedSite);
    watershedSelectionUpdaterRef.current?.(selectedSite);
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
  return mapHost;
}
