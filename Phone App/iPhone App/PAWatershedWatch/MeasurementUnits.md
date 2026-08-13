# Measurement units and reporting bases

This frontend uses Pennsylvania and USGS field conventions as defaults, then offers only alternatives that are useful in watershed work. The unit control uses a stacked fraction because NIST permits division to be expressed with a horizontal line. Review and record screens use a compact slash form.

| Measurement | Default | Alternatives | Change behavior |
| --- | --- | --- | --- |
| Water temperature | °C | °F | Convert |
| pH | pH value | None; pH is dimensionless | No selector |
| Dissolved oxygen | mg O₂/L | µmol O₂/L | Convert |
| Dissolved oxygen saturation | % | None | Fixed |
| Conductivity | µS/cm | mS/cm, S/m | Convert |
| Total dissolved or suspended solids | mg/L | g/L | Convert |
| ORP | mV | V | Convert |
| Chloride and sulfate | mg/L | µg/L | Convert |
| Nitrate | mg N/L | µg N/L, mg NO₃⁻/L, µg NO₃⁻/L | Convert and preserve reporting basis |
| Phosphate | mg P/L | µg P/L, mg PO₄³⁻/L, µg PO₄³⁻/L | Convert and preserve reporting basis |
| Discharge / flow | m³/s | L/s, ft³/s, US gal/min | Convert |
| Turbidity | NTU | FNU | Clear with confirmation; method-dependent |
| Salinity | PSS-78 | ‰ | Clear with confirmation; different quantity conventions |
| Alkalinity and hardness | mg CaCO₃/L | meq/L | Convert |
| Ammonia nitrogen | mg N/L | µg N/L | Convert |
| Nitrite nitrogen | mg N/L | µg N/L, mg NO₂⁻/L, µg NO₂⁻/L | Convert and preserve reporting basis |
| Total phosphorus | mg P/L | µg P/L, mg PO₄³⁻/L, µg PO₄³⁻/L | Convert and preserve reporting basis |
| Chlorophyll a | µg/L | mg/m³ | Convert |
| E. coli | CFU/100 mL | MPN/100 mL | Clear with confirmation; method-dependent |

## Scientific decisions

- Pennsylvania field defaults retain °C, µS/cm at 25 °C, pH, and dissolved oxygen in mg/L. USGS conventions support the same core units and common use of ft³/s for discharge.
- Nutrient menus name the reported chemical basis explicitly. A nitrate result reported "as N" is not numerically interchangeable with the same numeral reported "as NO₃"; the app converts the value when the basis changes.
- PSS-78 practical salinity is shown as unitless, not "PSU."
- NTU and FNU, and CFU and MPN, are method-dependent results. The app never fabricates a conversion: changing the reporting choice clears an existing entry after confirmation.
- `ppm` is intentionally omitted because interpreting it as mg/L assumes a density relationship that should not be silently imposed on field data.

## Primary sources

- [NIST SP 811: rules for expressing divided units](https://www.nist.gov/pml/special-publication-811/nist-guide-si-chapter-6-rules-and-style-conventions-printing-and-using)
- [Pennsylvania DEP: water-quality data collection protocols](https://www.pa.gov/agencies/dep/programs-and-services/water/clean-water/water-quality/data-collection-protocols)
- [USGS: water-quality constituent and unit conventions](https://water.usgs.gov/nwc/NWC/water_quality/tables/constituent.html)
- [EPA WQX: nutrient reporting-basis best practices](https://www.epa.gov/sites/default/files/2017-06/documents/wqx_nutrient_best_practices_guide.pdf)
- [NOAA: PSS-78 practical salinity is unitless](https://www.ncei.noaa.gov/products/southwest-north-atlantic-regional-climatology)
- [USGS: NTU and FNU depend on optical method](https://pubs.usgs.gov/wdr/2006/termDefs_2006_old.html)
