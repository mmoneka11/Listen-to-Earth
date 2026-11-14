import { useEffect, useRef, useState } from 'react';

export default function VisualizerCanvas({
  frame,
  videoTitle,
  datasetCategory = 'Atmosphere',
  isPlaying,
  reducedMotion,
}) {
  const canvasRef = useRef(null);
  const [loadedImg, setLoadedImg] = useState(null);
  const imgCache = useRef(new Map());

  // High-performance image preloading & memory caching for fluid 60fps playback
  useEffect(() => {
    if (!frame?.imageUrl) {
      return;
    }

    const url = frame.imageUrl;

    // 1. Instant cache hit
    if (imgCache.current.has(url)) {
      setLoadedImg(imgCache.current.get(url));
      return;
    }

    // 2. Asynchronous preload without flickering previous frame
    let active = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;

    img.onload = () => {
      imgCache.current.set(url, img);
      if (active) {
        setLoadedImg(img);
      }
    };

    return () => {
      active = false;
    };
  }, [frame?.imageUrl]);

  // Main canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frame) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;

    ctx.clearRect(0, 0, width, height);

    const brightness = frame.brightness ?? 0.5;
    const hot = frame.hot ?? brightness;
    const change = frame.delta ?? frame.change ?? 0;
    const panX = frame.panX ?? 0.5;
    const frameIndex = frame.i ?? 0;

    const cx = width / 2;
    const cy = height * 0.48;

    // 1. Deep Space Matte Background with Grid
    const spaceGrad = ctx.createRadialGradient(cx, cy, 40, cx, cy, width * 0.75);
    spaceGrad.addColorStop(0, '#0d131a');
    spaceGrad.addColorStop(0.65, '#080b0f');
    spaceGrad.addColorStop(1, '#040608');
    ctx.fillStyle = spaceGrad;
    ctx.fillRect(0, 0, width, height);

    // Coordinate telemetry grid lines
    ctx.strokeStyle = 'rgba(75, 86, 99, 0.15)';
    ctx.lineWidth = 1;
    for (let x = 40; x < width; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 30; y < height; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 2. Real NASA Planetary Imagery OR High-Fidelity Scientific Cartography
    if (loadedImg) {
      // Draw actual NASA satellite frame with aspect ratio preservation
      const imgAspect = loadedImg.width / loadedImg.height;
      const canvasAspect = width / height;

      let drawW, drawH, drawX, drawY;
      if (canvasAspect > imgAspect) {
        drawH = height;
        drawW = height * imgAspect;
        drawX = (width - drawW) / 2;
        drawY = 0;
      } else {
        drawW = width;
        drawH = width / imgAspect;
        drawX = 0;
        drawY = (height - drawH) / 2;
      }

      ctx.drawImage(loadedImg, drawX, drawY, drawW, drawH);

      // Subtle atmospheric vignette for scientific HUD legibility
      const vignette = ctx.createRadialGradient(cx, cy, height * 0.28, cx, cy, width * 0.65);
      vignette.addColorStop(0, 'rgba(4, 6, 8, 0.02)');
      vignette.addColorStop(0.85, 'rgba(4, 6, 8, 0.35)');
      vignette.addColorStop(1, 'rgba(4, 6, 8, 0.85)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);
    } else {
      // High-Fidelity Vector Planetary Cartography Fallback
      const radius = Math.min(width, height) * 0.32;
      const titleLower = (videoTitle || '').toLowerCase();
      const isSolar = datasetCategory === 'Heliophysics' || titleLower.includes('solar');
      const isOzone = datasetCategory === 'Stratosphere' || titleLower.includes('ozone');
      const isSST = datasetCategory === 'Hydrosphere' || titleLower.includes('temperature') || titleLower.includes('sea');
      const isPrecip = datasetCategory === 'Biosphere' || titleLower.includes('precip') || titleLower.includes('gpm');
      const isIce = datasetCategory === 'Cryosphere' || titleLower.includes('ice');

      if (isSolar) {
        // SDO HELIOPHYSICS: THE SUN (AIA 171Å / 304Å EXTREME ULTRAVIOLET)
        const solarCorona = ctx.createRadialGradient(cx, cy, radius * 0.95, cx, cy, radius * 1.65);
        solarCorona.addColorStop(0, `rgba(255, 178, 125, ${0.45 + brightness * 0.3})`);
        solarCorona.addColorStop(0.35, 'rgba(217, 119, 54, 0.22)');
        solarCorona.addColorStop(0.7, 'rgba(180, 83, 9, 0.08)');
        solarCorona.addColorStop(1, 'rgba(4, 6, 8, 0)');
        ctx.fillStyle = solarCorona;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 1.65, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.clip();

        const sunGrad = ctx.createRadialGradient(cx - radius * 0.2, cy - radius * 0.2, radius * 0.1, cx, cy, radius);
        sunGrad.addColorStop(0, '#fff4cc');
        sunGrad.addColorStop(0.25, '#f59e0b');
        sunGrad.addColorStop(0.65, '#d97736');
        sunGrad.addColorStop(0.9, '#9a3412');
        sunGrad.addColorStop(1, '#451a03');
        ctx.fillStyle = sunGrad;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

        // Prominence loops and flare burst
        const flareX = cx + (panX - 0.5) * radius * 1.4;
        const flareY = cy + (Math.sin(frameIndex * 0.06) - 0.2) * radius * 0.5;
        const flareGrad = ctx.createRadialGradient(flareX, flareY, 2, flareX, flareY, radius * (0.25 + hot * 0.4));
        flareGrad.addColorStop(0, '#ffffff');
        flareGrad.addColorStop(0.3, 'rgba(254, 240, 138, 0.9)');
        flareGrad.addColorStop(0.6, 'rgba(249, 115, 22, 0.5)');
        flareGrad.addColorStop(1, 'rgba(154, 52, 18, 0)');
        ctx.fillStyle = flareGrad;
        ctx.beginPath();
        ctx.arc(flareX, flareY, radius * (0.25 + hot * 0.4), 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      } else {
        // AUTHENTIC BLUE MARBLE EARTH GLOBE
        const corona = ctx.createRadialGradient(cx, cy, radius * 0.85, cx, cy, radius * 1.35);
        const glowColor = isSST
          ? '31, 140, 160'
          : isOzone
          ? '139, 92, 246'
          : isPrecip
          ? '16, 185, 129'
          : isIce
          ? '56, 189, 248'
          : '217, 119, 54';

        corona.addColorStop(0, `rgba(${glowColor}, ${0.32 + brightness * 0.25})`);
        corona.addColorStop(0.55, `rgba(${glowColor}, 0.1)`);
        corona.addColorStop(1, 'rgba(4, 6, 8, 0)');
        ctx.fillStyle = corona;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 1.35, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.clip();

        // Deep Oceanic Base
        const oceanGrad = ctx.createRadialGradient(
          cx - radius * 0.35,
          cy - radius * 0.3,
          radius * 0.1,
          cx,
          cy,
          radius
        );
        oceanGrad.addColorStop(0, isSST ? '#0c2e3b' : '#0a1e38');
        oceanGrad.addColorStop(0.6, '#061324');
        oceanGrad.addColorStop(1, '#02060d');
        ctx.fillStyle = oceanGrad;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

        // Realistic Vector Continental Landmasses
        const rotX = (panX - 0.5) * radius * 1.3;
        ctx.fillStyle = '#1c302d';
        ctx.strokeStyle = 'rgba(138, 213, 194, 0.4)';
        ctx.lineWidth = 1.2;

        // Draw realistic continental landforms
        const drawContinent = (points, offsetX = 0, offsetY = 0) => {
          ctx.beginPath();
          points.forEach(([px, py], idx) => {
            const rx = cx + rotX + (px / 100) * radius + offsetX;
            const ry = cy + (py / 100) * radius + offsetY;
            if (idx === 0) ctx.moveTo(rx, ry);
            else ctx.lineTo(rx, ry);
          });
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        };

        // Africa
        drawContinent([
          [-15, -35], [20, -32], [35, -10], [42, 10], [25, 25],
          [20, 55], [5, 75], [-5, 75], [-18, 40], [-35, 10],
          [-35, -5], [-20, -10], [-15, -35]
        ]);

        // Eurasia
        drawContinent([
          [-15, -40], [10, -42], [40, -55], [85, -55], [95, -25],
          [75, -5], [60, 5], [45, 15], [35, -5], [15, -15],
          [5, -35], [-15, -40]
        ]);

        // North America
        drawContinent([
          [-85, -60], [-55, -65], [-40, -45], [-50, -25], [-60, -10],
          [-75, 5], [-85, -10], [-95, -30], [-85, -60]
        ], -radius * 0.45);

        // South America
        drawContinent([
          [-65, 5], [-45, 15], [-40, 30], [-50, 65], [-65, 80],
          [-75, 55], [-75, 25], [-65, 5]
        ], -radius * 0.45);

        // Australia
        drawContinent([
          [50, 30], [80, 25], [90, 45], [85, 65], [60, 65],
          [45, 45], [50, 30]
        ]);

        // Graticule Parallels & Meridians
        ctx.strokeStyle = 'rgba(138, 213, 194, 0.15)';
        ctx.lineWidth = 1;
        for (let lat = -60; lat <= 60; lat += 30) {
          const latY = cy + Math.sin((lat * Math.PI) / 180) * radius;
          const latR = Math.cos((lat * Math.PI) / 180) * radius;
          ctx.beginPath();
          ctx.ellipse(cx, latY, latR, latR * 0.22, 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.restore();
      }
    }

    // 3. Technical Crosshair & Telemetry Readouts
    const targetX = cx + (panX - 0.5) * (width * 0.6);
    const targetY = cy;

    ctx.strokeStyle = change > 0.3 ? '#d97736' : 'rgba(138, 213, 194, 0.6)';
    ctx.lineWidth = 1;

    // Crosshair target circle
    ctx.beginPath();
    ctx.arc(targetX, targetY, 14, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshair cross ticks
    ctx.beginPath();
    ctx.moveTo(targetX - 22, targetY);
    ctx.lineTo(targetX + 22, targetY);
    ctx.moveTo(targetX, targetY - 22);
    ctx.lineTo(targetX, targetY + 22);
    ctx.stroke();

    // 4. Real-time Acoustic Waveform Strip across bottom of viewport
    ctx.strokeStyle = '#d97736';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const waveY = height - 36;
    const waveAmp = 12 * (brightness + 0.2);
    const waveFreq = 0.035;

    for (let x = 0; x < width; x += 4) {
      const y = waveY + Math.sin(x * waveFreq + frameIndex * 0.15) * waveAmp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // HUD Text Overlay
    ctx.fillStyle = '#ece5dc';
    ctx.font = '600 11px "JetBrains Mono", monospace';
    const panLabel = panX > 0.52 ? `+${((panX - 0.5) * 2).toFixed(2)}E` : `${((panX - 0.5) * 2).toFixed(2)}W`;
    const measurement = frame.measurementText || `${(412 + brightness * 18).toFixed(1)} ppm`;

    ctx.fillText(`MEASUREMENT: ${measurement}`, 24, 28);
    ctx.fillText(`STEREO PAN: ${panLabel}`, 24, 46);

    const latCoord = (14.8 + Math.sin(frameIndex * 0.05) * 6.2).toFixed(2);
    const lonCoord = (168.1 - panX * 42.0).toFixed(2);
    ctx.textAlign = 'right';
    ctx.fillText(`LAT ${latCoord}°N  LON ${lonCoord}°W`, width - 24, 28);
    ctx.fillText(`FLUX DELTA: Δ ${(change).toFixed(2)}`, width - 24, 46);
    ctx.textAlign = 'left';
  }, [frame, loadedImg, videoTitle, datasetCategory, isPlaying, reducedMotion]);

  return (
    <div className="stitch-canvas-wrap-inner">
      <canvas
        ref={canvasRef}
        width={960}
        height={500}
        className="stitch-main-canvas"
        role="img"
        aria-label={`Observational frame ${frame?.i + 1 || 1} of ${videoTitle}. Luminance: ${Math.round(
          (frame?.brightness || 0) * 100
        )}%.`}
      />
    </div>
  );
}
