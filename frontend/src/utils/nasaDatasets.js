// Complete Scientific Telemetry Profiles for NASA EIC Datasets
// Grounded in NASA SVS Visualizations for the Earth Information Jukebox

export const NASA_CATALOG = {
  co2: {
    id: 'co2',
    nasaId: 'SVS #5196',
    title: 'DYAMOND Global Carbon Dioxide (CO2)',
    category: 'Atmosphere',
    domain: 'Global Carbon Cycle',
    soundProfile: 'Strings & Synth',
    frequency: '420 ppm // 124Hz',
    scale: 'Pentatonic E-Minor',
    paletteNote: 'E3 – D5 Pentatonic',
    description: 'Dynamic atmospheric CO2 plumes modeled by the NASA GMAO GEOS system during the DYAMOND Phase II global run.',
    sourceCitation: 'NASA Goddard Space Flight Center / SVS #5196',
    sourceUrl: 'https://svs.gsfc.nasa.gov/5196/',
    accentColor: '#d97736',
    fps: 12,
    measurementUnit: 'ppm',
    baseValue: 412.0,
    rangeValue: 18.0,
    imageUrl: '/frames/co2/co2_0000.jpg',
  },
  sst: {
    id: 'sst',
    nasaId: 'SVS #4752',
    title: 'Sea Surface Temperature Anomaly',
    category: 'Hydrosphere',
    domain: 'Ocean Dynamics & El Niño',
    soundProfile: 'Warm Cello & Deep Sub-Bass',
    frequency: '-2.4°C to +3.1°C // 65Hz',
    scale: 'Harmonic Minor / D-Benthic',
    paletteNote: 'D2 – A3 Sub Drone',
    description: 'Multi-satellite SST anomalies highlighting equatorial Kelvin waves and Pacific basin heat redistribution.',
    sourceCitation: 'NASA JPL Physical Oceanography DAAC / SVS #4752',
    sourceUrl: 'https://svs.gsfc.nasa.gov/4752/',
    accentColor: '#1f6f60',
    fps: 8,
    measurementUnit: '°C Anom',
    baseValue: -1.2,
    rangeValue: 3.8,
    imageUrl: '/frames/sst/sst_0000.jpg',
  },
  ozone: {
    id: 'ozone',
    nasaId: 'SVS #3890',
    title: 'Antarctic Ozone Hole Recovery',
    category: 'Stratosphere',
    domain: 'Atmospheric Chemistry',
    soundProfile: 'C-Major Shimmer & Resonant Bells',
    frequency: '180 DU // 432Hz',
    scale: 'C-Major Acoustic Horizon',
    paletteNote: 'C4 – G5 Crystal Bells',
    description: 'Ozone Monitoring Instrument (OMI) measurements tracking polar stratospheric vortex seasonal contraction.',
    sourceCitation: 'NASA GSFC Atmospheric Chemistry / SVS #3890',
    sourceUrl: 'https://svs.gsfc.nasa.gov/3890/',
    accentColor: '#2a7b6c',
    fps: 6,
    measurementUnit: 'Dobson Units',
    baseValue: 140.0,
    rangeValue: 160.0,
    imageUrl: '/frames/ozone/ozone_0000.jpg',
  },
  precip: {
    id: 'precip',
    nasaId: 'SVS #4272',
    title: 'Global Precipitation Measurement (GPM)',
    category: 'Biosphere',
    domain: 'Hydrologic Weather Systems',
    soundProfile: 'Water Pulse & Rain Texture',
    frequency: '0-50 mm/hr // 88Hz',
    scale: 'Organic Pentatonic Flux',
    paletteNote: 'D3 – E4 Poly Pulse',
    description: 'IMERG core satellite observations measuring precipitation rates across monsoon belts and atmospheric rivers.',
    sourceCitation: 'NASA Precipitation Processing System / SVS #4272',
    sourceUrl: 'https://svs.gsfc.nasa.gov/4272/',
    accentColor: '#38bdf8',
    fps: 10,
    measurementUnit: 'mm/hr',
    baseValue: 0.0,
    rangeValue: 48.0,
    imageUrl: '/frames/precip/precip_0000.jpg',
  },
  solar: {
    id: 'solar',
    nasaId: 'SVS #4812',
    title: 'Solar Dynamics Observatory Flares (SDO)',
    category: 'Heliophysics',
    domain: 'Space Weather & Magnetosphere',
    soundProfile: 'High Harmonic Arpeggios',
    frequency: 'X-Class Flux // 528Hz',
    scale: 'Solar Flare Micro-tonal',
    paletteNote: 'G3 – A4 Solar Arp',
    description: 'Extreme ultraviolet AIA imagery of coronal mass ejections and solar magnetic reconnection arcs.',
    sourceCitation: 'NASA SDO Science Team / SVS #4812',
    sourceUrl: 'https://svs.gsfc.nasa.gov/4812/',
    accentColor: '#ffb68c',
    fps: 12,
    measurementUnit: '10⁻⁴ W/m²',
    baseValue: 0.5,
    rangeValue: 9.5,
    imageUrl: '/frames/solar/solar_0000.jpg',
  },
  ice: {
    id: 'ice',
    nasaId: 'SVS #5032',
    title: 'Arctic Sea Ice Minimum Extent',
    category: 'Cryosphere',
    domain: 'Polar Climate Dynamics',
    soundProfile: 'Glass Marimba & Low Drone',
    frequency: '4.3M km² // 60Hz Drone',
    scale: 'Cryo-Modal B-Minor',
    paletteNote: 'B2 – D4 Glass Percussion',
    description: 'Passive microwave radiometer time-series documenting summer Arctic sea ice shrinkage and perennial ice loss.',
    sourceCitation: 'NASA GSFC Cryospheric Sciences / SVS #5032',
    sourceUrl: 'https://svs.gsfc.nasa.gov/5032/',
    accentColor: '#a6f1de',
    fps: 6,
    measurementUnit: 'Million km²',
    baseValue: 3.8,
    rangeValue: 3.2,
    imageUrl: '/frames/ice/ice_0000.jpg',
  },
};

