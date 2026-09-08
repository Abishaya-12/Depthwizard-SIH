import React, { useState, useEffect, useRef } from 'react';
import { TabId } from '../types';
import { createTerrainEngine } from '../../../src/script.js';

interface FlythroughPathProps {
  onNavigate: (tab: TabId) => void;
}

export const FlythroughPath: React.FC<FlythroughPathProps> = ({ onNavigate }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const terrainRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ReturnType<typeof createTerrainEngine> | null>(null);
  const crossSectionRef = useRef<HTMLCanvasElement | null>(null);

  // Flight simulation states
  const [cameraMode, setCameraMode] = useState<'chase' | 'cockpit' | 'orbit' | 'recon'>('chase');
  const [autopilot, setAutopilot] = useState(true);
  const [speedMultiplier, setSpeedMultiplier] = useState(1.0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dynamic telemetry
  const [altitude, setAltitude] = useState(2418);
  const [speed, setSpeed] = useState(142);
  const [heading, setHeading] = useState(84);
  const [pitch, setPitch] = useState(4);
  const [roll, setRoll] = useState(0);

  useEffect(() => {
    if (!terrainRef.current) return;
    engineRef.current = createTerrainEngine(terrainRef.current, { mode: 'flythrough' });
    return () => engineRef.current?.destroy();
  }, []);

  useEffect(() => {
    engineRef.current?.update({ autoRotate: autopilot, speed: speedMultiplier });
  }, [autopilot, speedMultiplier]);

  // Drone internal state
  const droneState = useRef({
    x: 0,
    y: 0,
    z: 2418,
    heading: 84,
    pitch: 4,
    roll: 0,
    speed: 142,
    climbRate: 12,
  });

  const keysPressed = useRef<{ [key: string]: boolean }>({});

  // Keyboard controls listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;

      if (e.key.toLowerCase() === 'c') {
        setCameraMode((prev) => {
          if (prev === 'chase') return 'cockpit';
          if (prev === 'cockpit') return 'orbit';
          if (prev === 'orbit') return 'recon';
          return 'chase';
        });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Main 3D Terrain Flythrough Canvas Renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let flightDistance = 0;

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.parentElement?.clientWidth || window.innerWidth;
      const h = canvas.parentElement?.clientHeight || window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.resetTransform?.();
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const render = () => {
      const w = canvas.parentElement?.clientWidth || window.innerWidth;
      const h = canvas.parentElement?.clientHeight || window.innerHeight;

      // Handle user controls
      const keys = keysPressed.current;
      const d = droneState.current;

      if (keys['w'] || keys['arrowup']) {
        d.pitch = Math.max(-25, d.pitch - 0.5);
      } else if (keys['s'] || keys['arrowdown']) {
        d.pitch = Math.min(25, d.pitch + 0.5);
      } else {
        d.pitch += (4 - d.pitch) * 0.05;
      }

      if (keys['a'] || keys['arrowleft']) {
        d.roll = Math.max(-30, d.roll - 1.2);
        d.heading = (d.heading - 0.6 + 360) % 360;
      } else if (keys['d'] || keys['arrowright']) {
        d.roll = Math.min(30, d.roll + 1.2);
        d.heading = (d.heading + 0.6) % 360;
      } else {
        d.roll += (0 - d.roll) * 0.08;
      }

      if (keys[' ']) {
        d.z = Math.min(3500, d.z + 5);
        d.climbRate = 18;
      } else {
        d.climbRate += (12 - d.climbRate) * 0.05;
      }

      if (keys['shift']) {
        d.speed = Math.min(280, d.speed + 4);
      } else {
        d.speed += (142 * speedMultiplier - d.speed) * 0.05;
      }

      flightDistance += (d.speed / 60) * 0.8;

      // Update exported state
      setAltitude(Math.round(d.z));
      setSpeed(Math.round(d.speed));
      setHeading(Math.round(d.heading));
      setPitch(Math.round(d.pitch));
      setRoll(Math.round(d.roll));

      ctx.clearRect(0, 0, w, h);

      // Sky gradient (deep space lunar atmosphere)
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, '#050b14');
      skyGrad.addColorStop(0.5, '#0a121c');
      skyGrad.addColorStop(1, '#0d1927');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Stars in deep space
      ctx.fillStyle = 'rgba(195, 245, 255, 0.7)';
      for (let s = 0; s < 45; s++) {
        const sx = ((s * 197 + 53) % w);
        const sy = ((s * 113 + 29) % (h * 0.45));
        ctx.fillRect(sx, sy, 1.2, 1.2);
      }

      // Horizon line
      const horizonY = h * 0.52 + d.pitch * 3.5;

      // 3D Wireframe Terrain Mesh (Perspective projection)
      const fov = 340;
      const camY = d.z * 0.35;
      const gridCols = 24;
      const gridRows = 28;
      const cellWidth = 140;
      const cellDepth = 120;

      const project = (x: number, y: number, z: number) => {
        const rotRad = (d.roll * Math.PI) / 180;
        // Apply roll
        const rx = x * Math.cos(rotRad) - (y - camY) * Math.sin(rotRad);
        const ry = x * Math.sin(rotRad) + (y - camY) * Math.cos(rotRad);

        const depth = z;
        if (depth <= 10) return null;
        const scale = fov / depth;
        return {
          px: w / 2 + rx * scale,
          py: horizonY - ry * scale,
          scale,
        };
      };

      const terrainGrid: ({ px: number; py: number; scale: number; h: number } | null)[][] = [];

      for (let r = 0; r < gridRows; r++) {
        terrainGrid[r] = [];
        const zDist = (r + 1) * cellDepth - (flightDistance % cellDepth);

        for (let c = 0; c <= gridCols; c++) {
          const xDist = (c - gridCols / 2) * cellWidth;

          // Terrain elevation function (craters, mountains, ridges)
          const worldZ = zDist + flightDistance;
          const elev =
            Math.sin(worldZ * 0.003 + c * 0.4) * 180 +
            Math.cos(worldZ * 0.0015 - c * 0.2) * 260 +
            Math.sin(c * 0.6) * 120 +
            (Math.abs(c - gridCols / 2) > 6 ? (Math.abs(c - gridCols / 2) - 6) * 90 : 0);

          const proj = project(xDist, elev, zDist);
          terrainGrid[r][c] = proj ? { ...proj, h: elev } : null;
        }
      }

      // Render terrain depth-sorted lines
      for (let r = gridRows - 1; r >= 1; r--) {
        const rowAlpha = Math.max(0.08, 1 - r / gridRows);
        ctx.strokeStyle = `rgba(0, 229, 255, ${rowAlpha * 0.45})`;
        ctx.lineWidth = r < 8 ? 1.5 : 1;

        // Latitudinal lines
        ctx.beginPath();
        let started = false;
        for (let c = 0; c <= gridCols; c++) {
          const pt = terrainGrid[r][c];
          if (!pt) continue;
          if (!started) {
            ctx.moveTo(pt.px, pt.py);
            started = true;
          } else {
            ctx.lineTo(pt.px, pt.py);
          }
        }
        ctx.stroke();

        // Longitudinal lines
        for (let c = 0; c <= gridCols; c += 2) {
          const p1 = terrainGrid[r][c];
          const p2 = terrainGrid[r - 1][c];
          if (p1 && p2) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(76, 214, 251, ${rowAlpha * 0.28})`;
            ctx.moveTo(p1.px, p1.py);
            ctx.lineTo(p2.px, p2.py);
            ctx.stroke();
          }
        }
      }

      // 3D Waypoints along trajectory
      const waypoints = [
        { label: 'WP-01 // ALPHA RIM', dist: 380, xOffset: -60, alt: 2200 },
        { label: 'WP-02 // GULLY BASIN', dist: 980, xOffset: 120, alt: 2400 },
        { label: 'WP-03 // SUMMIT PASS', dist: 1720, xOffset: -40, alt: 2650 },
        { label: 'WP-04 // TARGET BRAVO', dist: 2450, xOffset: 90, alt: 2300 },
      ];

      waypoints.forEach((wp) => {
        const relDist = (wp.dist - (flightDistance % 3000) + 3000) % 3000;
        if (relDist > 60 && relDist < 2600) {
          const proj = project(wp.xOffset * 4, wp.alt * 0.4, relDist);
          if (proj && proj.px > 40 && proj.px < w - 40 && proj.py > 40 && proj.py < h - 40) {
            // Beacon vertical beam
            ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(proj.px, proj.py + 40);
            ctx.lineTo(proj.px, proj.py - 30);
            ctx.stroke();

            // Diamond marker
            ctx.fillStyle = '#00e5ff';
            ctx.beginPath();
            ctx.arc(proj.px, proj.py, 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#c3f5ff';
            ctx.strokeRect(proj.px - 6, proj.py - 6, 12, 12);

            // Label tag
            ctx.font = '10px "JetBrains Mono", monospace';
            ctx.fillStyle = '#c3f5ff';
            ctx.fillText(wp.label, proj.px + 12, proj.py + 3);
          }
        }
      });

      // 3D Drone Model in Chase View
      if (cameraMode === 'chase' || cameraMode === 'orbit') {
        const droneCX = w / 2;
        const droneCY = h * 0.62;
        const rollRad = (d.roll * Math.PI) / 180;

        ctx.save();
        ctx.translate(droneCX, droneCY);
        ctx.rotate(rollRad);

        // Jet / Thruster particle plumes
        const plumeLength = 28 + Math.random() * 16;
        const thrusterY = 16;

        // Left thruster plume
        const leftGlow = ctx.createLinearGradient(-18, thrusterY, -18, thrusterY + plumeLength);
        leftGlow.addColorStop(0, '#ffffff');
        leftGlow.addColorStop(0.2, '#00e5ff');
        leftGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = leftGlow;
        ctx.beginPath();
        ctx.moveTo(-22, thrusterY);
        ctx.lineTo(-14, thrusterY);
        ctx.lineTo(-18, thrusterY + plumeLength);
        ctx.closePath();
        ctx.fill();

        // Right thruster plume
        const rightGlow = ctx.createLinearGradient(18, thrusterY, 18, thrusterY + plumeLength);
        rightGlow.addColorStop(0, '#ffffff');
        rightGlow.addColorStop(0.2, '#00e5ff');
        rightGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = rightGlow;
        ctx.beginPath();
        ctx.moveTo(14, thrusterY);
        ctx.lineTo(22, thrusterY);
        ctx.lineTo(18, thrusterY + plumeLength);
        ctx.closePath();
        ctx.fill();

        // Main Drone Body (Fuselage + Swept Wings)
        ctx.fillStyle = '#080f18';
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 1.8;

        // Delta Wing Shape
        ctx.beginPath();
        ctx.moveTo(0, -22); // Nose
        ctx.lineTo(44, 12);  // Right wingtip
        ctx.lineTo(34, 16);  // Right rear
        ctx.lineTo(18, 14);  // Right thruster mount
        ctx.lineTo(0, 18);   // Center rear
        ctx.lineTo(-18, 14); // Left thruster mount
        ctx.lineTo(-34, 16); // Left rear
        ctx.lineTo(-44, 12); // Left wingtip
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Cockpit canopy glow
        ctx.fillStyle = '#c3f5ff';
        ctx.beginPath();
        ctx.ellipse(0, -6, 6, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // ISRO Wingtip LEDs
        ctx.fillStyle = '#00e5ff';
        ctx.fillRect(-45, 10, 3, 3);
        ctx.fillStyle = '#00daf3';
        ctx.fillRect(42, 10, 3, 3);

        ctx.restore();
      }

      // HUD OVERLAYS: Pitch Ladder & Artificial Horizon
      const hudCX = w / 2;
      const hudCY = h * 0.48;

      ctx.save();
      ctx.translate(hudCX, hudCY);
      ctx.rotate((d.roll * Math.PI) / 180);

      // Pitch ladder rungs
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.65)';
      ctx.fillStyle = '#c3f5ff';
      ctx.lineWidth = 1.2;
      ctx.font = '10px "JetBrains Mono", monospace';

      const rungs = [-15, -10, -5, 0, 5, 10, 15];
      rungs.forEach((deg) => {
        const yPos = (deg - d.pitch) * 4.5;
        if (Math.abs(yPos) < 140) {
          const isHorizon = deg === 0;
          const rungWidth = isHorizon ? 64 : 36;

          ctx.beginPath();
          ctx.moveTo(-rungWidth, yPos);
          ctx.lineTo(-rungWidth / 3, yPos);
          ctx.moveTo(rungWidth / 3, yPos);
          ctx.lineTo(rungWidth, yPos);
          ctx.stroke();

          if (!isHorizon) {
            ctx.fillText(`${Math.abs(deg)}°`, rungWidth + 6, yPos + 3);
            ctx.fillText(`${Math.abs(deg)}°`, -rungWidth - 24, yPos + 3);
          }
        }
      });

      // Flight Path Vector (Boresight) Reticle
      ctx.strokeStyle = '#00e5ff';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.lineTo(-6, 0);
      ctx.moveTo(6, 0);
      ctx.lineTo(16, 0);
      ctx.moveTo(0, -12);
      ctx.lineTo(0, -6);
      ctx.stroke();

      ctx.restore();

      // Top Compass Ribbon Tape
      const compassW = 280;
      const compassX = w / 2 - compassW / 2;
      const compassY = 64;

      ctx.fillStyle = 'rgba(8, 15, 24, 0.75)';
      ctx.fillRect(compassX, compassY, compassW, 26);
      ctx.strokeStyle = 'rgba(59, 73, 76, 0.5)';
      ctx.strokeRect(compassX, compassY, compassW, 26);

      ctx.fillStyle = '#c3f5ff';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';

      for (let hd = -30; hd <= 30; hd += 5) {
        const markHeading = (d.heading + hd + 360) % 360;
        const xPos = w / 2 + hd * 4;

        if (xPos >= compassX + 8 && xPos <= compassX + compassW - 8) {
          ctx.strokeStyle = markHeading % 15 === 0 ? '#00e5ff' : 'rgba(132, 147, 150, 0.6)';
          ctx.beginPath();
          ctx.moveTo(xPos, compassY + (markHeading % 15 === 0 ? 14 : 18));
          ctx.lineTo(xPos, compassY + 24);
          ctx.stroke();

          if (markHeading % 30 === 0) {
            let label = `${markHeading}°`;
            if (markHeading === 0) label = 'N';
            if (markHeading === 90) label = 'E';
            if (markHeading === 180) label = 'S';
            if (markHeading === 270) label = 'W';
            ctx.fillText(label, xPos, compassY + 12);
          }
        }
      }

      // Compass center cursor triangle
      ctx.fillStyle = '#00e5ff';
      ctx.beginPath();
      ctx.moveTo(w / 2, compassY + 26);
      ctx.lineTo(w / 2 - 4, compassY + 32);
      ctx.lineTo(w / 2 + 4, compassY + 32);
      ctx.closePath();
      ctx.fill();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [cameraMode, speedMultiplier]);

  // Mini Radar Proximity Terrain Oscilloscope Cross-Section
  useEffect(() => {
    const canvas = crossSectionRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;
    let animId: number;

    const renderOscilloscope = () => {
      time += 0.04;
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // Grid background
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < w; x += 20) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = 0; y < h; y += 15) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();

      // Terrain profile curve
      ctx.fillStyle = 'rgba(0, 229, 255, 0.12)';
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(0, h);

      for (let x = 0; x <= w; x += 4) {
        const y = h - 16 - Math.sin(x * 0.05 + time) * 14 - Math.cos(x * 0.02 + time * 0.6) * 10;
        ctx.lineTo(x, y);
      }

      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Drone altitude baseline
      const droneY = h * 0.32;
      ctx.strokeStyle = '#ffb4ab';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, droneY);
      ctx.lineTo(w, droneY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Drone icon on oscilloscope
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(w * 0.35, droneY, 3, 0, Math.PI * 2);
      ctx.fill();

      animId = requestAnimationFrame(renderOscilloscope);
    };

    animId = requestAnimationFrame(renderOscilloscope);
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleDropWaypoint = () => {
    setToastMessage('Waypoint WP-05 pinned at Lat 14.0534°N, Lon 77.1048°E, Alt 2,420m');
    setTimeout(() => setToastMessage(null), 3200);
  };

  return (
    <div className="flex flex-col w-full h-[calc(100vh-4rem)] relative overflow-hidden bg-[#080f18] select-none">
      {/* Flight Simulator Viewport Canvas */}
      <div className="relative w-full h-full">
        <div ref={terrainRef} className="absolute inset-0 z-0" aria-label="Generated Three.js flythrough terrain" />
        <canvas ref={canvasRef} className="hidden" />

        {/* Top Control HUD Strip */}
        <div className="absolute top-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 z-30 pointer-events-none">
          {/* Camera Mode Selectors */}
          <div className="flex items-center gap-1.5 bg-[#151c26]/90 backdrop-blur-md p-1 rounded shadow-lg pointer-events-auto border border-[#3b494c]/30">
            <span className="material-symbols-outlined text-[16px] text-[#4cd6fb] px-1">videocam</span>
            <button
              onClick={() => setCameraMode('chase')}
              className={`px-2.5 py-1 rounded font-mono-coordinate text-[11px] transition-all cursor-pointer ${
                cameraMode === 'chase'
                  ? 'bg-[#00e5ff] text-[#00363d] font-bold shadow-[0_0_10px_rgba(0,229,255,0.4)]'
                  : 'text-[#bac9cc] hover:text-white'
              }`}
            >
              CHASE (3RD PERS)
            </button>
            <button
              onClick={() => setCameraMode('cockpit')}
              className={`px-2.5 py-1 rounded font-mono-coordinate text-[11px] transition-all cursor-pointer ${
                cameraMode === 'cockpit'
                  ? 'bg-[#00e5ff] text-[#00363d] font-bold shadow-[0_0_10px_rgba(0,229,255,0.4)]'
                  : 'text-[#bac9cc] hover:text-white'
              }`}
            >
              COCKPIT HUD
            </button>
            <button
              onClick={() => setCameraMode('orbit')}
              className={`px-2.5 py-1 rounded font-mono-coordinate text-[11px] transition-all cursor-pointer ${
                cameraMode === 'orbit'
                  ? 'bg-[#00e5ff] text-[#00363d] font-bold shadow-[0_0_10px_rgba(0,229,255,0.4)]'
                  : 'text-[#bac9cc] hover:text-white'
              }`}
            >
              ORBIT CAM
            </button>
            <button
              onClick={() => setCameraMode('recon')}
              className={`px-2.5 py-1 rounded font-mono-coordinate text-[11px] transition-all cursor-pointer ${
                cameraMode === 'recon'
                  ? 'bg-[#00e5ff] text-[#00363d] font-bold shadow-[0_0_10px_rgba(0,229,255,0.4)]'
                  : 'text-[#bac9cc] hover:text-white'
              }`}
            >
              TOP-DOWN RECON
            </button>
          </div>

          {/* Autopilot & Re-center */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={() => setAutopilot(!autopilot)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#151c26]/90 backdrop-blur-md font-mono-coordinate text-[11px] border transition-all cursor-pointer ${
                autopilot
                  ? 'text-[#00e5ff] border-[#00e5ff]/40 shadow-[0_0_12px_rgba(0,229,255,0.3)]'
                  : 'text-[#849396] border-[#3b494c]/30'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${autopilot ? 'bg-[#00e5ff] animate-ping' : 'bg-[#849396]'}`}></span>
              <span>AUTOPILOT: {autopilot ? 'VECTOR LOCK' : 'MANUAL'}</span>
            </button>

            <button
              onClick={() => {
                droneState.current.pitch = 4;
                droneState.current.roll = 0;
                droneState.current.heading = 84;
              }}
              className="px-3 py-1.5 rounded bg-[#242a34]/90 hover:bg-[#333a44] text-[#dce3f0] font-mono-coordinate text-[11px] backdrop-blur-md border border-[#3b494c]/30 transition-all cursor-pointer flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">center_focus_strong</span>
              <span>RE-CENTER</span>
            </button>
          </div>
        </div>

        {/* Left Flight Data HUD Tapes */}
        <div className="absolute left-6 top-32 bottom-36 flex flex-col justify-between pointer-events-none z-20">
          {/* Airspeed Gauge Tape */}
          <div className="bg-[#080f18]/85 backdrop-blur-md p-2.5 rounded-lg flex flex-col gap-1 border border-[#3b494c]/30 shadow-xl">
            <span className="font-label-caps text-[10px] text-[#849396] uppercase">Airspeed</span>
            <div className="flex items-baseline gap-1">
              <span className="font-headline-md text-[26px] text-white font-bold">{speed}</span>
              <span className="font-mono-coordinate text-[11px] text-[#00e5ff]">m/s</span>
            </div>
            <span className="font-mono-coordinate text-[10px] text-[#4cd6fb]">MACH 0.42</span>
          </div>

          {/* Dynamic Collision Proximity Card & Mini Terrain Profile Oscilloscope */}
          <div className="bg-[#080f18]/90 backdrop-blur-xl p-3 rounded-lg flex flex-col gap-2 border border-[#3b494c]/40 shadow-2xl w-60 pointer-events-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#00e5ff] animate-pulse"></span>
                <span className="font-label-caps text-[10px] text-[#c3f5ff] uppercase font-bold">
                  RADAR PROXIMITY
                </span>
              </div>
              <span className="font-mono-coordinate text-[10px] text-[#00daf3] font-semibold">
                CLEAR (+480m)
              </span>
            </div>

            {/* Terrain Profile Canvas Oscilloscope */}
            <div className="w-full h-16 rounded bg-[#050b14] overflow-hidden border border-[#3b494c]/30">
              <canvas ref={crossSectionRef} width={220} height={64} className="w-full h-full" />
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono-coordinate text-[#bac9cc]">
              <span>MIN V-SEP: +480m</span>
              <span>RUGOSITY: 0.82</span>
            </div>
          </div>
        </div>

        {/* Right Altimeter & Telemetry Tape */}
        <div className="absolute right-6 top-32 bottom-36 flex flex-col justify-between items-end pointer-events-none z-20">
          {/* Altitude Gauge Tape */}
          <div className="bg-[#080f18]/85 backdrop-blur-md p-2.5 rounded-lg flex flex-col items-end gap-1 border border-[#3b494c]/30 shadow-xl">
            <span className="font-label-caps text-[10px] text-[#849396] uppercase">Altitude AGL</span>
            <div className="flex items-baseline gap-1">
              <span className="font-headline-md text-[26px] text-white font-bold">{altitude.toLocaleString()}</span>
              <span className="font-mono-coordinate text-[11px] text-[#00e5ff]">m</span>
            </div>
            <span className="font-mono-coordinate text-[10px] text-[#4cd6fb] flex items-center gap-0.5">
              <span className="material-symbols-outlined text-[13px]">trending_up</span> +12 m/s VVI
            </span>
          </div>

          {/* Trajectory Navigation Vector */}
          <div className="bg-[#080f18]/90 backdrop-blur-xl p-3 rounded-lg flex flex-col gap-1 text-right border border-[#3b494c]/30 shadow-xl w-56">
            <span className="font-label-caps text-[10px] text-[#bac9cc] uppercase">Active Vector Target</span>
            <span className="font-mono-telemetry text-[13px] text-[#c3f5ff] font-semibold">
              WP-02 // GULLY BASIN
            </span>
            <span className="font-mono-coordinate text-[11px] text-[#849396]">
              DIST: <strong className="text-white">980m</strong> • ETA: <strong className="text-[#00e5ff]">00:07s</strong>
            </span>
          </div>
        </div>

        {/* Interactive Toast Notification */}
        {toastMessage && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-[#00e5ff] text-[#00363d] px-4 py-2 rounded-full font-mono-telemetry text-[12px] font-bold shadow-[0_0_24px_rgba(0,229,255,0.7)] flex items-center gap-2 animate-bounce">
            <span className="material-symbols-outlined text-[18px]">push_pin</span>
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Bottom Floating Flight Controls Bar */}
        <div className="absolute bottom-4 left-6 right-6 flex flex-wrap items-center justify-between gap-4 z-30 pointer-events-none">
          {/* Controls keyhint pill */}
          <div className="flex items-center gap-2 bg-[#151c26]/90 backdrop-blur-md px-4 py-2 rounded-full border border-[#3b494c]/30 pointer-events-auto shadow-xl">
            <span className="material-symbols-outlined text-[#00e5ff] text-[18px]">keyboard</span>
            <span className="font-mono-coordinate text-[11px] text-[#c3f5ff]">
              [W/A/S/D] Steering • [SPACE] Ascend • [SHIFT] Boost • [C] Camera
            </span>
          </div>

          {/* Speed multipliers & Waypoint Drop */}
          <div className="flex items-center gap-3 pointer-events-auto">
            {/* Multipliers */}
            <div className="flex items-center bg-[#151c26]/90 backdrop-blur-md p-1 rounded-full border border-[#3b494c]/30 shadow-xl">
              {[0.5, 1.0, 2.0, 4.0].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setSpeedMultiplier(spd)}
                  className={`px-3 py-1 rounded-full font-mono-coordinate text-[11px] transition-all cursor-pointer ${
                    speedMultiplier === spd
                      ? 'bg-[#00e5ff] text-[#00363d] font-bold shadow-sm'
                      : 'text-[#bac9cc] hover:text-white'
                  }`}
                >
                  {spd.toFixed(1)}x
                </button>
              ))}
            </div>

            {/* Pin Waypoint */}
            <button
              onClick={handleDropWaypoint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#242a34] hover:bg-[#333a44] text-[#c3f5ff] font-mono-telemetry text-[12px] transition-all border border-[#3b494c]/40 cursor-pointer shadow-lg active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px] text-[#00e5ff]">add_location_alt</span>
              <span>DROP PIN</span>
            </button>

            {/* Return to Step 04 */}
            <button
              onClick={() => onNavigate('3d-dem-viewer')}
              className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#00e5ff] hover:bg-white text-[#00363d] font-mono-telemetry text-[12px] font-bold transition-all cursor-pointer shadow-[0_0_20px_rgba(0,229,255,0.4)] active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>EXIT SIM</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
