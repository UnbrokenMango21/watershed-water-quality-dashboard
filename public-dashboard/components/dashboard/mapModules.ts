import { registerArcgisComponents } from "./registerArcgisComponents";

let pending: ReturnType<typeof importMapModules> | null = null;

function importMapModules() {
  return Promise.all([
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
    import("@arcgis/core/geometry/Polygon.js"),
    registerArcgisComponents(),
  ]);
}

/** Loads the map SDK modules once per page; later callers share the same promise. A failed load is not cached. */
export function loadMapModules() {
  pending ??= importMapModules().catch((error: unknown) => {
    pending = null;
    throw error;
  });
  return pending;
}

/**
 * Starts loading the map code when a visitor shows intent to open the dashboard (hover, focus or touch
 * on a dashboard link), so the map is closer to ready when they arrive. Skipped when Save-Data is on.
 */
export function preloadMapModules() {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return;
  void loadMapModules().catch(() => undefined);
}
