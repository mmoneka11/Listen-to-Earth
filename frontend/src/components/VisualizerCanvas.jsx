import { useEffect, useRef, useState } from 'react';

export default function VisualizerCanvas({ frame, videoTitle, isPlaying, reducedMotion }) {
  const canvasRef = useRef(null);
  const [loadedImg, setLoadedImg] = useState(null);

  // Preload real NASA PNG frame if imageUrl is supplied by manifest/features
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frame) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;

    ctx.clearRect(0, 0, width, height);

    const red = frame.red ?? 56;
    const green = frame.green ?? 189;
    const blue = frame.blue ?? 248;
    const brightness = frame.brightness ?? 0.3;
    const intensity = frame.hot ?? brightness;
    const leftBrightness = frame.left_brightness ?? brightness;
    const rightBrightness = frame.right_brightness ?? brightness;
    const change = frame.change ?? frame.delta ?? 0;
    const frameStep = frame.i ?? frame.frame_number ?? 0;

    const pan =
      frame.audio?.pan !== undefined
        ? frame.audio.pan
        : frame.panX !== undefined
        ? frame.panX * 2 - 1
        : 0;

    const cx = width / 2;
    const cy = height * 0.45;

    // 1. Deep Space Backdrop
    const spaceGrad = ctx.createRadialGradient(cx, cy, 30, cx, cy, width * 0.68);
    spaceGrad.addColorStop(0, '#0B1736');
    spaceGrad.addColorStop(0.55, '#050B1C');
    spaceGrad.addColorStop(1, '#02050E');
    ctx.fillStyle = spaceGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle deterministic starfield
    for (let s = 0; s < 55; s++) {
      const sx = ((s * 173 + 41) % width);
      const sy = ((s * 97 + 23) % (height - 48));
      const starAlpha = 0.14 + ((s % 5) * 0.08);
      ctx.fillStyle = s % 7 === 0 ? `rgba(125, 211, 252, ${starAlpha})` : `rgba(248, 250, 252, ${starAlpha})`;
      ctx.beginPath();
      ctx.arc(sx, sy, s % 9 === 0 ? 1.4 : 0.9, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Real NASA Frame PNG OR Planetary Atmospheric Visualization
    if (loadedImg) {
      ctx.drawImage(loadedImg, 0, 0, width, height);

      // Cinematic edge vignette for clean HUD readability
      const vignette = ctx.createRadialGradient(cx, cy, height * 0.25, cx, cy, width * 0.65);
      vignette.addColorStop(0, 'rgba(3, 7, 18, 0.08)');
      vignette.addColorStop(1, 'rgba(3, 7, 18, 0.84)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);
    } else {
      const globeRadius = Math.min(width, height) * 0.31;

      // Atmospheric outer corona glow (Cyan + Violet + Data RGB)
      const coronaGrad = ctx.createRadialGradient(
        cx,
        cy,
        globeRadius * 0.85,
        cx,
        cy,
        globeRadius * 1.48
      );
      coronaGrad.addColorStop(0, `rgba(56, 189, 248, ${0.22 + brightness * 0.35})`);
      coronaGrad.addColorStop(0.55, `rgba(129, 140, 248, ${0.12 + intensity * 0.18})`);
      coronaGrad.addColorStop(1, 'rgba(3, 7, 18, 0)');
      ctx.fillStyle = coronaGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, globeRadius * 1.48, 0, Math.PI * 2);
      ctx.fill();

      // Clip inside Planetary Sphere
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, globeRadius, 0, Math.PI * 2);
      ctx.clip();

      // Base ocean/planet sphere gradient
      const sphereGrad = ctx.createRadialGradient(
        cx - globeRadius * 0.3,
        cy - globeRadius * 0.3,
        globeRadius * 0.1,
        cx,
        cy,
        globeRadius * 1.15
      );
      sphereGrad.addColorStop(0, '#132A5E');
      sphereGrad.addColorStop(0.65, '#091533');
      sphereGrad.addColorStop(1, '#030816');
      ctx.fillStyle = sphereGrad;
      ctx.fillRect(cx - globeRadius, cy - globeRadius, globeRadius * 2, globeRadius * 2);

      // Left Hemisphere Atmospheric Plume (driven by left_brightness)
      const leftPlume = ctx.createRadialGradient(
        cx - globeRadius * 0.44,
        cy,
        4,
        cx - globeRadius * 0.44,
        cy,
        globeRadius * (0.65 + leftBrightness * 0.65)
      );
      leftPlume.addColorStop(0, `rgba(${red}, ${green}, ${blue}, ${0.45 + leftBrightness * 0.5})`);
      leftPlume.addColorStop(0.6, `rgba(45, 212, 191, ${0.18 + leftBrightness * 0.25})`);
      leftPlume.addColorStop(1, 'rgba(9, 21, 51, 0)');
      ctx.fillStyle = leftPlume;
      ctx.fillRect(cx - globeRadius, cy - globeRadius, globeRadius * 2, globeRadius * 2);

      // Right Hemisphere Atmospheric Plume (driven by right_brightness)
      const rightPlume = ctx.createRadialGradient(
        cx + globeRadius * 0.44,
        cy,
        4,
        cx + globeRadius * 0.44,
        cy,
        globeRadius * (0.65 + rightBrightness * 0.65)
      );
      rightPlume.addColorStop(0, `rgba(${red}, ${green}, ${blue}, ${0.45 + rightBrightness * 0.5})`);
      rightPlume.addColorStop(0.6, `rgba(129, 140, 248, ${0.18 + rightBrightness * 0.25})`);
      rightPlume.addColorStop(1, 'rgba(9, 21, 51, 0)');
      ctx.fillStyle = rightPlume;
      ctx.fillRect(cx - globeRadius, cy - globeRadius, globeRadius * 2, globeRadius * 2);

      // Scientific Latitude & Longitude Graticule Lines
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.14)';
      ctx.lineWidth = 1;
      for (let lat = -2; lat <= 2; lat++) {
        const yOffset = (lat / 3) * globeRadius;
        const halfChord = Math.sqrt(Math.max(0, globeRadius * globeRadius - yOffset * yOffset));
        ctx.beginPath();
        ctx.moveTo(cx - halfChord, cy + yOffset);
        ctx.lineTo(cx + halfChord, cy + yOffset);
        ctx.stroke();
      }
      const rotShift = reducedMotion ? 0 : (frameStep * 0.18) % 1;
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
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.42)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 3. Orbital Telemetry Track & Stereo Pan Reticle
    const orbitRx = Math.min(width * 0.39, 330);
    const orbitRy = Math.min(height * 0.16, 56);

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, orbitRx, orbitRy, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.18)';
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    const panNorm = (Math.max(-1, Math.min(1, pan)) + 1) / 2;
    const beaconX = cx - orbitRx + panNorm * (orbitRx * 2);
    const normOffset = (beaconX - cx) / orbitRx;
    const beaconY = cy + Math.sqrt(Math.max(0, 1 - normOffset * normOffset)) * (orbitRy * 0.45);
    const pulseRadius = reducedMotion ? 18 : 16 + intensity * 24 + change * 34;

    // Reticle halo
    ctx.beginPath();
    ctx.arc(beaconX, beaconY, pulseRadius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(56, 189, 248, ${isPlaying ? 0.24 : 0.14})`;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(beaconX, beaconY, pulseRadius * 0.62, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(45, 212, 191, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Active focal point
    ctx.beginPath();
    ctx.arc(beaconX, beaconY, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = '#F8FAFC';
    ctx.fill();

    // 4. Smooth Harmonic Audio Waveform at Bottom
    const waveY = height - 46;
    const waveWidth = width - 96;
    const startX = 48;

    ctx.beginPath();
    for (let x = 0; x <= waveWidth; x += 4) {
      const progress = x / waveWidth;
      const envelope = Math.sin(progress * Math.PI);
      const freq1 = Math.sin(progress * Math.PI * 10 + frameStep * 1.4);
      const freq2 = Math.cos(progress * Math.PI * 18 - frameStep * 0.9);
      const amp =
        (reducedMotion ? 6 : 8 + brightness * 18 + change * 22) *
        (isPlaying ? 1 : 0.45) *
        envelope;
      const y = waveY + (freq1 * 0.65 + freq2 * 0.35) * amp;
      if (x === 0) ctx.moveTo(startX + x, y);
      else ctx.lineTo(startX + x, y);
    }
    const waveGrad = ctx.createLinearGradient(startX, waveY, startX + waveWidth, waveY);
    waveGrad.addColorStop(0, 'rgba(56, 189, 248, 0.2)');
    waveGrad.addColorStop(0.5, '#38BDF8');
    waveGrad.addColorStop(1, '#2DD4BF');
    ctx.strokeStyle = waveGrad;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 5. Minimal Corner Reticle Brackets
    const bLen = 12;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    ctx.lineWidth = 1.5;
    // Top-left & Top-right
    ctx.beginPath();
    ctx.moveTo(14, 14 + bLen);
    ctx.lineTo(14, 14);
    ctx.lineTo(14 + bLen, 14);
    ctx.moveTo(width - 14 - bLen, 14);
    ctx.lineTo(width - 14, 14);
    ctx.lineTo(width - 14, 14 + bLen);
    // Bottom-left & Bottom-right
    ctx.moveTo(14, height - 14 - bLen);
    ctx.lineTo(14, height - 14);
    ctx.lineTo(14 + bLen, height - 14);
    ctx.moveTo(width - 14 - bLen, height - 14);
    ctx.lineTo(width - 14, height - 14);
    ctx.lineTo(width - 14, height - 14 - bLen);
    ctx.stroke();

    // 6. Clean Scientific Telemetry Overlay
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94A3B8';
    ctx.textAlign = 'left';
    ctx.fillText(
      frame.left_brightness !== undefined
        ? `WEST HEMISPHERE · ${(leftBrightness * 100).toFixed(0)}%`
        : `LUMINANCE · ${(brightness * 100).toFixed(0)}%`,
      28,
      29
    );

    ctx.textAlign = 'right';
    ctx.fillText(
      frame.right_brightness !== undefined
        ? `EAST HEMISPHERE · ${(rightBrightness * 100).toFixed(0)}%`
        : `SIGNAL INTENSITY · ${(intensity * 100).toFixed(0)}%`,
      width - 28,
      29
    );

    const noteLabel = frame.audio
      ? `${frame.audio.note}${frame.audio.octave}`
      : `HUE ${Math.round(frame.hue ?? 0)}°`;
    const rhythmLabel = frame.audio?.rhythm
      ? frame.audio.rhythm.toUpperCase()
      : `DELTA ${change.toFixed(2)}`;

    ctx.textAlign = 'center';
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText(
      `TONE ${noteLabel}   |   STEREO PAN ${pan >= 0 ? '+' : ''}${pan.toFixed(2)}   |   ${rhythmLabel}`,
      cx,
      height - 14
    );
  }, [frame, loadedImg, isPlaying, reducedMotion]);

  return (
    <div className="canvas-shell">
      <canvas
        ref={canvasRef}
        width={900}
        height={390}
        role="img"
        aria-label={`Scientific planetary visualization for ${videoTitle}. ${frame?.caption || ''}`}
      />
    </div>
  );
}