'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Site } from '@/types';

// Dynamically import map components (Leaflet doesn't work with SSR)
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);

interface MapViewProps {
  sites: Site[];
  selectedSiteId: string | null;
  onSiteSelect: (siteId: string) => void;
}

export function MapView({ sites, selectedSiteId, onSiteSelect }: MapViewProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <p className="text-gray-500">Loading map...</p>
      </div>
    );
  }

  // Calculate center point from all sites
  const center: [number, number] = sites.length > 0
    ? [
        sites.reduce((sum, s) => sum + s.Latitude, 0) / sites.length,
        sites.reduce((sum, s) => sum + s.Longitude, 0) / sites.length,
      ]
    : [40.7128, -74.0060]; // Default to NYC area

  return (
    <div className="w-full h-full">
      <MapContainer
        center={center}
        zoom={10}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {sites.map((site) => (
          <Marker
            key={site.SiteID}
            position={[site.Latitude, site.Longitude]}
            eventHandlers={{
              click: () => onSiteSelect(site.SiteID),
            }}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-semibold">{site.SiteName || site.SiteID}</h3>
                <p className="text-sm text-gray-600">{site.Description || 'Monitoring site'}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {site.Latitude.toFixed(4)}, {site.Longitude.toFixed(4)}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
