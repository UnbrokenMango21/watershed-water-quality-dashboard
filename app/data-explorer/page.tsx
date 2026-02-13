'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { WaterQualityReading } from '@/types';
import { getSampleData } from '@/lib/data-loader';

export default function DataExplorerPage() {
  const [readings, setReadings] = useState<WaterQualityReading[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    const data = getSampleData();
    setReadings(data.readings);
  }, []);

  // Filter readings based on search
  const filteredReadings = readings.filter(reading =>
    Object.values(reading).some(value =>
      String(value).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // Paginate results
  const totalPages = Math.ceil(filteredReadings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedReadings = filteredReadings.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Data Explorer</h1>
            <p className="text-sm text-gray-600">Browse and search water quality measurements</p>
          </div>
          <div className="flex gap-2">
            <a
              href="/"
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Home
            </a>
            <a
              href="/dashboard"
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Dashboard
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

      <div className="container mx-auto px-6 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Water Quality Readings</CardTitle>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">
                  {filteredReadings.length} readings
                </span>
                <Input
                  type="text"
                  placeholder="Search readings..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-64"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Site ID</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Parameter</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">Value</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Unit</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Test Type</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Collected By</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedReadings.map((reading, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">{reading.SiteID}</td>
                      <td className="py-3 px-4">
                        {new Date(reading.SampleDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">{reading.Parameter}</td>
                      <td className="py-3 px-4 text-right font-mono">
                        {reading.Value.toFixed(2)}
                      </td>
                      <td className="py-3 px-4">{reading.Unit}</td>
                      <td className="py-3 px-4">{reading.TestType || '-'}</td>
                      <td className="py-3 px-4">{reading.DataCollectedBy || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-gray-600">
                  Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredReadings.length)} of {filteredReadings.length} results
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <span className="px-4 py-2 text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