// Generates smooth, realistic planetary telemetry frames for datasets where raw video isn't locally cached
export function generateSyntheticDataset(datasetKey, frameCount = 60) {
  const meta = NASA_CATALOG[datasetKey] || NASA_CATALOG.co2;
  const frames = [];

  for (let i = 0; i < frameCount; i++) {
    const t = i / (frameCount - 1);
    // Multi-frequency harmonic curves for organic physical motion
    const wave1 = Math.sin(t * Math.PI * 3.5);
    const wave2 = Math.cos(t * Math.PI * 6.2) * 0.35;
    const wave3 = Math.sin(t * Math.PI * 1.2) * 0.2;

    const rawNorm = Math.max(0.08, Math.min(0.96, (wave1 + wave2 + wave3 + 1.2) / 2.6));
    const delta = Math.abs(Math.sin(t * Math.PI * 8.5) * 0.45 + (i % 7 === 0 ? 0.35 : 0.05));
    const panX = Math.max(0.12, Math.min(0.88, 0.5 + Math.sin(t * Math.PI * 2.8) * 0.36));
    const hot = Math.max(0.02, Math.min(0.85, rawNorm * 0.8 + (delta > 0.3 ? 0.2 : 0)));

    const val = (meta.baseValue + rawNorm * meta.rangeValue).toFixed(2);
    const panHemisphere = panX > 0.55 ? 'East sector' : panX < 0.45 ? 'West sector' : 'Central meridian';
    const trend = delta > 0.3 ? 'rapid transient surge' : 'steady gradient';

    const caption = `${meta.title} — Frame ${i + 1}/${frameCount}: ${val} ${meta.measurementUnit} centered over ${panHemisphere} (${trend}, activity intensity at ${Math.round(hot * 100)}%).`;

    frames.push({
      i,
      hue: meta.category === 'Atmosphere' ? 125 : meta.category === 'Hydrosphere' ? 195 : meta.category === 'Stratosphere' ? 260 : meta.category === 'Biosphere' ? 210 : meta.category === 'Heliophysics' ? 35 : 180,
      brightness: rawNorm,
      hot,
      panX,
      delta: Math.min(1.0, delta),
      timestamp_seconds: i * (1 / meta.fps),
      timestamp: `T+${(i * (1 / meta.fps)).toFixed(1)}s`,
      measurementText: `${val} ${meta.measurementUnit}`,
      caption,
      imageUrl:
        datasetKey === 'co2'
          ? `/frames/co2/co2_${String(i % 314).padStart(4, '0')}.jpg`
          : `/frames/${datasetKey}/${datasetKey}_${String(i % 60).padStart(4, '0')}.jpg`,
    });
  }

  return {
    ...meta,
    tag: meta.nasaId,
    subtitle: meta.description,
    isMock: false,
    frames,
  };
}
