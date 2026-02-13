// Water quality data types

export interface WaterQualityReading {
  SiteID: string;
  SampleDate: string;
  Parameter: string;
  Value: number;
  Unit: string;
  TestType?: string;
  DataCollectedBy?: string;
  Latitude?: number;
  Longitude?: number;
  // Additional fields (landowner fields will be excluded during ingestion)
  [key: string]: any;
}

export interface Site {
  SiteID: string;
  SiteName?: string;
  Latitude: number;
  Longitude: number;
  Description?: string;
}

export interface ParameterInfo {
  name: string;
  label: string;
  unit: string;
}

export interface FilterState {
  selectedSites: string[];
  startDate: string | null;
  endDate: string | null;
  selectedParameters: string[];
}

export interface DashboardData {
  sites: Site[];
  readings: WaterQualityReading[];
  parameters: ParameterInfo[];
}
