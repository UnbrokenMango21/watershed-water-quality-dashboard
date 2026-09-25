export async function registerArcgisComponents() {
  await Promise.all([
    import("@arcgis/map-components/components/arcgis-basemap-gallery"),
    import("@arcgis/map-components/components/arcgis-distance-measurement-2d"),
    import("@arcgis/map-components/components/arcgis-fullscreen"),
    import("@arcgis/map-components/components/arcgis-home"),
    import("@arcgis/map-components/components/arcgis-layer-list"),
    import("@arcgis/map-components/components/arcgis-legend"),
    import("@arcgis/map-components/components/arcgis-locate"),
    import("@arcgis/map-components/components/arcgis-map"),
    import("@arcgis/map-components/components/arcgis-scale-bar"),
    import("@arcgis/map-components/components/arcgis-search"),
    import("@arcgis/map-components/components/arcgis-zoom"),
    import("@esri/calcite-components/components/calcite-icon"),
  ]);
}
