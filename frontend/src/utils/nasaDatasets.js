import { asset } from './asset';
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
    frequency: '412–430 ppm',
    scale: 'C-Major Pentatonic',
    paletteNote: 'C3 – A6 Pentatonic',
    description: 'Dynamic atmospheric CO2 plumes modeled by the NASA GMAO GEOS system during the DYAMOND Phase II global run.',
    sourceCitation: 'NASA Goddard Space Flight Center / SVS #5196',
    sourceUrl: 'https://svs.gsfc.nasa.gov/5196/',
    accentColor: '#d97736',
    fps: 12,
    measurementUnit: 'ppm',
    baseValue: 412.0,
    rangeValue: 18.0,
    imageUrl: asset('frames/co2/co2_0000.jpg'),
  },
};

