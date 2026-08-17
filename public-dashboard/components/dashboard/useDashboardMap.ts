"use client";

import { useEffect, useRef } from "react";
import type { DashboardSite, LatestSiteCondition } from "@/lib/data/DashboardDataSource";
import { completenessFor, completenessLabel } from "./dashboard-utils";
import { registerArcgisComponents } from "./registerArcgisComponents";

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
  demoMode,
}: {
  sites: DashboardSite[];
  conditions: Record<string, LatestSiteCondition | null>;
  selectedSite: DashboardSite | null;
  hoveredSite: DashboardSite | null;
  onSelectSite: (siteId: string) => void;
  onHoverSite: (siteId: string | null) => void;
  demoMode: boolean;
}) {
  const mapHost = useRef<HTMLDivElement>(null);
  const mapElementRef = useRef<ArcgisMapElement | null>(null);
  const selectionUpdaterRef = useRef<((site: DashboardSite | null) => void) | null>(null);
  const hoverUpdaterRef = useRef<((site: DashboardSite | null) => void) | null>(null);
  const waitForStableRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    let cancelled = false;
    const host = mapHost.current;
    if (!host) return;

    async function initializeMap() {
      const [graphicsModule, featureLayerModule, graphicsLayerModule, pointModule, symbolModule, rendererModule, reactiveUtils] = await Promise.all([
        import("@arcgis/core/Graphic.js"),
        import("@arcgis/core/layers/FeatureLayer.js"),
        import("@arcgis/core/layers/GraphicsLayer.js"),
        import("@arcgis/core/geometry/Point.js"),
        import("@arcgis/core/symbols/SimpleMarkerSymbol.js"),
        import("@arcgis/core/renderers/SimpleRenderer.js"),
        import("@arcgis/core/core/reactiveUtils.js"),
        registerArcgisComponents(),
      ]);
      if (cancelled || !mapHost.current) return;

      const Graphic = graphicsModule.default;
      const FeatureLayer = featureLayerModule.default;
      const GraphicsLayer = graphicsLayerModule.default;
      const Point = pointModule.default;
      const SimpleMarkerSymbol = symbolModule.default;
      const SimpleRenderer = rendererModule.default;
      const map = document.createElement("arcgis-map") as unknown as ArcgisMapElement;
      map.id = "watershed-map";
      map.setAttribute("basemap", "topo-vector");
      map.setAttribute("center", "-77.85,40.9");
      map.setAttribute("zoom", "7");
      map.setAttribute("popup-disabled", "");
      map.setAttribute("attribution-mode", "light");
      map.className = "map-element";
      map.dataset.viewReady = "false";
      map.dataset.viewStable = "false";
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
        if (!demoMode || sites.length === 0 || !map.map) return;

        const siteGraphics = sites.map((site, index) => new Graphic({
          geometry: new Point({ longitude: site.longitude, latitude: site.latitude }),
          attributes: {
            ObjectID: index + 1,
            siteId: site.id,
            name: site.name,
            code: site.code,
            status: completenessLabel(completenessFor(conditions[site.id])),
          },
        }));
        const markerSymbol = new SimpleMarkerSymbol({
          style: "circle",
          color: [10, 103, 190, 0.92],
          size: 9,
          outline: { color: [255, 255, 255, 1], width: 1.4 },
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
              color: selected ? [255, 255, 255, 0.18] : [255, 255, 255, 0.08],
              size: selected ? 21 : 16,
              outline: { color: selected ? [0, 90, 156, 1] : [0, 122, 194, 0.82], width: selected ? 3 : 2 },
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
        if (!demoMode) return;
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
          // Basemap clicks with no monitoring feature are intentionally a no-op.
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
      waitForStableRef.current = null;
      mapElementRef.current = null;
      host.replaceChildren();
    };
  }, [conditions, demoMode, onHoverSite, onSelectSite, sites]);

  useEffect(() => {
    selectionUpdaterRef.current?.(selectedSite);
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
