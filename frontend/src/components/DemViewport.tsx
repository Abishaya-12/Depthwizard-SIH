import React, { useState, useEffect, useRef } from 'react';
import { TabId } from '../types';
import { createTerrainEngine } from '../../../src/script.js';

interface DemViewportProps {
  onNavigate: (tab: TabId) => void;
  previewImage?: string | null;
}

export const DemViewport: React.FC<DemViewportProps> = ({ onNavigate, previewImage }) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const terrainRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ReturnType<typeof createTerrainEngine> | null>(null);

  // Orbit state
  const [rotX, setRotX] = useState(50);
  const [rotZ, setRotZ] = useState(242);
  const [autoRotate, setAutoRotate] = useState(true);
  const [renderMode, setRenderMode] = useState<'wireframe' | 'hillshade' | 'slope'>('wireframe');
  
  // Shading settings
  const [solarAzimuth, setSolarAzimuth] = useState(315);
  const [solarZenith, setSolarZenith] = useState(42);
  const [zExaggeration, setZExaggeration] = useState(0.7);
  const [cursorAlt, setCursorAlt] = useState(1420);
  const [cursorPinTop, setCursorPinTop] = useState(48);

  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!terrainRef.current) return;
    engineRef.current = createTerrainEngine(terrainRef.current, {
      mode: 'viewer',
      wireframe: true,
      heightMap: previewImage ?? undefined,
    });
    return () => engineRef.current?.destroy();
  }, [previewImage]);

  useEffect(() => {
    engineRef.current?.update({
      autoRotate,
      wireframe: renderMode === 'wireframe',
      displacementScale: zExaggeration,
    });
  }, [autoRotate, renderMode, zExaggeration]);

  // Continuous auto-rotation
  useEffect(() => {
    let animId: number;
    const loop = () => {
      if (autoRotate && !isDraggingRef.current) {
        setRotZ((prev) => (prev + 0.35) % 360);
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [autoRotate]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;
    isDraggingRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        const dx = e.clientX - lastMouseRef.current.x;
        const dy = e.clientY - lastMouseRef.current.y;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };

        setRotZ((prev) => (prev + dx * 0.5 + 360) % 360);
        setRotX((prev) => Math.max(10, Math.min(85, prev - dy * 0.4)));
      }

      if (stageRef.current) {
        const rect = stageRef.current.getBoundingClientRect();
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          const relY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
          const simAlt = Math.round(2894 - relY * (2894 - 142));
          setCursorAlt(simAlt);
          setCursorPinTop(relY * 100);
        }
      }
    };

    const handleWindowMouseUp = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, []);

  const setPreset = (pX: number, pZ: number) => {
    setRotX(pX);
    setRotZ(pZ);
  };

  return (
    <div className="flex flex-col w-full p-4 lg:p-6 gap-4">
      {/* Top Pipeline Navigation & State Bar */}
      <section className="w-full bg-[#19202a]/70 backdrop-blur-md rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 shadow-lg border border-[#3b494c]/20">
        <div className="flex items-center gap-4 min-w-max">
          <div className="w-10 h-10 rounded-full bg-[#00e5ff]/20 flex items-center justify-center text-[#00e5ff]">
            <span className="material-symbols-outlined text-[24px]">view_in_ar</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-label-caps text-[10px] text-[#4cd6fb] uppercase tracking-wider">
                Mission Workflow Stage
              </span>
              <span className="px-2 py-0.5 rounded bg-[#00e5ff] text-[#00363d] font-label-caps text-[10px] font-bold">
                ACTIVE PHASE
              </span>
            </div>
            <span className="font-headline-sm text-[18px] text-[#dce3f0] font-semibold">
              Step 04 : Absolute DEM Spatial Viewport
            </span>
          </div>
        </div>

        {/* Pipeline Steps Ribbon */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 xl:pb-0">
          <button 
            onClick={() => onNavigate('setup-upload')}
            className="flex items-center gap-1.5 opacity-60 hover:opacity-100 cursor-pointer"
          >
            <span className="w-5 h-5 rounded-full bg-[#242a34] flex items-center justify-center font-mono-coordinate text-[11px] text-[#dce3f0]">1</span>
            <span className="font-mono-telemetry text-[13px] text-[#bac9cc] hidden md:inline">Ingestion</span>
            <span className="w-6 h-[1px] bg-[#3b494c]"></span>
          </button>
          <button 
            onClick={() => onNavigate('setup-upload')}
            className="flex items-center gap-1.5 opacity-60 hover:opacity-100 cursor-pointer"
          >
            <span className="w-5 h-5 rounded-full bg-[#242a34] flex items-center justify-center font-mono-coordinate text-[11px] text-[#dce3f0]">2</span>
            <span className="font-mono-telemetry text-[13px] text-[#bac9cc] hidden md:inline">Setup</span>
            <span className="w-6 h-[1px] bg-[#3b494c]"></span>
          </button>
          <button 
            onClick={() => onNavigate('map-generated')}
            className="flex items-center gap-1.5 opacity-60 hover:opacity-100 cursor-pointer"
          >
            <span className="w-5 h-5 rounded-full bg-[#242a34] flex items-center justify-center font-mono-coordinate text-[11px] text-[#dce3f0]">3</span>
            <span className="font-mono-telemetry text-[13px] text-[#bac9cc] hidden md:inline">Mesh Gen</span>
            <span className="w-6 h-[1px] bg-[#3b494c]"></span>
          </button>
          <div className="flex items-center gap-1.5 bg-[#2e353f]/80 px-3 py-1.5 rounded shadow-inner border border-[#00e5ff]/30">
            <span className="w-5 h-5 rounded-full bg-[#00e5ff] text-[#00363d] flex items-center justify-center font-mono-coordinate text-[11px] font-bold">4</span>
            <span className="font-mono-telemetry text-[13px] text-[#c3f5ff] font-semibold">3D DEM Viewer</span>
            <span className="w-2 h-2 rounded-full bg-[#00e5ff] animate-ping ml-1"></span>
          </div>
          <button 
            onClick={() => onNavigate('3d-flythrough')}
            className="flex items-center gap-1.5 opacity-60 hover:opacity-100 cursor-pointer ml-1"
          >
            <span className="w-6 h-[1px] bg-[#3b494c]"></span>
            <span className="w-5 h-5 rounded-full bg-[#242a34] flex items-center justify-center font-mono-coordinate text-[11px] text-[#dce3f0]">5</span>
            <span className="font-mono-telemetry text-[13px] text-[#bac9cc] hidden md:inline">Trajectory</span>
          </button>
        </div>
      </section>

      {/* Main Spatial Stage Grid */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Viewport Stage (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div 
            ref={stageRef}
            onMouseDown={handleMouseDown}
            className="relative w-full h-[620px] rounded-xl bg-[#050b14] overflow-hidden select-none cursor-grab active:cursor-grabbing shadow-2xl flex items-center justify-center perspective-stage border border-[#3b494c]/30"
          >
            <div ref={terrainRef} className="absolute inset-0 z-10" aria-label="Generated Three.js terrain model" />
            {/* Background Ambient Canvas Grid Pattern */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#c3f5ff]/15 via-[#080f18] to-[#050b14] opacity-35 z-20 pointer-events-none"></div>
            <div 
              className="absolute inset-0 opacity-20 pointer-events-none z-20" 
              style={{ 
                backgroundImage: 'linear-gradient(rgba(0, 229, 255, 0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 229, 255, 0.25) 1px, transparent 1px)', 
                backgroundSize: '32px 32px' 
              }}
            ></div>

            {/* Ambient Axis Rings */}
            <div className="absolute w-[560px] h-[560px] rounded-full border border-[#c3f5ff]/10 pointer-events-none"></div>
            <div className="absolute w-[440px] h-[440px] rounded-full border border-[#4cd6fb]/15 border-dashed pointer-events-none"></div>

            {/* Top HUD Header Inside Viewport */}
            <div className="absolute top-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2 pointer-events-none z-30">
              <div className="flex items-center gap-2 bg-[#151c26]/85 backdrop-blur-md px-3 py-1.5 rounded shadow-md pointer-events-auto border border-[#3b494c]/30">
                <span className="w-2 h-2 rounded-full bg-[#4cd6fb] animate-pulse"></span>
                <span className="font-mono-coordinate text-[11px] text-[#c3f5ff] uppercase">
                  CAMERA ORBIT : 360° SPHERICAL
                </span>
                <span className="font-mono-coordinate text-[11px] text-[#bac9cc]">|</span>
                <span className="font-mono-coordinate text-[11px] text-[#dce3f0] font-semibold">
                  AZIM: {Math.round(rotZ)}° PITCH: {Math.round(rotX)}°
                </span>
              </div>

              <div className="flex items-center gap-1.5 bg-[#151c26]/85 backdrop-blur-md p-1 rounded shadow-md pointer-events-auto border border-[#3b494c]/30">
                {/* 360 Auto-Rotate Toggle */}
                <button 
                  onClick={() => setAutoRotate(!autoRotate)}
                  className={`px-3 py-1 rounded font-mono-coordinate text-[11px] transition-all flex items-center gap-1.5 cursor-pointer border ${
                    autoRotate 
                      ? 'text-[#00e5ff] bg-[#2e353f] hover:bg-[#333a44] border-[#c3f5ff]/30 shadow-sm'
                      : 'text-[#bac9cc] hover:text-[#dce3f0] bg-[#19202a] border-[#3b494c]/30'
                  }`}
                >
                  <span className={`material-symbols-outlined text-[15px] ${autoRotate ? 'animate-spin' : ''}`}>sync</span>
                  <span>AUTO-ROTATE 360°: {autoRotate ? 'ON' : 'OFF'}</span>
                </button>

                <button 
                  onClick={() => setRenderMode('wireframe')}
                  className={`px-2.5 py-1 rounded font-mono-coordinate text-[11px] transition-all cursor-pointer ${
                    renderMode === 'wireframe' ? 'text-[#c3f5ff] bg-[#242a34] font-bold' : 'text-[#bac9cc] hover:text-[#dce3f0]'
                  }`}
                >
                  WIREFRAME
                </button>
                <button 
                  onClick={() => setRenderMode('hillshade')}
                  className={`px-2.5 py-1 rounded font-mono-coordinate text-[11px] transition-all cursor-pointer ${
                    renderMode === 'hillshade' ? 'text-[#c3f5ff] bg-[#242a34] font-bold' : 'text-[#bac9cc] hover:text-[#dce3f0]'
                  }`}
                >
                  HILLSHADE
                </button>
                <button 
                  onClick={() => setRenderMode('slope')}
                  className={`px-2.5 py-1 rounded font-mono-coordinate text-[11px] transition-all cursor-pointer ${
                    renderMode === 'slope' ? 'text-[#c3f5ff] bg-[#242a34] font-bold' : 'text-[#bac9cc] hover:text-[#dce3f0]'
                  }`}
                >
                  SLOPE HEATMAP
                </button>
              </div>
            </div>

            {/* 3D Transform Viewport Root */}
            <div className="relative w-[500px] h-[500px] flex items-center justify-center preserve-3d">
              <div 
                className="relative w-[480px] h-[480px] flex items-center justify-center preserve-3d transition-transform ease-out will-change-transform shadow-[0_0_80px_rgba(0,229,255,0.15)] rounded-2xl"
                style={{ 
                  transform: `rotateX(${rotX}deg) rotateZ(${rotZ}deg)`,
                  scale: `${zExaggeration}`
                }}
              >
                {/* Radial Glow Platform */}
                <div className="absolute -inset-6 rounded-full bg-gradient-to-b from-[#c3f5ff]/20 via-[#c3f5ff]/5 to-transparent blur-xl pointer-events-none"></div>

                {/* Shaded Relief Topography Plate */}
                <div className={`absolute inset-0 rounded-2xl transition-all border shadow-[inset_0_0_40px_rgba(0,229,255,0.2)] opacity-95 ${
                  renderMode === 'slope' 
                    ? 'bg-gradient-to-tr from-[#93000a] via-[#004e5f] to-[#00daf3] border-[#ffb4ab]/40'
                    : renderMode === 'hillshade'
                    ? 'bg-gradient-to-tr from-[#050b14] via-[#19202a] to-[#333a44] border-[#bac9cc]/30'
                    : 'bg-gradient-to-tr from-[#080f18] via-[#151c26] to-[#19202a] border-[#00e5ff]/30'
                }`}></div>

                {/* 3D Multi-Layered Elevation SVG */}
                <svg className="absolute inset-0 w-full h-full text-[#00e5ff]" fill="none" viewBox="0 0 480 480">
                  <defs>
                    <linearGradient id="demGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#00daf3" stopOpacity="0.25" />
                      <stop offset="50%" stopColor="#00e5ff" stopOpacity="0.85" />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity="1.0" />
                    </linearGradient>
                    <linearGradient id="craterGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#050b14" stopOpacity="0.85" />
                    </linearGradient>
                    <radialGradient id="domeGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.3" />
                      <stop offset="60%" stopColor="#00daf3" stopOpacity="0.08" />
                      <stop offset="100%" stopColor="#000000" stopOpacity="0" />
                    </radialGradient>
                    <pattern id="microGrid360" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#00daf3" strokeWidth="0.5" strokeOpacity="0.3"></path>
                    </pattern>
                  </defs>

                  <rect width="100%" height="100%" rx="16" fill="url(#microGrid360)"></rect>
                  <rect width="100%" height="100%" rx="16" fill="url(#domeGlow)"></rect>

                  {/* Concentric Terrain Rings */}
                  <circle cx="240" cy="240" r="215" stroke="#00daf3" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.4"></circle>
                  <circle cx="240" cy="240" r="185" stroke="#00e5ff" strokeWidth="1" opacity="0.6"></circle>
                  <circle cx="240" cy="240" r="150" stroke="#00e5ff" strokeWidth="1.2" strokeDasharray="4 2" opacity="0.75"></circle>

                  {/* Caldera / Impact Crater Rim Geometry */}
                  <ellipse cx="240" cy="235" rx="125" ry="90" stroke="#00e5ff" strokeWidth="1.8" strokeOpacity="0.9"></ellipse>
                  <ellipse cx="240" cy="230" rx="100" ry="72" stroke="#4cd6fb" strokeWidth="2" strokeOpacity="0.9"></ellipse>
                  <ellipse cx="242" cy="225" rx="75" ry="54" stroke="#9cf0ff" strokeWidth="2.2" strokeOpacity="0.95"></ellipse>
                  <ellipse cx="244" cy="220" rx="52" ry="38" stroke="#ffffff" strokeWidth="2.5"></ellipse>
                  <ellipse cx="245" cy="216" rx="30" ry="22" fill="url(#craterGlow)" stroke="#00daf3" strokeWidth="1.8"></ellipse>

                  {/* Splines */}
                  <path d="M 30 240 C 90 190, 150 250, 240 190 C 310 140, 390 180, 450 140" stroke="url(#demGradient)" strokeWidth="1.5" strokeDasharray="3 3"></path>
                  <path d="M 40 290 C 110 230, 170 300, 250 230 C 330 170, 400 230, 450 200" stroke="url(#demGradient)" strokeWidth="1.4"></path>
                  <path d="M 50 340 C 130 280, 190 350, 270 280 C 340 220, 410 290, 440 270" stroke="url(#demGradient)" strokeWidth="1.2" strokeOpacity="0.8"></path>
                  <path d="M 80 140 Q 180 80 280 120 T 430 90" stroke="#00daf3" strokeWidth="1.2" opacity="0.7"></path>
                  <path d="M 120 400 C 180 350, 270 410, 340 360 C 400 320, 430 350, 460 330" stroke="#4cd6fb" strokeWidth="1" opacity="0.6"></path>

                  {/* Elevation Callout: Peak (+2,894m ASL) */}
                  <g transform="translate(245, 185)">
                    <line x1="0" y1="0" x2="0" y2="-48" stroke="#ffffff" strokeWidth="1.8"></line>
                    <circle cx="0" cy="-48" r="4" fill="#00e5ff"></circle>
                    <rect x="8" y="-60" width="118" height="24" rx="3" fill="#050b14" fillOpacity="0.95" stroke="#00e5ff" strokeWidth="0.8" strokeOpacity="0.5"></rect>
                    <text x="14" y="-44" fill="#c3f5ff" fontFamily="JetBrains Mono" fontSize="9.5" fontWeight="700">PEAK: +2,894m ASL</text>
                  </g>

                  {/* Elevation Callout: Basin Rim (+142m) */}
                  <g transform="translate(130, 295)">
                    <line x1="0" y1="0" x2="0" y2="-32" stroke="#4cd6fb" strokeWidth="1.2" strokeDasharray="2 2"></line>
                    <circle cx="0" cy="-32" r="3" fill="#4cd6fb"></circle>
                    <rect x="8" y="-43" width="98" height="22" rx="3" fill="#050b14" fillOpacity="0.95" stroke="#4cd6fb" strokeWidth="0.8" strokeOpacity="0.4"></rect>
                    <text x="14" y="-28" fill="#849396" fontFamily="JetBrains Mono" fontSize="9" fontWeight="600">BASE: +142m</text>
                  </g>

                  {/* Rotating Central Reticle */}
                  <g transform="translate(240, 240)">
                    <circle cx="0" cy="0" r="16" stroke="#00e5ff" strokeWidth="1" strokeDasharray="3 3" opacity="0.8"></circle>
                    <circle cx="0" cy="0" r="2.5" fill="#ffffff"></circle>
                    <line x1="-20" y1="0" x2="20" y2="0" stroke="#00e5ff" strokeWidth="1" opacity="0.7"></line>
                    <line x1="0" y1="-20" x2="0" y2="20" stroke="#00e5ff" strokeWidth="1" opacity="0.7"></line>
                  </g>
                </svg>

                {/* 3D Orthogonal Axes */}
                <div className="absolute bottom-5 left-5 flex flex-col gap-1 pointer-events-none p-1.5 rounded bg-[#080f18]/80 border border-[#3b494c]/30">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-[2px] bg-[#4cd6fb]"></span>
                    <span className="font-mono-coordinate text-[11px] text-[#4cd6fb] font-bold">X (EAST)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-[2px] bg-[#c3f5ff]"></span>
                    <span className="font-mono-coordinate text-[11px] text-[#c3f5ff] font-bold">Y (NORTH)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-[2px] bg-white"></span>
                    <span className="font-mono-coordinate text-[11px] text-white font-bold">Z (ZENITH)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Vertical Elevation Scale & Meter Bar */}
            <div className="absolute left-4 top-20 bottom-20 w-16 bg-[#151c26]/90 backdrop-blur-md rounded-lg p-2 flex flex-col items-center justify-between shadow-xl z-20 pointer-events-auto border border-[#3b494c]/30">
              <span className="font-label-caps text-[10px] text-[#dce3f0] font-bold">2,894m</span>
              <div className="relative w-3 flex-1 my-2 rounded-full overflow-hidden bg-[#2e353f] flex flex-col justify-between items-center py-1">
                <div className="absolute inset-0 bg-gradient-to-b from-white via-[#c3f5ff] to-[#151c26] opacity-90"></div>
                <div className="w-full h-[1px] bg-[#0d141d] z-10 opacity-60"></div>
                <div className="w-full h-[1px] bg-[#0d141d] z-10 opacity-60"></div>
                <div className="w-full h-[1px] bg-[#0d141d] z-10 opacity-60"></div>
                <div className="w-full h-[1px] bg-[#0d141d] z-10 opacity-60"></div>
                {/* Dynamic Cursor Pin */}
                <div 
                  className="absolute w-full h-1 bg-[#0d141d] z-20 shadow-[0_0_8px_#ffffff]" 
                  style={{ top: `${cursorPinTop}%` }}
                ></div>
              </div>
              <span className="font-label-caps text-[10px] text-[#bac9cc]">142m</span>
              <span className="font-mono-coordinate text-[10px] text-[#4cd6fb] mt-1">ASL (m)</span>
            </div>

            {/* Bottom Floating Telemetry Bar on Viewport */}
            <div className="absolute bottom-4 left-24 right-4 flex flex-wrap items-center justify-between gap-2 bg-[#151c26]/85 backdrop-blur-md px-4 py-2 rounded-lg shadow-lg z-20 border border-[#3b494c]/30">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-[#4cd6fb]">explore</span>
                  <span className="font-mono-coordinate text-[11px] text-[#bac9cc]">GEO REF:</span>
                  <span className="font-mono-telemetry text-[13px] text-[#c3f5ff] font-semibold">14°12'32"N, 76°24'11"E</span>
                </div>
                <div className="hidden sm:flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-[#00e5ff]">height</span>
                  <span className="font-mono-coordinate text-[11px] text-[#bac9cc]">CURSOR ALT:</span>
                  <span className="font-mono-telemetry text-[13px] text-white font-bold tracking-wider">{cursorAlt.toLocaleString()}m</span>
                </div>
              </div>

              <div className="flex items-center gap-1 font-mono-coordinate text-[11px] text-[#bac9cc]">
                <span className="material-symbols-outlined text-[14px] text-[#4cd6fb]">360</span>
                <span>FULL 360° ORBIT : DRAG ANYWHERE • TOGGLE AUTO-SPIN</span>
              </div>
            </div>
          </div>

          {/* View Presets & Action Footer Bar */}
          <div className="w-full bg-[#19202a]/60 backdrop-blur-md rounded-xl p-3 flex flex-wrap items-center justify-between gap-4 shadow-md border border-[#3b494c]/20">
            <div className="flex items-center gap-2">
              <span className="font-label-caps text-[10px] text-[#849396] uppercase mr-1 hidden md:inline">Camera Presets:</span>
              <button 
                onClick={() => setPreset(5, 0)}
                className="px-3 py-1.5 rounded bg-[#242a34] hover:bg-[#333a44] text-[#dce3f0] font-mono-telemetry text-[13px] transition-all flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">north</span> Top-Down (0°)
              </button>
              <button 
                onClick={() => setPreset(45, 325)}
                className="px-3 py-1.5 rounded bg-[#2e353f] text-[#c3f5ff] font-mono-telemetry text-[13px] transition-all flex items-center gap-1 shadow-inner border border-[#00e5ff]/20 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">rotate_90_degrees_ccw</span> ISO 45°
              </button>
              <button 
                onClick={() => setPreset(85, 270)}
                className="px-3 py-1.5 rounded bg-[#242a34] hover:bg-[#333a44] text-[#dce3f0] font-mono-telemetry text-[13px] transition-all flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">horizontal_split</span> Profile Cut (85°)
              </button>
            </div>

            {/* Primary Action Button to Screen 05 */}
            <button 
              onClick={() => onNavigate('3d-flythrough')}
              className="relative group flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#00e5ff] text-[#00363d] font-mono-telemetry text-[13px] font-bold shadow-[0_0_20px_rgba(0,229,255,0.45)] hover:bg-white hover:text-[#0d141d] hover:shadow-[0_0_30px_rgba(0,229,255,0.8)] transition-all cursor-pointer"
            >
              <span>GO TO 3D FLYTHROUGH</span>
              <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">flight_takeoff</span>
            </button>
          </div>
        </div>

        {/* Right Details & Mission Telemetry Panel (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Dataset Telemetry Glass Card */}
          <div className="w-full bg-[#151c26]/90 backdrop-blur-xl rounded-xl p-4 flex flex-col gap-3 shadow-xl border border-[#3b494c]/20">
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#c3f5ff] text-[20px]">dataset</span>
                <span className="font-headline-sm text-[18px] text-[#dce3f0] font-semibold">Mesh Metadata</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#2e353f] text-[#4cd6fb] font-mono-coordinate text-[11px] border border-[#4cd6fb]/30">
                ISRO-DEM-RAW
              </span>
            </div>

            {/* Telemetry Monospace Table */}
            <div className="flex flex-col rounded overflow-hidden bg-[#080f18]/60 border border-[#3b494c]/20">
              <div className="flex items-center justify-between p-2.5 bg-[#19202a]/30">
                <span className="font-mono-coordinate text-[11px] text-[#849396] uppercase">Dataset</span>
                <span className="font-mono-telemetry text-[13px] text-[#dce3f0] font-semibold">CARTOSAT-3_STEREO_ABS_092</span>
              </div>
              <div className="flex items-center justify-between p-2.5">
                <span className="font-mono-coordinate text-[11px] text-[#849396] uppercase">Elevation Range</span>
                <span className="font-mono-telemetry text-[13px] text-[#c3f5ff] font-bold">142m — 2,894m ASL</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-[#19202a]/30">
                <span className="font-mono-coordinate text-[11px] text-[#849396] uppercase">Spatial Res (GSD)</span>
                <span className="font-mono-telemetry text-[13px] text-[#dce3f0]">0.28m GSD</span>
              </div>
              <div className="flex items-center justify-between p-2.5">
                <span className="font-mono-coordinate text-[11px] text-[#849396] uppercase">Coordinates</span>
                <span className="font-mono-telemetry text-[13px] text-[#4cd6fb]">14°12'32"N, 76°24'11"E</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-[#19202a]/30">
                <span className="font-mono-coordinate text-[11px] text-[#849396] uppercase">Datum</span>
                <span className="font-mono-telemetry text-[13px] text-[#dce3f0]">WGS84 Ellipsoidal</span>
              </div>
              <div className="flex items-center justify-between p-2.5">
                <span className="font-mono-coordinate text-[11px] text-[#849396] uppercase">Slope Gradient</span>
                <span className="font-mono-telemetry text-[13px] text-[#ffb4ab] font-semibold">Max 48.2° (Rim)</span>
              </div>
              <div className="flex items-center justify-between p-2.5 bg-[#19202a]/30">
                <span className="font-mono-coordinate text-[11px] text-[#849396] uppercase">Point Density</span>
                <span className="font-mono-telemetry text-[13px] text-[#dce3f0]">12.8 pts / m²</span>
              </div>
            </div>

            {/* Slope Distribution Histogram */}
            <div className="flex flex-col gap-1 pt-1">
              <div className="flex items-center justify-between">
                <span className="font-label-caps text-[10px] text-[#bac9cc] uppercase">Slope Histogram (Deg)</span>
                <span className="font-mono-coordinate text-[11px] text-[#c3f5ff]">Mean: 18.4°</span>
              </div>
              <div className="h-12 w-full bg-[#080f18] rounded p-1 flex items-end gap-1 border border-[#3b494c]/20">
                <div className="w-1/12 bg-[#c3f5ff]/30 h-[25%] rounded-t"></div>
                <div className="w-1/12 bg-[#c3f5ff]/40 h-[40%] rounded-t"></div>
                <div className="w-1/12 bg-[#c3f5ff]/60 h-[75%] rounded-t"></div>
                <div className="w-1/12 bg-[#00e5ff] h-[95%] rounded-t"></div>
                <div className="w-1/12 bg-[#c3f5ff]/80 h-[80%] rounded-t"></div>
                <div className="w-1/12 bg-[#c3f5ff]/70 h-[60%] rounded-t"></div>
                <div className="w-1/12 bg-[#4cd6fb] h-[45%] rounded-t"></div>
                <div className="w-1/12 bg-[#4cd6fb]/70 h-[30%] rounded-t"></div>
                <div className="w-1/12 bg-[#4cd6fb]/50 h-[20%] rounded-t"></div>
                <div className="w-1/12 bg-[#ffb4ab]/60 h-[35%] rounded-t"></div>
                <div className="w-1/12 bg-[#ffb4ab]/80 h-[50%] rounded-t"></div>
                <div className="w-1/12 bg-[#ffb4ab] h-[15%] rounded-t"></div>
              </div>
            </div>
          </div>

          {/* Real-Time Analytical Filters Panel */}
          <div className="w-full bg-[#151c26]/90 backdrop-blur-xl rounded-xl p-4 flex flex-col gap-3 shadow-xl border border-[#3b494c]/20">
            <div className="flex items-center justify-between">
              <span className="font-headline-sm text-[18px] text-[#dce3f0] font-semibold">Surface Shading</span>
              <span className="material-symbols-outlined text-[#849396] text-[18px]">tune</span>
            </div>

            <div className="flex flex-col gap-3 pt-1">
              {/* Solar Azimuth */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono-coordinate text-[11px]">
                  <span className="text-[#bac9cc] uppercase">Solar Azimuth Angle</span>
                  <span className="text-[#c3f5ff] font-semibold">{solarAzimuth}° NW</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="360" 
                  value={solarAzimuth} 
                  onChange={(e) => setSolarAzimuth(parseInt(e.target.value))}
                  className="w-full accent-[#00e5ff] bg-[#2e353f] rounded cursor-pointer h-1.5"
                />
              </div>

              {/* Solar Zenith */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono-coordinate text-[11px]">
                  <span className="text-[#bac9cc] uppercase">Solar Zenith / Elevation</span>
                  <span className="text-[#c3f5ff] font-semibold">{solarZenith}°</span>
                </div>
                <input 
                  type="range" 
                  min="5" 
                  max="90" 
                  value={solarZenith} 
                  onChange={(e) => setSolarZenith(parseInt(e.target.value))}
                  className="w-full accent-[#00e5ff] bg-[#2e353f] rounded cursor-pointer h-1.5"
                />
              </div>

              {/* Z-Axis Exaggeration */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-mono-coordinate text-[11px]">
                  <span className="text-[#bac9cc] uppercase">Z-Axis Exaggeration</span>
                  <span className="text-[#4cd6fb] font-semibold">{zExaggeration.toFixed(1)}x</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="4" 
                  step="0.1" 
                  value={zExaggeration} 
                  onChange={(e) => setZExaggeration(parseFloat(e.target.value))}
                  className="w-full accent-[#4cd6fb] bg-[#2e353f] rounded cursor-pointer h-1.5"
                />
              </div>
            </div>

            <div className="mt-1 p-2 rounded bg-[#080f18]/80 flex items-center gap-2 text-[#bac9cc] border border-[#3b494c]/20">
              <span className="material-symbols-outlined text-[#4cd6fb] text-[16px] shrink-0">info</span>
              <span className="font-body-sm text-[12px]">
                Continuous 360° polar telemetry active. Hillshade recalculates dynamically.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
