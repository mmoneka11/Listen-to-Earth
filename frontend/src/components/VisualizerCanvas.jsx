import { useEffect, useRef, useState } from 'react';

const CATEGORY_COLORS = {
  co2: { r: 217, g: 119, b: 54, hex: '#d97736' },
  sst: { r: 31, g: 140, b: 160, hex: '#1f8ca0' },
  ozone: { r: 147, g: 51, b: 234, hex: '#9333ea' },
  precip: { r: 56, g: 189, b: 248, hex: '#38bdf8' },
  solar: { r: 249, g: 115, b: 22, hex: '#f97316' },
  ice: { r: 166, g: 241, b: 222, hex: '#a6f1de' },
};

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

  // Preload real NASA frame image (for DYAMOND CO2 or any dataset with video frames)
  useEffect(() => {
    if (!frame?.imageUrl) {
      setLoadedImg(null);
      return;
    }

    const url = frame.imageUrl;

    if (imgCache.current.has(url)) {
      setLoadedImg(imgCache.current.get(url));
      return;
    }

    let active = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;

    img.onload = () => {
      imgCache.current.set(url, img);
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

    // Color theme matching the active scientific domain
    const key = (videoTitle || '').toLowerCase();
    const theme =
      key.includes('temperature') || key.includes('sst')
        ? CATEGORY_COLORS.sst
        : key.includes('ozone')
        ? CATEGORY_COLORS.ozone
        : key.includes('precip') || key.includes('gpm')
        ? CATEGORY_COLORS.precip
        : key.includes('solar') || key.includes('flare')
        ? CATEGORY_COLORS.solar
        : key.includes('ice')
        ? CATEGORY_COLORS.ice
        : CATEGORY_COLORS.co2;

    const red = theme.r;
    const green = theme.g;
    const blue = theme.b;
    const brightness = frame.brightness ?? 0.5;
    const intensity = frame.hot ?? brightness;
    const change = frame.delta ?? frame.change ?? 0;
    const panX = frame.panX ?? 0.5;
    const frameIndex = frame.i ?? 0;
    const pan = (panX - 0.5) * 2;

    const cx = width / 2;
    const cy = height * 0.46;

    // 1. Deep Space Matte Background with Grid & Starfield
    const spaceGrad = ctx.createRadialGradient(cx, cy, 30, cx, cy, width * 0.72);
    spaceGrad.addColorStop(0, '#0a101d');
    spaceGrad.addColorStop(0.6, '#060a12');
    spaceGrad.addColorStop(1, '#030508');
    ctx.fillStyle = spaceGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle deterministic starfield
    for (let s = 0; s < 45; s++) {
      const sx = (s * 173 + 41) % width;
      const sy = (s * 97 + 23) % (height - 48);
      const starAlpha = 0.12 + (s % 5) * 0.07;
      ctx.fillStyle = s % 7 === 0 ? `rgba(${red}, ${green}, ${blue}, ${starAlpha})` : `rgba(248, 250, 252, ${starAlpha})`;
      ctx.beginPath();
      ctx.arc(sx, sy, s % 9 === 0 ? 1.4 : 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Coordinate telemetry grid lines
    ctx.strokeStyle = 'rgba(75, 86, 99, 0.12)';
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

    // 2. Real NASA Planetary Imagery OR High-Fidelity Scientific Atmospheric Radar
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
      // Authentic Scientific Planetary Radar Sphere
      const globeRadius = Math.min(width, height) * 0.32;

      // Atmospheric outer corona glow (Domain Spectral Palette)
      const coronaGrad = ctx.createRadialGradient(
        cx,
        cy,
        globeRadius * 0.85,
        cx,
        cy,
        globeRadius * 1.45
      );
      coronaGrad.addColorStop(0, `rgba(${red}, ${green}, ${blue}, ${0.28 + brightness * 0.3})`);
      coronaGrad.addColorStop(0.55, `rgba(${red}, ${green}, ${blue}, ${0.1 + intensity * 0.15})`);
      coronaGrad.addColorStop(1, 'rgba(3, 7, 18, 0)');
      ctx.fillStyle = coronaGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, globeRadius * 1.45, 0, Math.PI * 2);
      ctx.fill();

      // Clip inside Planetary Sphere
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, globeRadius, 0, Math.PI * 2);
      ctx.clip();

      // Base planetary deep sphere gradient
      const sphereGrad = ctx.createRadialGradient(
        cx - globeRadius * 0.3,
        cy - globeRadius * 0.3,
        globeRadius * 0.1,
        cx,
        cy,
        globeRadius * 1.15
      );
      sphereGrad.addColorStop(0, '#0d2238');
      sphereGrad.addColorStop(0.55, '#071320');
      sphereGrad.addColorStop(1, '#02060b');
      ctx.fillStyle = sphereGrad;
      ctx.fillRect(cx - globeRadius, cy - globeRadius, globeRadius * 2, globeRadius * 2);

      // Atmospheric Plume (Left/West Hemisphere)
      const leftPlumeX = cx - globeRadius * 0.38;
      const leftPlume = ctx.createRadialGradient(
        leftPlumeX,
        cy,
        4,
        leftPlumeX,
        cy,
        globeRadius * (0.6 + brightness * 0.5)
      );
      leftPlume.addColorStop(0, `rgba(${red}, ${green}, ${blue}, ${0.4 + (1 - panX) * 0.4})`);
      leftPlume.addColorStop(0.55, `rgba(${red}, ${green}, ${blue}, 0.12)`);
      leftPlume.addColorStop(1, 'rgba(2, 6, 11, 0)');
      ctx.fillStyle = leftPlume;
      ctx.fillRect(cx - globeRadius, cy - globeRadius, globeRadius * 2, globeRadius * 2);

      // Atmospheric Plume (Right/East Hemisphere)
      const rightPlumeX = cx + globeRadius * 0.38;
      const rightPlume = ctx.createRadialGradient(
        rightPlumeX,
        cy,
        4,
        rightPlumeX,
        cy,
        globeRadius * (0.6 + intensity * 0.5)
      );
      rightPlume.addColorStop(0, `rgba(${red}, ${green}, ${blue}, ${0.4 + panX * 0.4})`);
      rightPlume.addColorStop(0.55, `rgba(${red}, ${green}, ${blue}, 0.12)`);
      rightPlume.addColorStop(1, 'rgba(2, 6, 11, 0)');
      ctx.fillStyle = rightPlume;
      ctx.fillRect(cx - globeRadius, cy - globeRadius, globeRadius * 2, globeRadius * 2);

      // Dynamic Planetary Meridian / Equatorial Graticule Lines
      ctx.strokeStyle = `rgba(${red}, ${green}, ${blue}, 0.2)`;
      ctx.lineWidth = 1;
      for (let lat = -2; lat <= 2; lat++) {
        const yOffset = (lat / 3) * globeRadius;
        const halfChord = Math.sqrt(Math.max(0, globeRadius * globeRadius - yOffset * yOffset));
        ctx.beginPath();
        ctx.moveTo(cx - halfChord, cy + yOffset);
        ctx.lineTo(cx + halfChord, cy + yOffset);
        ctx.stroke();
      }

      const rotShift = reducedMotion ? 0 : (frameIndex * 0.05) % 1;
      [-0.65, -0.22, 0.22, 0.65].forEach((lon) => {
        const curveX = Math.max(-0.92, Math.min(0.92, lon + (rotShift - 0.5) * 0.25));
        ctx.beginPath();
        ctx.ellipse(
          cx,
          cy,
          Math.abs(curveX) * globeRadius,
          globeRadius,
          0,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      });

      ctx.restore();

      // Crisp Planetary Rim Border
      ctx.beginPath();
      ctx.arc(cx, cy, globeRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${red}, ${green}, ${blue}, 0.5)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 3. Orbital Telemetry Track & Stereo Pan Reticle
    const orbitRx = Math.min(width * 0.39, 340);
    const orbitRy = Math.min(height * 0.17, 60);

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, orbitRx, orbitRy, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${red}, ${green}, ${blue}, 0.18)`;
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    const panNorm = (Math.max(-1, Math.min(1, pan)) + 1) / 2;
    const beaconX = cx - orbitRx + panNorm * (orbitRx * 2);
    const normOffset = (beaconX - cx) / orbitRx;
    const beaconY = cy + Math.sqrt(Math.max(0, 1 - normOffset * normOffset)) * (orbitRy * 0.45);
    const pulseRadius = reducedMotion ? 18 : 16 + intensity * 20 + change * 28;

    // Reticle halo
    ctx.beginPath();
    ctx.arc(beaconX, beaconY, pulseRadius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${red}, ${green}, ${blue}, ${isPlaying ? 0.22 : 0.12})`;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(beaconX, beaconY, pulseRadius * 0.6, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${red}, ${green}, ${blue}, 0.8)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Active focal beacon point
    ctx.beginPath();
    ctx.arc(beaconX, beaconY, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // 4. Real-time Acoustic Waveform Strip across bottom of viewport
    ctx.strokeStyle = theme.hex;
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

    // 5. Scientific Telemetry HUD Readouts
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
    ctx.fillText(`FLUX DELTA: Δ ${change.toFixed(2)}`, width - 24, 46);
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
