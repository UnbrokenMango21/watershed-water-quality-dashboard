"use client";

import { MapSurface } from "./dashboard/MapSurface";

export function PublicMapPreview() {
  return (
    <div className="ww-map-live" aria-label="Interactive Pennsylvania reference watershed map">
      <MapSurface
        sites={[]}
        conditions={{}}
        selectedSite={null}
        hoveredSite={null}
        activeParameter="waterTemperature"
        onSelectSite={() => {}}
        onHoverSite={() => {}}
      />
    </div>
  );
}
