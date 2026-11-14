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

  // Preload real NASA frame image
  useEffect(() => {
    if (!frame?.imageUrl) {
      setLoadedImg(null);
      return;
    }

    let active = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = frame.imageUrl;

    img.onload = () => {
      if (active) setLoadedImg(img);
    };

    img.onerror = () => {
      if (active) setLoadedImg(null);
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

    // 2. Real NASA Imagery OR Procedural Planetary Cartography
    if (loadedImg) {
      // Draw actual satellite frame with aspect ratio preservation
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
      vignette.addColorStop(0.85, 'rgba(4, 6, 8, 0.45)');
      vignette.addColorStop(1, 'rgba(4, 6, 8, 0.88)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);
    } else {
      // High-Fidelity Scientific Planetary & Astrophysical Cartography
      const radius = Math.min(width, height) * 0.32;
      const titleLower = (videoTitle || '').toLowerCase();
      const isSolar = datasetCategory === 'Heliophysics' || titleLower.includes('solar');
      const isOzone = datasetCategory === 'Stratosphere' || titleLower.includes('ozone');
      const isSST = datasetCategory === 'Hydrosphere' || titleLower.includes('temperature') || titleLower.includes('sea');
      const isPrecip = datasetCategory === 'Biosphere' || titleLower.includes('precip') || titleLower.includes('gpm');
      const isIce = datasetCategory === 'Cryosphere' || titleLower.includes('ice');

      if (isSolar) {
        // =====================================================================
        // SDO HELIOPHYSICS: THE SUN (AIA 171Å / 304Å EXTREME ULTRAVIOLET)
        // =====================================================================
        // 1. Massive Solar Corona & Plasma Flare Eruptions
        const solarCorona = ctx.createRadialGradient(cx, cy, radius * 0.95, cx, cy, radius * 1.65);
        solarCorona.addColorStop(0, `rgba(255, 178, 125, ${0.45 + brightness * 0.3})`);
        solarCorona.addColorStop(0.35, 'rgba(217, 119, 54, 0.22)');
        solarCorona.addColorStop(0.7, 'rgba(180, 83, 9, 0.08)');
        solarCorona.addColorStop(1, 'rgba(4, 6, 8, 0)');
        ctx.fillStyle = solarCorona;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 1.65, 0, Math.PI * 2);
        ctx.fill();

        // 2. Solar Prominence Magnetic Loops Arching into Space
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 178, 125, 0.55)';
        ctx.lineWidth = 2;
        for (let p = 0; p < 6; p++) {
          const ang = (p * Math.PI) / 3 + frameIndex * 0.01;
          const px1 = cx + Math.cos(ang) * radius;
          const py1 = cy + Math.sin(ang) * radius;
          const px2 = cx + Math.cos(ang + 0.3) * radius;
          const py2 = cy + Math.sin(ang + 0.3) * radius;
          const cpx = cx + Math.cos(ang + 0.15) * (radius * (1.2 + (p % 2) * 0.15));
          const cpy = cy + Math.sin(ang + 0.15) * (radius * (1.2 + (p % 2) * 0.15));
          ctx.beginPath();
          ctx.moveTo(px1, py1);
          ctx.quadraticCurveTo(cpx, cpy, px2, py2);
          ctx.stroke();
        }
        ctx.restore();

        // 3. Solar Photosphere Body Sphere
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

        // Granulation & Active Magnetic Sunspots
        for (let s = 0; s < 12; s++) {
          const spotX = cx + Math.sin(s * 1.7 + frameIndex * 0.02) * radius * 0.7;
          const spotY = cy + Math.cos(s * 2.3) * radius * 0.45;
          const spotR = 6 + (s % 4) * 4;
          const spotGrad = ctx.createRadialGradient(spotX, spotY, 1, spotX, spotY, spotR);
          spotGrad.addColorStop(0, '#1c0a00');
          spotGrad.addColorStop(0.5, '#78350f');
          spotGrad.addColorStop(1, 'rgba(217, 119, 54, 0)');
          ctx.fillStyle = spotGrad;
          ctx.beginPath();
          ctx.arc(spotX, spotY, spotR, 0, Math.PI * 2);
          ctx.fill();
        }

        // Active Flare Eruption Site
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

        // 4. Diffraction Starburst when high flux delta occurs
        if (change > 0.35 || hot > 0.5) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(flareX - 35, flareY);
          ctx.lineTo(flareX + 35, flareY);
          ctx.moveTo(flareX, flareY - 35);
          ctx.lineTo(flareX, flareY + 35);
          ctx.stroke();
        }
      } else {
        // =====================================================================
        // EARTH DATASETS: AUTHENTIC CONTINENTS & DOMAIN PHENOMENON
        // =====================================================================
        // 1. Atmospheric Corona Limb Glow (Calibrated to Spectral Palette)
        const corona = ctx.createRadialGradient(cx, cy, radius * 0.85, cx, cy, radius * 1.35);
        const glowColor = isSST
          ? '31, 111, 96'
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

        // 2. Earth Sphere Body
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.clip();

        // Ocean Base Gradient
        const oceanGrad = ctx.createRadialGradient(
          cx - radius * 0.35,
          cy - radius * 0.3,
          radius * 0.1,
          cx,
          cy,
          radius
        );
        oceanGrad.addColorStop(0, isSST ? '#0f2b38' : '#0c1a2e');
        oceanGrad.addColorStop(0.5, '#081321');
        oceanGrad.addColorStop(0.85, '#040913');
        oceanGrad.addColorStop(1, '#02050a');
        ctx.fillStyle = oceanGrad;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

        // Longitude rotation offset driven by panX & timeline
        const rotX = (panX - 0.5) * radius * 1.4;

        if (isOzone) {
          // --- SOUTH POLAR PROJECTION FOR ANTARCTIC OZONE HOLE ---
          // Antarctica Polar Landmass
          ctx.fillStyle = '#cbd5e1';
          ctx.beginPath();
          ctx.arc(cx, cy, radius * 0.38, 0, Math.PI * 2);
          ctx.fill();

          // Surrounding southern continental tips (South America, Australia, New Zealand)
          ctx.fillStyle = '#334155';
          ctx.beginPath();
          ctx.ellipse(cx - radius * 0.55, cy - radius * 0.45, 18, 32, -0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(cx + radius * 0.6, cy + radius * 0.35, 24, 18, 0.3, 0, Math.PI * 2);
          ctx.fill();

          // Swirling Antarctic Ozone Depletion Hole (< 220 Dobson Units)
          const holeRadius = radius * (0.28 + hot * 0.32);
          const ozoneGrad = ctx.createRadialGradient(cx, cy, 5, cx, cy, holeRadius);
          ozoneGrad.addColorStop(0, 'rgba(147, 51, 234, 0.95)');
          ozoneGrad.addColorStop(0.45, 'rgba(219, 39, 119, 0.75)');
          ozoneGrad.addColorStop(0.8, 'rgba(59, 130, 246, 0.35)');
          ozoneGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
          ctx.fillStyle = ozoneGrad;
          ctx.beginPath();
          ctx.arc(cx, cy, holeRadius, 0, Math.PI * 2);
          ctx.fill();

          // Polar concentric latitude rings
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
          ctx.lineWidth = 1;
          [0.35, 0.6, 0.85].forEach((rMul) => {
            ctx.beginPath();
            ctx.arc(cx, cy, radius * rMul, 0, Math.PI * 2);
            ctx.stroke();
          });
        } else if (isIce) {
          // --- NORTH POLAR PROJECTION FOR ARCTIC SEA ICE ---
          ctx.fillStyle = '#334155';
          // Greenland
          ctx.beginPath();
          ctx.ellipse(cx - radius * 0.35, cy + radius * 0.2, 28, 45, 0.2, 0, Math.PI * 2);
          ctx.fill();
          // Siberia & Eurasia rim
          ctx.beginPath();
          ctx.ellipse(cx + radius * 0.45, cy - radius * 0.35, 70, 28, -0.2, 0, Math.PI * 2);
          ctx.fill();
          // North American rim
          ctx.beginPath();
          ctx.ellipse(cx - radius * 0.45, cy - radius * 0.3, 55, 24, 0.4, 0, Math.PI * 2);
          ctx.fill();

          // Arctic Perennial Sea Ice Pack
          const iceRadius = radius * (0.45 - hot * 0.18);
          const iceGrad = ctx.createRadialGradient(cx, cy - radius * 0.05, 4, cx, cy - radius * 0.05, iceRadius);
          iceGrad.addColorStop(0, '#f8fafc');
          iceGrad.addColorStop(0.65, '#e2e8f0');
          iceGrad.addColorStop(0.88, 'rgba(56, 189, 248, 0.8)');
          iceGrad.addColorStop(1, 'rgba(14, 165, 233, 0)');
          ctx.fillStyle = iceGrad;
          ctx.beginPath();
          ctx.arc(cx, cy - radius * 0.05, iceRadius, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // --- GLOBAL ORTHOGRAPHIC EARTH (FOR SST, PRECIPITATION & CO2 FALLBACK) ---
          // Draw True Continental Silhouettes
          ctx.fillStyle = '#223838';
          ctx.strokeStyle = 'rgba(138, 213, 194, 0.3)';
          ctx.lineWidth = 1;

          // 1. Africa & Europe
          const afX = cx + rotX;
          ctx.beginPath();
          ctx.ellipse(afX, cy + radius * 0.1, radius * 0.22, radius * 0.38, 0.08, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(afX + 5, cy - radius * 0.42, radius * 0.18, radius * 0.16, -0.1, 0, Math.PI * 2);
          ctx.fill();

          // 2. Eurasia (Asia continent)
          const asiaX = afX + radius * 0.45;
          ctx.beginPath();
          ctx.ellipse(asiaX, cy - radius * 0.32, radius * 0.42, radius * 0.26, 0.12, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(asiaX - 10, cy + radius * 0.08, radius * 0.12, radius * 0.16, 0.2, 0, Math.PI * 2);
          ctx.fill();

          // 3. Australia
          const ausX = asiaX + radius * 0.35;
          ctx.beginPath();
          ctx.ellipse(ausX, cy + radius * 0.45, radius * 0.18, radius * 0.14, -0.15, 0, Math.PI * 2);
          ctx.fill();

          // 4. The Americas (North & South America)
          const amX = afX - radius * 0.72;
          ctx.beginPath();
          ctx.ellipse(amX, cy - radius * 0.35, radius * 0.32, radius * 0.25, -0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(amX + radius * 0.12, cy + radius * 0.32, radius * 0.18, radius * 0.34, 0.22, 0, Math.PI * 2);
          ctx.fill();

          ctx.stroke();

          // Thematic Scientific Overlays
          if (isSST) {
            // SEA SURFACE TEMPERATURE ANOMALY: El Niño Equatorial Warm Tongue!
            const elNinoX = cx + (panX - 0.5) * radius * 1.5;
            const elNinoY = cy + radius * 0.05;
            const sstGrad = ctx.createRadialGradient(elNinoX, elNinoY, 4, elNinoX, elNinoY, radius * (0.35 + hot * 0.4));
            sstGrad.addColorStop(0, 'rgba(239, 68, 68, 0.92)');
            sstGrad.addColorStop(0.35, 'rgba(249, 115, 22, 0.8)');
            sstGrad.addColorStop(0.65, 'rgba(234, 179, 8, 0.45)');
            sstGrad.addColorStop(0.85, 'rgba(20, 184, 166, 0.25)');
            sstGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
            ctx.fillStyle = sstGrad;
            ctx.beginPath();
            ctx.ellipse(elNinoX, elNinoY, radius * (0.45 + hot * 0.35), radius * 0.18, 0.05, 0, Math.PI * 2);
            ctx.fill();

            // Thermal Isotherms
            ctx.strokeStyle = 'rgba(249, 115, 22, 0.4)';
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.ellipse(elNinoX, elNinoY, radius * (0.5 + hot * 0.38), radius * 0.22, 0.05, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
          } else if (isPrecip) {
            // GLOBAL PRECIPITATION MEASUREMENT: Cyclone Spiral & Rain Belts!
            const cycloneX = cx + (panX - 0.5) * radius * 1.3;
            const cycloneY = cy - radius * 0.12;
            const rainGrad = ctx.createRadialGradient(cycloneX, cycloneY, 3, cycloneX, cycloneY, radius * (0.3 + hot * 0.35));
            rainGrad.addColorStop(0, '#ffffff');
            rainGrad.addColorStop(0.25, 'rgba(16, 185, 129, 0.9)');
            rainGrad.addColorStop(0.6, 'rgba(6, 182, 212, 0.6)');
            rainGrad.addColorStop(1, 'rgba(14, 165, 233, 0)');
            ctx.fillStyle = rainGrad;

            ctx.save();
            ctx.translate(cycloneX, cycloneY);
            ctx.rotate(frameIndex * 0.05);
            for (let b = 0; b < 3; b++) {
              ctx.rotate((Math.PI * 2) / 3);
              ctx.beginPath();
              ctx.ellipse(25, 0, radius * 0.28, radius * 0.12, 0.3, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          } else {
            // CO2 Plume Heatmap
            const hotspotX = cx + (panX - 0.5) * radius * 1.5;
            const hotspotY = cy - radius * 0.15 + Math.sin(frameIndex * 0.08) * radius * 0.25;
            const hotspotRadius = radius * (0.2 + hot * 0.35);

            const hotGrad = ctx.createRadialGradient(hotspotX, hotspotY, 2, hotspotX, hotspotY, hotspotRadius);
            hotGrad.addColorStop(0, 'rgba(217, 119, 54, 0.9)');
            hotGrad.addColorStop(0.45, 'rgba(217, 119, 54, 0.45)');
            hotGrad.addColorStop(1, 'rgba(217, 119, 54, 0)');

            ctx.fillStyle = hotGrad;
            ctx.beginPath();
            ctx.arc(hotspotX, hotspotY, hotspotRadius, 0, Math.PI * 2);
            ctx.fill();
          }

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
          for (let lon = -75; lon <= 75; lon += 30) {
            const offset = Math.sin((lon * Math.PI) / 180) * radius;
            ctx.beginPath();
            ctx.ellipse(cx + offset * 0.5, cy, Math.abs(offset), radius, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        ctx.restore();
      }
    }

    // 3. Technical Crosshair & Telemetry Readouts
    // Dynamic Crosshair Tracking Activity Center
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
