import { WaterQualityReading, Site, DashboardData, ParameterInfo } from '@/types';

// Fields to exclude (landowner information)
const EXCLUDED_FIELDS = [
  'landowner',
  'ownername',
  'owner_name',
  'property_owner',
  'landowner_name',
  'landowner_contact',
  'owner_contact',
];

// Check if field should be excluded
function shouldExcludeField(fieldName: string): boolean {
  const lowerField = fieldName.toLowerCase();
  return EXCLUDED_FIELDS.some(excluded => lowerField.includes(excluded));
}

// Fetch data from ArcGIS FeatureServer
export async function fetchArcGISData(featureServerUrl: string): Promise<DashboardData> {
  try {
    const queryUrl = `${featureServerUrl}/query?where=1=1&outFields=*&f=json`;
    const response = await fetch(queryUrl);
    const data = await response.json();
    
    if (!data.features) {
      throw new Error('Invalid ArcGIS response');
    }

    return parseArcGISFeatures(data.features);
  } catch (error) {
    console.error('Error fetching ArcGIS data:', error);
    throw error;
  }
}

// Parse ArcGIS features into our data model
function parseArcGISFeatures(features: any[]): DashboardData {
  const sitesMap = new Map<string, Site>();
  const readings: WaterQualityReading[] = [];
  const parametersMap = new Map<string, ParameterInfo>();

  features.forEach(feature => {
    const attrs = feature.attributes;
    
    // Filter out landowner fields
    const filteredAttrs: any = {};
    Object.keys(attrs).forEach(key => {
      if (!shouldExcludeField(key)) {
        filteredAttrs[key] = attrs[key];
      }
    });

    const siteId = filteredAttrs.SiteID || filteredAttrs.siteid || filteredAttrs.site_id;
    if (!siteId) return;

    // Extract site information
    const geometry = feature.geometry;
    if (geometry && !sitesMap.has(siteId)) {
      sitesMap.set(siteId, {
        SiteID: siteId,
        SiteName: filteredAttrs.SiteName || filteredAttrs.site_name || siteId,
        Latitude: geometry.y || geometry.latitude,
        Longitude: geometry.x || geometry.longitude,
        Description: filteredAttrs.Description || filteredAttrs.description,
      });
    }

    // Extract reading information
    const parameter = filteredAttrs.Parameter || filteredAttrs.parameter;
    const value = filteredAttrs.Value || filteredAttrs.value;
    const unit = filteredAttrs.Unit || filteredAttrs.unit || '';
    
    if (parameter && value !== null && value !== undefined) {
      readings.push({
        SiteID: siteId,
        SampleDate: filteredAttrs.SampleDate || filteredAttrs.sample_date || new Date().toISOString(),
        Parameter: parameter,
        Value: parseFloat(value),
        Unit: unit,
        TestType: filteredAttrs.TestType || filteredAttrs.test_type,
        DataCollectedBy: filteredAttrs.DataCollectedBy || filteredAttrs.data_collected_by || filteredAttrs.collector,
        Latitude: geometry?.y || geometry?.latitude,
        Longitude: geometry?.x || geometry?.longitude,
        ...filteredAttrs,
      });

      // Track parameters with units
      if (!parametersMap.has(parameter)) {
        parametersMap.set(parameter, {
          name: parameter,
          label: unit ? `${parameter} (${unit})` : parameter,
          unit: unit,
        });
      }
    }
  });

  return {
    sites: Array.from(sitesMap.values()),
    readings,
    parameters: Array.from(parametersMap.values()),
  };
}

