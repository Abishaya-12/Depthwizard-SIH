import React, { useState, useRef } from 'react';
import { DemProcessingResponse, TabId } from '../types';

interface MeshProcessingProps {
  onNavigate: (tab: TabId) => void;
  processingResult: DemProcessingResponse | null;
  previewImage?: string | null;
}

export const MeshProcessing: React.FC<MeshProcessingProps> = ({ onNavigate, processingResult, previewImage }) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [elevationTickTop, setElevationTickTop] = useState('33%');
  const [radarPing, setRadarPing] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const pct = Math.min(Math.max((y / rect.height) * 100, 5), 95);
    setElevationTickTop(`${pct}%`);
  };

  const handleViewportClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setRadarPing({ x, y, visible: true });
    setTimeout(() => {
      setRadarPing((prev) => ({ ...prev, visible: false }));
    }, 800);

    const originX = (x / rect.width) * 100;
    const originY = (y / rect.height) * 100;
    setZoomOrigin({ x: originX, y: originY });
    setIsZoomed(!isZoomed);
  };

  return (
    <div className="flex flex-col w-full p-6 gap-6 max-w-7xl mx-auto">
      {/* Top Step Pipeline & Telemetry Ribbon */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-[#151c26]/80 backdrop-blur-xl p-4 rounded-xl shadow-lg border border-[#3b494c]/20">
        {/* Steps */}
        <div className="flex items-center gap-2 flex-wrap">
          <div 
            onClick={() => onNavigate('setup-upload')}
            className="flex items-center gap-1.5 cursor-pointer opacity-80 hover:opacity-100"
          >
            <span className="w-5 h-5 rounded-full bg-[#c3f5ff]/20 text-[#c3f5ff] flex items-center justify-center font-mono-telemetry text-[12px]">
              <span className="material-symbols-outlined text-[14px]">check</span>
            </span>
            <span className="font-mono-telemetry text-[13px] text-[#dce3f0]">01 Ingestion</span>
          </div>

          <div className="w-6 h-0.5 bg-[#c3f5ff]/40"></div>

          <div 
            onClick={() => onNavigate('setup-upload')}
            className="flex items-center gap-1.5 cursor-pointer opacity-80 hover:opacity-100"
          >
            <span className="w-5 h-5 rounded-full bg-[#c3f5ff]/20 text-[#c3f5ff] flex items-center justify-center font-mono-telemetry text-[12px]">
              <span className="material-symbols-outlined text-[14px]">check</span>
            </span>
            <span className="font-mono-telemetry text-[13px] text-[#dce3f0]">02 Filtering</span>
          </div>

          <div className="w-6 h-0.5 bg-[#00e5ff] shadow-[0_0_8px_#00e5ff]"></div>

          <div className="flex items-center gap-2 px-3 py-1 bg-[#00e5ff]/15 rounded-full border border-[#00e5ff]/30">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00e5ff] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00e5ff]"></span>
            </span>
            <span className="font-mono-telemetry text-[13px] font-bold text-[#00e5ff]">
              03 Synthesis Complete
            </span>
          </div>

          <div className="w-6 h-0.5 bg-[#3b494c]"></div>

          <div 
            onClick={() => onNavigate('3d-dem-viewer')}
            className="flex items-center gap-1.5 opacity-60 hover:opacity-100 cursor-pointer"
          >
            <span className="font-mono-telemetry text-[13px] text-[#849396]">04 Viewport</span>
          </div>

          <div className="w-6 h-0.5 bg-[#3b494c]"></div>

          <div 
            onClick={() => onNavigate('3d-flythrough')}
            className="flex items-center gap-1.5 opacity-60 hover:opacity-100 cursor-pointer"
          >
            <span className="font-mono-telemetry text-[13px] text-[#849396]">05 Flythrough</span>
          </div>
        </div>

        {/* Sensor Spec Badge */}
        <div className="flex items-center gap-2 px-4 py-1.5 bg-[#080f18]/90 rounded-lg border border-[#3b494c]/30">
          <span className="material-symbols-outlined text-[#00daf3] text-[16px]">sensors</span>
          <span className="font-label-caps text-[10px] text-[#bac9cc] uppercase tracking-wider">
            DEM RASTER RESOLUTION: <strong className="text-[#c3f5ff]">0.5m/pixel</strong> • VERTICAL ACCURACY: <strong className="text-[#00daf3]">±0.12m</strong>
          </span>
        </div>
      </div>

      {/* Center Canvas / Interactive Generated DEM Visualizer Frame */}
      <div 
        ref={viewportRef}
        onMouseMove={handleMouseMove}
        onClick={handleViewportClick}
        className="relative w-full rounded-xl overflow-hidden bg-[#080f18] shadow-2xl group cursor-crosshair select-none border border-[#3b494c]/30"
        id="terrain-viewport"
      >
        {/* Ambient Backlight Gradient Scrim */}
        <div className="absolute -inset-24 bg-gradient-to-tr from-[#00e5ff]/10 via-[#00b2d6]/5 to-transparent blur-3xl pointer-events-none"></div>

        {/* Generated Topographic Elevation Heatmap Asset */}
        <div className="relative w-full h-[520px] md:h-[620px] overflow-hidden flex items-center justify-center">
          {previewImage ? (
            <img
              src={previewImage}
              alt="Generated relative DEM preview"
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out filter brightness-105 contrast-110 ${
                isZoomed ? 'scale-125' : 'scale-100 group-hover:scale-105'
              }`}
              style={{ transformOrigin: isZoomed ? `${zoomOrigin.x}% ${zoomOrigin.y}%` : 'center center' }}
            />
          ) : (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.14) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.14) 75%), linear-gradient(45deg, rgba(255,255,255,0.14) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.14) 75%), radial-gradient(circle at center, rgba(0,229,255,0.28), rgba(0,0,0,0.6) 42%, rgba(0,0,0,0.92))',
                backgroundSize: '28px 28px, 28px 28px, cover',
                backgroundPosition: '0 0, 14px 14px, center',
              }}
            />
          )}

          {/* Laser Scan Grid Overlay (SVG) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30 group-hover:opacity-50 transition-opacity" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="laser-grid" width="48" height="48" patternUnits="userSpaceOnUse">
                <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#00e5ff" strokeWidth="0.5" strokeDasharray="2 4"></path>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#laser-grid)"></rect>
          </svg>

          {/* Laser Scanning Horizon Line (Animated) */}
          <div className="absolute left-0 right-0 h-16 bg-gradient-to-b from-transparent via-[#00e5ff]/20 to-transparent pointer-events-none animate-pulse"></div>

          {/* Radar Ping Node on click */}
          {radarPing.visible && (
            <div 
              className="absolute w-32 h-32 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{ left: radarPing.x, top: radarPing.y }}
            >
              <div className="w-full h-full rounded-full bg-[#00e5ff]/20 animate-ping"></div>
              <div className="absolute inset-4 rounded-full border border-[#00e5ff]/80 animate-pulse"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-[#00e5ff] shadow-[0_0_12px_#00e5ff]"></span>
              </div>
            </div>
          )}

          {/* HUD Coordinate Rulers & Geodetic Anchors */}
          {/* Top Coordinate Ribbon */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
            <div className="flex items-center gap-2 bg-[#080f18]/80 backdrop-blur-md px-3 py-1 rounded border border-[#3b494c]/30">
              <span className="material-symbols-outlined text-[#00e5ff] text-[14px]">my_location</span>
              <span className="font-mono-coordinate text-[11px] text-[#dce3f0]">
                GRID: <span className="text-[#c3f5ff] font-semibold">ISRO-DEM-CARTOSAT3-IN-73</span>
              </span>
            </div>
            <div className="flex items-center gap-4 bg-[#080f18]/80 backdrop-blur-md px-3 py-1 rounded border border-[#3b494c]/30">
              <span className="font-mono-coordinate text-[11px] text-[#bac9cc]">
                LAT <span className="text-[#4cd6fb] font-mono-telemetry font-bold">18°24'19.4"N</span>
              </span>
              <span className="font-mono-coordinate text-[11px] text-[#bac9cc]">
                LONG <span className="text-[#4cd6fb] font-mono-telemetry font-bold">73°45'32.8"E</span>
              </span>
            </div>
          </div>

          {/* Center Crosshair Target Vector */}
          <div className="absolute pointer-events-none flex items-center justify-center">
            <svg className="text-[#00e5ff] opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" width="120" height="120" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="38" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 6"></circle>
              <circle cx="60" cy="60" r="18" fill="none" stroke="currentColor" strokeWidth="0.75"></circle>
              <line x1="60" y1="10" x2="60" y2="40" stroke="currentColor" strokeWidth="1.5"></line>
              <line x1="60" y1="80" x2="60" y2="110" stroke="currentColor" strokeWidth="1.5"></line>
              <line x1="10" y1="60" x2="40" y2="60" stroke="currentColor" strokeWidth="1.5"></line>
              <line x1="80" y1="60" x2="110" y2="60" stroke="currentColor" strokeWidth="1.5"></line>
              <circle cx="60" cy="60" r="2.5" fill="currentColor"></circle>
            </svg>
            <div className="absolute translate-x-16 -translate-y-8 bg-[#080f18]/90 px-2 py-1 rounded shadow-md border border-[#3b494c]/30">
              <span className="font-mono-coordinate text-[11px] text-[#00daf3] tracking-tight">
                Z-TARGET: +1,248.4m
              </span>
            </div>
          </div>

          {/* Right Lateral Hypsometric Elevation Bar Scale */}
          <div className="absolute right-4 top-24 bottom-24 w-10 flex flex-col items-center justify-between p-1 bg-[#080f18]/80 backdrop-blur-md rounded pointer-events-none z-10 shadow-lg border border-[#3b494c]/30">
            <span className="font-mono-coordinate text-[10px] text-[#c3f5ff] font-bold tracking-tighter">2850m</span>
            {/* Vertical Elevation Heatmap Gradient Ramp */}
            <div className="relative w-2.5 flex-1 mx-auto my-2 rounded-full bg-gradient-to-t from-[#0d141d] via-[#004e5f] via-[#00b2d6] via-[#00e5ff] to-[#f0f9ff] overflow-hidden">
              <div 
                className="absolute w-full h-1 bg-white shadow-[0_0_8px_#fff] transition-all duration-150" 
                style={{ top: elevationTickTop }}
              ></div>
            </div>
            <span className="font-mono-coordinate text-[10px] text-[#849396] font-bold tracking-tighter">120m</span>
          </div>

          {/* Left Corner Geographic Datum Badge */}
          <div className="absolute bottom-4 left-4 pointer-events-none z-10 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 bg-[#080f18]/85 backdrop-blur-md px-3 py-1 rounded border border-[#3b494c]/20">
              <span className="w-2 h-2 rounded-full bg-[#4cd6fb]"></span>
              <span className="font-label-caps text-[10px] text-[#bac9cc] uppercase">
                DATUM: WGS 84 / UTM ZONE 43N
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-[#080f18]/85 backdrop-blur-md px-3 py-1 rounded border border-[#3b494c]/20">
              <span className="font-mono-coordinate text-[11px] text-[#849396]">
                ISOLINE INTERVAL: <strong className="text-[#dce3f0]">10.0m</strong>
              </span>
            </div>
          </div>

          {/* Prominent Floating Action Overlay Badge (Center-Bottom) */}
          <div className="absolute bottom-4 pointer-events-auto z-20 transition-transform duration-300 hover:scale-105 active:scale-95">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onNavigate('3d-dem-viewer');
              }}
              className="flex items-center gap-3 px-5 py-2.5 bg-[#242a34]/90 hover:bg-[#00e5ff] text-[#dce3f0] hover:text-[#00363d] backdrop-blur-xl rounded-full shadow-[0_4px_24px_rgba(0,229,255,0.25)] transition-all cursor-pointer border border-[#00e5ff]/40 group"
            >
              <span className="material-symbols-outlined text-[20px] text-[#00e5ff] group-hover:text-[#00363d] transition-colors animate-bounce">
                view_in_ar
              </span>
              <span className="font-headline-sm text-[16px] font-semibold tracking-tight">
                Map generated — click to explore in 3D
              </span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>

      {/* Secondary Processing Telemetry Bar & Launch Action Area */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-[#151c26]/70 backdrop-blur-md p-4 rounded-xl shadow-lg border border-[#3b494c]/20">
        <div className="col-span-1 md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="flex flex-col p-2 bg-[#080f18]/70 rounded border border-[#3b494c]/20">
            <span className="font-label-caps text-[10px] text-[#849396] uppercase">Interpolation</span>
            <span className="font-mono-telemetry text-[13px] text-[#c3f5ff] font-semibold truncate">{processingResult?.result.interpolation ?? 'Awaiting synthesis'}</span>
          </div>
          <div className="flex flex-col p-2 bg-[#080f18]/70 rounded border border-[#3b494c]/20">
            <span className="font-label-caps text-[10px] text-[#849396] uppercase">Mesh Triangles</span>
            <span className="font-mono-telemetry text-[13px] text-[#dce3f0] font-semibold truncate">{processingResult ? processingResult.result.meshTriangles.toLocaleString() : '--'} tris</span>
          </div>
          <div className="flex flex-col p-2 bg-[#080f18]/70 rounded border border-[#3b494c]/20">
            <span className="font-label-caps text-[10px] text-[#849396] uppercase">Survey BBOX</span>
            <span className="font-mono-telemetry text-[13px] text-[#4cd6fb] font-semibold truncate">{processingResult?.result.surveyAreaKm2 !== undefined ? `${processingResult.result.surveyAreaKm2.toFixed(2)} km²` : '--'}</span>
          </div>
          <div className="flex flex-col p-2 bg-[#080f18]/70 rounded border border-[#3b494c]/20">
            <span className="font-label-caps text-[10px] text-[#849396] uppercase">Max Relief Delta</span>
            <span className="font-mono-telemetry text-[13px] text-[#e1eeff] font-semibold truncate">{processingResult?.result.maxReliefMeters !== undefined ? `Δ ${processingResult.result.maxReliefMeters.toLocaleString()} m` : '--'}</span>
          </div>
        </div>

        {/* Action Launch Impulse Button */}
        <div className="col-span-1 md:col-span-4 flex items-center justify-start md:justify-end gap-2">
          <button 
            onClick={() => onNavigate('3d-dem-viewer')}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-[#00e5ff] text-[#00363d] font-mono-telemetry text-[13px] font-bold rounded-full shadow-[0_0_20px_rgba(0,229,255,0.45)] hover:bg-white hover:text-[#0d141d] hover:shadow-[0_0_32px_rgba(0,229,255,0.8)] active:scale-98 transition-all cursor-pointer"
          >
            <span>Launch 3D Explorer</span>
            <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
          </button>
        </div>
      </div>

      {/* Mini Spatial Metadata Telemetry Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1 */}
        <div className="p-4 rounded-xl bg-[#19202a]/60 backdrop-blur-md flex flex-col gap-1 shadow-md border border-[#3b494c]/20">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-[10px] text-[#bac9cc] uppercase tracking-wider">Point Density</span>
            <span className="font-mono-coordinate text-[11px] text-[#c3f5ff]">High Density</span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-headline-md text-[24px] text-[#dce3f0] font-bold">18.4</span>
            <span className="font-mono-coordinate text-[11px] text-[#849396]">pts / m²</span>
          </div>
          <div className="w-full bg-[#2e353f] h-1 rounded-full overflow-hidden mt-1">
            <div className="bg-[#00e5ff] h-full w-[84%] rounded-full shadow-[0_0_6px_#00e5ff]"></div>
          </div>
          <span className="font-body-sm text-[12px] text-[#bac9cc] mt-1">
            Outlier filtering removed 14,208 atmospheric refraction artefacts.
          </span>
        </div>

        {/* Card 2 */}
        <div className="p-4 rounded-xl bg-[#19202a]/60 backdrop-blur-md flex flex-col gap-1 shadow-md border border-[#3b494c]/20">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-[10px] text-[#bac9cc] uppercase tracking-wider">Terrain Roughness</span>
            <span className="font-mono-coordinate text-[11px] text-[#4cd6fb]">Alpine Rugged</span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-headline-md text-[24px] text-[#dce3f0] font-bold">0.82</span>
            <span className="font-mono-coordinate text-[11px] text-[#849396]">Rugosity Index</span>
          </div>
          <div className="w-full bg-[#2e353f] h-1 rounded-full overflow-hidden mt-1">
            <div className="bg-[#4cd6fb] h-full w-[68%] rounded-full"></div>
          </div>
          <span className="font-body-sm text-[12px] text-[#bac9cc] mt-1">
            Steep gradients detected along northeast escarpment ridgeline.
          </span>
        </div>

        {/* Card 3 */}
        <div className="p-4 rounded-xl bg-[#19202a]/60 backdrop-blur-md flex flex-col gap-1 shadow-md border border-[#3b494c]/20">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-[10px] text-[#bac9cc] uppercase tracking-wider">Orthorectification</span>
            <span className="font-mono-coordinate text-[11px] text-[#00daf3]">Ready</span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-headline-md text-[24px] text-[#dce3f0] font-bold">0.032</span>
            <span className="font-mono-coordinate text-[11px] text-[#849396]">RMSE Pixel Shift</span>
          </div>
          <div className="w-full bg-[#2e353f] h-1 rounded-full overflow-hidden mt-1">
            <div className="bg-[#00daf3] h-full w-[96%] rounded-full"></div>
          </div>
          <span className="font-body-sm text-[12px] text-[#bac9cc] mt-1">
            Sub-pixel spatial correspondence calibrated to Cartosat-3 ephemeris.
          </span>
        </div>
      </div>
    </div>
  );
};
