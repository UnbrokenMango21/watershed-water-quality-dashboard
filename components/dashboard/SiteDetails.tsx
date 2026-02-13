'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Site, WaterQualityReading } from '@/types';

interface SiteDetailsProps {
  site: Site | null;
  readings: WaterQualityReading[];
}

export function SiteDetails({ site, readings }: SiteDetailsProps) {
  if (!site) {
    return (
      <div className="h-full p-4">
        <Card className="h-full">
          <CardContent className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-center">
              Select a site on the map to view details
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get latest readings for this site
  const siteReadings = readings.filter(r => r.SiteID === site.SiteID);
  const latestReadings = siteReadings
    .sort((a, b) => new Date(b.SampleDate).getTime() - new Date(a.SampleDate).getTime())
    .slice(0, 5);

  // Get unique parameters with their latest values
  const parameterMap = new Map<string, WaterQualityReading>();
  siteReadings.forEach(reading => {
    const existing = parameterMap.get(reading.Parameter);
    if (!existing || new Date(reading.SampleDate) > new Date(existing.SampleDate)) {
      parameterMap.set(reading.Parameter, reading);
    }
  });

  const latestByParameter = Array.from(parameterMap.values());

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{site.SiteName || site.SiteID}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <p className="text-sm font-medium text-gray-700">Site ID</p>
            <p className="text-sm text-gray-900">{site.SiteID}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Location</p>
            <p className="text-sm text-gray-900">
              {site.Latitude.toFixed(6)}, {site.Longitude.toFixed(6)}
            </p>
          </div>
          {site.Description && (
            <div>
              <p className="text-sm font-medium text-gray-700">Description</p>
              <p className="text-sm text-gray-900">{site.Description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Latest Measurements</CardTitle>
        </CardHeader>
        <CardContent>
          {latestByParameter.length === 0 ? (
            <p className="text-sm text-gray-500">No measurements available</p>
          ) : (
            <div className="space-y-3">
              {latestByParameter.map(reading => (
                <div key={reading.Parameter} className="border-b border-gray-200 pb-2 last:border-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {reading.Parameter}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(reading.SampleDate).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-blue-600">
                      {reading.Value.toFixed(2)} {reading.Unit}
                    </p>
                  </div>
                  {reading.TestType && (
                    <p className="text-xs text-gray-500 mt-1">
                      Test Type: {reading.TestType}
                    </p>
                  )}
                  {reading.DataCollectedBy && (
                    <p className="text-xs text-gray-500">
                      Collected by: {reading.DataCollectedBy}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Statistics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-gray-700">Total Readings</span>
            <span className="text-sm font-semibold">{siteReadings.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-700">Parameters Monitored</span>
            <span className="text-sm font-semibold">{parameterMap.size}</span>
          </div>
          {siteReadings.length > 0 && (
            <div className="flex justify-between">
              <span className="text-sm text-gray-700">Latest Sample</span>
              <span className="text-sm font-semibold">
                {new Date(latestReadings[0].SampleDate).toLocaleDateString()}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