// Parse CSV data
export async function parseCSVData(csvContent: string): Promise<DashboardData> {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV file is empty or invalid');
  }

  const headers = lines[0].split(',').map(h => h.trim());
  
  // Filter out landowner field indices
  const validIndices = headers
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => !shouldExcludeField(header));

  const sitesMap = new Map<string, Site>();
  const readings: WaterQualityReading[] = [];
  const parametersMap = new Map<string, ParameterInfo>();

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row: any = {};
    
    validIndices.forEach(({ header, index }) => {
      row[header] = values[index];
    });

    const siteId = row.SiteID || row.siteid || row.site_id;
    if (!siteId) continue;

    const lat = parseFloat(row.Latitude || row.latitude || row.lat || '0');
    const lon = parseFloat(row.Longitude || row.longitude || row.lon || row.long || '0');

    // Add site
    if (!sitesMap.has(siteId) && lat && lon) {
      sitesMap.set(siteId, {
        SiteID: siteId,
        SiteName: row.SiteName || row.site_name || siteId,
        Latitude: lat,
        Longitude: lon,
        Description: row.Description || row.description,
      });
    }

    // Add reading
    const parameter = row.Parameter || row.parameter;
    const value = row.Value || row.value;
    const unit = row.Unit || row.unit || '';
    
    if (parameter && value) {
      readings.push({
        SiteID: siteId,
        SampleDate: row.SampleDate || row.sample_date || new Date().toISOString(),
        Parameter: parameter,
        Value: parseFloat(value),
        Unit: unit,
        TestType: row.TestType || row.test_type,
        DataCollectedBy: row.DataCollectedBy || row.data_collected_by || row.collector,
        Latitude: lat,
        Longitude: lon,
        ...row,
      });

      // Track parameters
      if (!parametersMap.has(parameter)) {
        parametersMap.set(parameter, {
          name: parameter,
          label: unit ? `${parameter} (${unit})` : parameter,
          unit: unit,
        });
      }
    }
  }

  return {
    sites: Array.from(sitesMap.values()),
    readings,
    parameters: Array.from(parametersMap.values()),
  };
}

// Load sample data for demo purposes
export function getSampleData(): DashboardData {
  const sites: Site[] = [
    { SiteID: 'SITE-001', SiteName: 'Upstream Creek', Latitude: 40.7128, Longitude: -74.0060, Description: 'Primary monitoring site' },
    { SiteID: 'SITE-002', SiteName: 'Midstream Lake', Latitude: 40.7580, Longitude: -73.9855, Description: 'Lake monitoring point' },
    { SiteID: 'SITE-003', SiteName: 'Downstream River', Latitude: 40.6782, Longitude: -73.9442, Description: 'Final monitoring location' },
  ];

  const parameters: ParameterInfo[] = [
    { name: 'pH', label: 'pH (standard units)', unit: 'standard units' },
    { name: 'Temperature', label: 'Temperature (°C)', unit: '°C' },
    { name: 'Dissolved Oxygen', label: 'Dissolved Oxygen (mg/L)', unit: 'mg/L' },
    { name: 'Turbidity', label: 'Turbidity (NTU)', unit: 'NTU' },
    { name: 'Nitrate', label: 'Nitrate (mg/L)', unit: 'mg/L' },
  ];

  const readings: WaterQualityReading[] = [];
  const startDate = new Date('2024-01-01');
  
  // Generate sample readings
  sites.forEach(site => {
    parameters.forEach(param => {
      for (let day = 0; day < 90; day += 7) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + day);
        
        let baseValue = 7;
        let variance = 2;
        
        switch (param.name) {
          case 'pH':
            baseValue = 7.2;
            variance = 0.5;
            break;
          case 'Temperature':
            baseValue = 15 + (day / 10);
            variance = 3;
            break;
          case 'Dissolved Oxygen':
            baseValue = 8.5;
            variance = 1.5;
            break;
          case 'Turbidity':
            baseValue = 5;
            variance = 2;
            break;
          case 'Nitrate':
            baseValue = 2.5;
            variance = 1;
            break;
        }
        
        readings.push({
          SiteID: site.SiteID,
          SampleDate: date.toISOString(),
          Parameter: param.name,
          Value: baseValue + (Math.random() - 0.5) * variance * 2,
          Unit: param.unit,
          TestType: 'Field Test',
          DataCollectedBy: 'Research Team',
          Latitude: site.Latitude,
          Longitude: site.Longitude,
        });
      }
    });
  });

  return { sites, readings, parameters };
}
