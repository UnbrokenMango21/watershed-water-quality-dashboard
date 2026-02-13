'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FilterState, ParameterInfo } from '@/types';

interface FiltersProps {
  sites: string[];
  parameters: ParameterInfo[];
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

export function Filters({ sites, parameters, filters, onFiltersChange }: FiltersProps) {
  const handleSiteToggle = (siteId: string) => {
    const newSites = filters.selectedSites.includes(siteId)
      ? filters.selectedSites.filter(id => id !== siteId)
      : [...filters.selectedSites, siteId];
    onFiltersChange({ ...filters, selectedSites: newSites });
  };

  const handleParameterToggle = (paramName: string) => {
    const newParams = filters.selectedParameters.includes(paramName)
      ? filters.selectedParameters.filter(p => p !== paramName)
      : [...filters.selectedParameters, paramName];
    onFiltersChange({ ...filters, selectedParameters: newParams });
  };

  const handleSelectAllSites = () => {
    onFiltersChange({ ...filters, selectedSites: sites });
  };

  const handleClearAllSites = () => {
    onFiltersChange({ ...filters, selectedSites: [] });
  };

  const handleSelectAllParameters = () => {
    onFiltersChange({ ...filters, selectedParameters: parameters.map(p => p.name) });
  };

  const handleClearAllParameters = () => {
    onFiltersChange({ ...filters, selectedParameters: [] });
  };

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Date Range</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <label className="text-sm font-medium text-gray-700">Start Date</label>
            <Input
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => onFiltersChange({ ...filters, startDate: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">End Date</label>
            <Input
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => onFiltersChange({ ...filters, endDate: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Sites</CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleSelectAllSites}>
                All
              </Button>
              <Button variant="ghost" size="sm" onClick={handleClearAllSites}>
                None
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-48 overflow-auto">
            {sites.map(site => (
              <label key={site} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.selectedSites.includes(site)}
                  onChange={() => handleSiteToggle(site)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm">{site}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Parameters</CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleSelectAllParameters}>
                All
              </Button>
              <Button variant="ghost" size="sm" onClick={handleClearAllParameters}>
                None
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-48 overflow-auto">
            {parameters.map(param => (
              <label key={param.name} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.selectedParameters.includes(param.name)}
                  onChange={() => handleParameterToggle(param.name)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm">{param.label}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
