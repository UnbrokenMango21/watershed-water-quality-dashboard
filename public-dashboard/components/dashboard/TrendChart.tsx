"use client";

import { useState } from "react";
import type { DashboardObservationSeriesPoint } from "@/lib/data/DashboardDataSource";
import { formatDateTime, formatShortDate } from "./dashboard-utils";

export function TrendChart({ points, label, decimals }: { points: DashboardObservationSeriesPoint[]; label: string; decimals: number }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (points.length === 0) {
    return (
      <div className="chart-empty" role="status">
        <div className="chart-grid" aria-hidden="true" />
        <div className="chart-empty-copy">
          <strong>No {label.toLowerCase()} measurements in this range</strong>
          <span>Choose another time range or parameter.</span>
        </div>
      </div>
    );
  }

  const ordered = [...points].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
  const times = ordered.map((point) => Date.parse(point.observedAt));
  const values = ordered.map((point) => point.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const spread = Math.max(rawMax - rawMin, Math.abs(rawMax) * 0.05, 0.1);
  const min = rawMin - spread * 0.18;
  const max = rawMax + spread * 0.18;
  const plot = { left: 66, right: 794, top: 18, bottom: 218 };
  const width = plot.right - plot.left;
  const height = plot.bottom - plot.top;
  const timeMin = times[0];
  const timeMax = times.at(-1)!;
  const timeSpan = Math.max(timeMax - timeMin, 1);
  const xForTime = (time: number) => plot.left + ((time - timeMin) / timeSpan) * width;
  const yFor = (value: number) => plot.top + ((max - value) / (max - min)) * height;
  const gridValues = [max, max - (max - min) / 3, max - (2 * (max - min)) / 3, min];
  const unit = ordered[0]?.unit ?? "";

  const differences = times.slice(1).map((time, index) => time - times[index]).sort((a, b) => a - b);
  const medianDifference = differences.length ? differences[Math.floor(differences.length / 2)] : Number.POSITIVE_INFINITY;
  const gapThreshold = medianDifference * 1.6;
  const segments: DashboardObservationSeriesPoint[][] = [];
  const gaps: Array<{ from: number; to: number }> = [];
  let currentSegment: DashboardObservationSeriesPoint[] = [];

  ordered.forEach((point, index) => {
    if (index > 0 && times[index] - times[index - 1] > gapThreshold) {
      segments.push(currentSegment);
      currentSegment = [];
      gaps.push({ from: times[index - 1], to: times[index] });
    }
    currentSegment.push(point);
  });
  if (currentSegment.length) segments.push(currentSegment);

  const hovered = hoveredIndex === null ? null : ordered[hoveredIndex];
  const hoveredX = hovered ? xForTime(Date.parse(hovered.observedAt)) : 0;
  const hoveredY = hovered ? yFor(hovered.value) : 0;
  const tooltipX = hoveredX > 620 ? hoveredX - 170 : hoveredX + 12;
  const tooltipY = Math.max(8, Math.min(hoveredY - 54, 164));

  return (
    <div className="chart-wrap">
      <svg className="trend-chart" viewBox="0 0 830 254" role="img" aria-label={`${label} observation series with ${ordered.length} measurements from ${formatShortDate(ordered[0].observedAt)} to ${formatShortDate(ordered.at(-1)!.observedAt)}.`}>
        {gridValues.map((gridValue) => {
          const y = yFor(gridValue);
          return (
            <g key={gridValue}>
              <line x1={plot.left} x2={plot.right} y1={y} y2={y} className="chart-grid-line" />
              <text x={plot.left - 10} y={y + 4} textAnchor="end" className="chart-axis-label">{gridValue.toFixed(decimals > 0 ? Math.min(decimals, 1) : 0)}</text>
            </g>
          );
        })}

        {gaps.map((gap) => {
          const x1 = xForTime(gap.from);
          const x2 = xForTime(gap.to);
          return (
            <g key={`${gap.from}-${gap.to}`}>
              <rect x={x1} y={plot.top} width={Math.max(x2 - x1, 1)} height={height} className="chart-gap-band" />
              <text x={(x1 + x2) / 2} y={plot.top + 12} textAnchor="middle" className="chart-gap-label">sampling gap</text>
            </g>
          );
        })}

        <line x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom} className="chart-axis-line" />
        {segments.map((segment, segmentIndex) => segment.length < 2 ? null : (
          <polyline
            key={segmentIndex}
            points={segment.map((point) => `${xForTime(Date.parse(point.observedAt))},${yFor(point.value)}`).join(" ")}
            className="chart-series-line"
          />
        ))}

        {ordered.map((point, index) => (
          <circle
            key={point.observationId}
            cx={xForTime(Date.parse(point.observedAt))}
            cy={yFor(point.value)}
            r={hoveredIndex === index ? 6 : 4.5}
            className="chart-point"
            tabIndex={0}
            aria-label={`${formatDateTime(point.observedAt)}, ${point.value} ${point.unit}`}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            onFocus={() => setHoveredIndex(index)}
            onBlur={() => setHoveredIndex(null)}
          />
        ))}

        {[0, Math.floor((ordered.length - 1) / 2), ordered.length - 1]
          .filter((value, index, array) => array.indexOf(value) === index)
          .map((index) => (
            <text key={index} x={xForTime(times[index])} y="242" textAnchor={index === 0 ? "start" : index === ordered.length - 1 ? "end" : "middle"} className="chart-axis-label">
              {formatShortDate(ordered[index].observedAt)}
            </text>
          ))}
        <text x="16" y="120" transform="rotate(-90 16 120)" textAnchor="middle" className="chart-unit-label">{unit}</text>

        {hovered && (
          <g className="chart-tooltip" aria-hidden="true">
            <line x1={hoveredX} x2={hoveredX} y1={plot.top} y2={plot.bottom} className="chart-hover-line" />
            <rect x={tooltipX} y={tooltipY} width="158" height="44" rx="5" />
            <text x={tooltipX + 10} y={tooltipY + 17}>{formatDateTime(hovered.observedAt)}</text>
            <text x={tooltipX + 10} y={tooltipY + 34} className="chart-tooltip-value">{hovered.value.toFixed(decimals)} {hovered.unit === "pH" ? "" : hovered.unit}</text>
          </g>
        )}
      </svg>
      <div className="chart-caption">Lines connect consecutive sampled observations only; sampling gaps remain unconnected.</div>
    </div>
  );
}
