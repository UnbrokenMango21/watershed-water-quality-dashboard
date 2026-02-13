'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { WaterQualityReading, ParameterInfo } from '@/types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

interface TimeSeriesChartProps {
  readings: WaterQualityReading[];
  parameters: ParameterInfo[];
}

export function TimeSeriesChart({ readings, parameters }: TimeSeriesChartProps) {
  const [selectedParameter, setSelectedParameter] = useState<string>('');

  // Update selected parameter when parameters are loaded
  useEffect(() => {
    if (parameters.length > 0 && !selectedParameter) {
      setSelectedParameter(parameters[0].name);
    }
  }, [parameters, selectedParameter]);

  // Filter and sort readings for the selected parameter
  const parameterReadings = readings
    .filter(r => r.Parameter === selectedParameter)
    .sort((a, b) => new Date(a.SampleDate).getTime() - new Date(b.SampleDate).getTime());

  // Group by date and site
  const chartData: any[] = [];
  const sitesInData = new Set<string>();

  parameterReadings.forEach(reading => {
    const dateKey = format(new Date(reading.SampleDate), 'yyyy-MM-dd');
    let dataPoint = chartData.find(d => d.date === dateKey);
    
    if (!dataPoint) {
      dataPoint = { date: dateKey, fullDate: new Date(reading.SampleDate) };
      chartData.push(dataPoint);
    }
    
    dataPoint[reading.SiteID] = reading.Value;
    sitesInData.add(reading.SiteID);
  });

  // Sort by date
  chartData.sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime());

  const selectedParamInfo = parameters.find(p => p.name === selectedParameter);
  const unit = selectedParamInfo?.unit || '';

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="h-full p-4">
      <Card className="h-full flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Time Series Analysis</CardTitle>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Parameter:</label>
              <select
                value={selectedParameter}
                onChange={(e) => setSelectedParameter(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {parameters.map(param => (
                  <option key={param.name} value={param.name}>
                    {param.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 min-h-0">
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">No data available for selected parameter</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  label={{ value: unit, angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                />
                <Tooltip
                  labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy')}
                  formatter={(value: number | undefined) => value !== undefined ? [`${value.toFixed(2)} ${unit}`, ''] : ['', '']}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {Array.from(sitesInData).map((siteId, index) => (
                  <Line
                    key={siteId}
                    type="monotone"
                    dataKey={siteId}
                    name={siteId}
                    stroke={colors[index % colors.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
