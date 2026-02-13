'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Filters } from '@/components/dashboard/Filters';
import { MapView } from '@/components/dashboard/MapView';
import { SiteDetails } from '@/components/dashboard/SiteDetails';
import { TimeSeriesChart } from '@/components/dashboard/TimeSeriesChart';
import { KPICard } from '@/components/dashboard/KPICard';
import { FilterState, DashboardData } from '@/types';
import { getSampleData } from '@/lib/data-loader';
import { MapPin, Droplets, Calendar } from 'lucide-react';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({ sites: [], readings: [], parameters: [] });
  const [filters, setFilters] = useState<FilterState>({
    selectedSites: [],
    startDate: null,
    endDate: null,
    selectedParameters: [],
  });
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  // Load data on mount
  useEffect(() => {
    const sampleData = getSampleData();
    setData(sampleData);
    
    // Initialize filters with all sites and parameters selected
    setFilters({
      selectedSites: sampleData.sites.map(s => s.SiteID),
      startDate: null,
      endDate: null,
      selectedParameters: sampleData.parameters.map(p => p.name),
    });
  }, []);

  // Filter data based on current filters
  const filteredData = useMemo(() => {
    let filteredReadings = data.readings;

    // Filter by sites
    if (filters.selectedSites.length > 0) {
      filteredReadings = filteredReadings.filter(r =>
        filters.selectedSites.includes(r.SiteID)
      );
    }

    // Filter by parameters
    if (filters.selectedParameters.length > 0) {
      filteredReadings = filteredReadings.filter(r =>
        filters.selectedParameters.includes(r.Parameter)
      );
    }

    // Filter by date range
    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      filteredReadings = filteredReadings.filter(r =>
        new Date(r.SampleDate) >= startDate
      );
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999); // Include the entire end date
      filteredReadings = filteredReadings.filter(r =>
        new Date(r.SampleDate) <= endDate
      );
    }

    // Filter sites to only those with readings
    const sitesWithReadings = new Set(filteredReadings.map(r => r.SiteID));
    const filteredSites = data.sites.filter(s => 
      sitesWithReadings.has(s.SiteID) && filters.selectedSites.includes(s.SiteID)
    );

    return {
      sites: filteredSites,
      readings: filteredReadings,
      parameters: data.parameters,
    };
  }, [data, filters]);

  // Get selected site data
  const selectedSite = filteredData.sites.find(s => s.SiteID === selectedSiteId) || null;

  // Calculate KPIs
  const uniqueSites = new Set(filteredData.readings.map(r => r.SiteID)).size;
  const totalReadings = filteredData.readings.length;
  const dateRange = filteredData.readings.length > 0
    ? (() => {
        const dates = filteredData.readings.map(r => new Date(r.SampleDate).getTime());
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        const days = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
        return `${days} days`;
      })()
    : '0 days';

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Watershed Water Quality Dashboard</h1>
            <p className="text-sm text-gray-600">Public Mode - Real-time water quality monitoring</p>
          </div>
          <div className="flex gap-2">
            <a
              href="/"
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Home
            </a>
            <a
              href="/data-explorer"
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Data Explorer
            </a>
            <a
              href="/signin"
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Sign In
            </a>
          </div>
        </div>
      </header>

      {/* KPIs */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPICard
            title="Unique Sites"
            value={uniqueSites}
            subtitle="Active monitoring locations"
            icon={<MapPin className="w-8 h-8" />}
          />
          <KPICard
            title="Total Readings"
            value={totalReadings.toLocaleString()}
            subtitle="Measurements collected"
            icon={<Droplets className="w-8 h-8" />}
          />
          <KPICard
            title="Data Range"
            value={dateRange}
            subtitle="Monitoring period"
            icon={<Calendar className="w-8 h-8" />}
          />
        </div>
      </div>

      {/* Main Dashboard Grid */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-12 grid-rows-2 gap-0">
          {/* Left Panel - Filters */}
          <div className="col-span-2 row-span-2 border-r border-gray-200 bg-white overflow-hidden">
            <Filters
              sites={data.sites.map(s => s.SiteID)}
              parameters={data.parameters}
              filters={filters}
              onFiltersChange={setFilters}
            />
          </div>

          {/* Center Panel - Map */}
          <div className="col-span-7 row-span-2 border-r border-gray-200">
            <MapView
              sites={filteredData.sites}
              selectedSiteId={selectedSiteId}
              onSiteSelect={setSelectedSiteId}
            />
          </div>

          {/* Right Panel - Site Details */}
          <div className="col-span-3 row-span-1 border-b border-gray-200 bg-white overflow-hidden">
            <SiteDetails
              site={selectedSite}
              readings={filteredData.readings}
            />
          </div>

          {/* Bottom Right - Chart */}
          <div className="col-span-3 row-span-1 bg-white overflow-hidden">
            <TimeSeriesChart
              readings={filteredData.readings}
              parameters={data.parameters}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
