/** Public ArcGIS view URLs from config/arcgis_resources.json. No credentials. */
export const productionArcgisViews = {
  sites: "https://services9.arcgis.com/6EuFgO4fLTqfNOhu/arcgis/rest/services/Central_PA_Watershed_Public_Sites/FeatureServer/0",
  observations: "https://services9.arcgis.com/6EuFgO4fLTqfNOhu/arcgis/rest/services/Central_PA_Watershed_Public_Observations/FeatureServer/0",
  measurements: "https://services9.arcgis.com/6EuFgO4fLTqfNOhu/arcgis/rest/services/Central_PA_Watershed_Public_Measurements/FeatureServer/0",
  latest: "https://services9.arcgis.com/6EuFgO4fLTqfNOhu/arcgis/rest/services/Central_PA_Watershed_Public_Latest/FeatureServer/0",
} as const;
