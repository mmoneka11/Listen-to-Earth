# Verified NASA Datasets & Resources
The challenge's "NASA Data & Resources" tab lists the
resources below (reproduced from the Earth Information Jukebox challenge).
## Used in this project (verified)

| Resource | What it is | Link | Status |
|----------|-----------|------|--------|
| **DYAMOND Global Carbon Dioxide** | NASA SVS visualization 5196; rendered animation frames of global CO2 (GEOS DYAMOND model). SVS metadata tags it an EIC display asset. Smallest full-sequence download: `...orbit_1080p30_h265.mp4` (~6.9 MB, 1920×1080). | https://svs.gsfc.nasa.gov/5196 | ✅ verified via SVS API |
| **NASA Earth Information Center (EIC)** | EIC public home / dashboards. | https://earth.gov | ✅ |
| **GMAO DYAMOND Phase II (data access)** | Scientific source behind the visualization: the GEOS 3 km run "including 1km global carbon emissions for chemistry transport." | https://gmao.gsfc.nasa.gov/gmao-products/dyamond-phase-ii/data-access_dyamond-phase-ii/ | ✅ verified |
| **DYAMOND v2 03KM raw grids (NCCS)** | Raw netCDF, c2880 cubed-sphere, 181 levels. Cited as provenance; **not** ingested directly (too large / not lat-lon / not visual frames). | https://portal.nccs.nasa.gov/datashare/G5NR/DYAMONDv2/03KM/ | ✅ link verified via GMAO page |

## Other on-list resources (names from the challenge Resources tab)

Look up each one's exact SVS page / id on the day rather than assuming an id:
Change in Night Lights 2012→2023 (EIC Version) · Global Sea Surface Currents and
Temperature · GEOS Aerosols · Air Quality Model Runs · Perpetual Ocean 2: Western
Boundary Currents · Lightning Events Detected from the ISS 2017–2023 · A 3D View
of an Atmospheric River from an Earth System Model · GEDI Forest Height ·
Data Sonification: Caldwell 73 · EIC Content Database.

The pipeline is dataset-agnostic: pick any on-list visualization, find its SVS id,
and run `svs_fetch.py <id>` — the rest of the chain is identical. Good second
choice for demo contrast: **Night Lights 2012→2023** (extreme dark↔bright contrast,
genuine multi-year change).

## Citation block to paste into the submission

NASA Data field:
```
DYAMOND Global Carbon Dioxide (NASA Scientific Visualization Studio) — https://svs.gsfc.nasa.gov/5196
NASA Earth Information Center (EIC) — https://earth.gov
GMAO DYAMOND Phase II (scientific source) — https://gmao.gsfc.nasa.gov/gmao-products/dyamond-phase-ii/data-access_dyamond-phase-ii/
```
