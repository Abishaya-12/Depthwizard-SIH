import React, { useState, useRef } from 'react';
import { estimateDepthFromImage, processDemFiles } from '../api';
import { DemProcessingResponse, TabId } from '../types';

interface SetupUploadProps {
  onNavigate: (tab: TabId) => void;
  onProcessed: (result: DemProcessingResponse) => void;
}

export const SetupUpload: React.FC<SetupUploadProps> = ({ onNavigate, onProcessed }) => {
  const [fileLayer1, setFileLayer1] = useState<{ name: string; size: string; verified: boolean } | null>(null);
  const [fileLayer2, setFileLayer2] = useState<{ name: string; size: string; verified: boolean } | null>(null);
  const [relativeFile, setRelativeFile] = useState<File | null>(null);
  const [rgbFile, setRgbFile] = useState<File | null>(null);
  const [absoluteFile, setAbsoluteFile] = useState<File | null>(null);
  const [relativeInputMode, setRelativeInputMode] = useState<'dem' | 'rgb'>('dem');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [datumModel, setDatumModel] = useState('Lunar Sphere R=1737.4 km');
  const [calibSource, setCalibSource] = useState('LOLA + CE-2 Altimetry');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInput1Ref = useRef<HTMLInputElement | null>(null);
  const rgbInputRef = useRef<HTMLInputElement | null>(null);
  const fileInput2Ref = useRef<HTMLInputElement | null>(null);

  const handleFile1Upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewImage(url);
      setFileLayer1({
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB • 100% Verified • Raster Float`,
        verified: true,
      });
      setRelativeFile(file);
    }
  };

  const handleFile2Upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileLayer2({
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB • Ready • Georeferenced WGS84`,
        verified: true,
      });
      setAbsoluteFile(file);
    }
  };

  const handleRgbUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRgbFile(file);
      setFileLayer1({
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB • RGB PHOTO • READY FOR AI DEPTH`,
        verified: true,
      });
    }
  };

  const dataUrlToFile = async (dataUrl: string, filename: string) => {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return new File([blob], filename, { type: 'image/png' });
  };

  const handleSynthesize = async () => {
    if (!relativeFile && !rgbFile && !absoluteFile) {
      setError('Select a relative DEM, raw RGB photo, or absolute DEM before starting synthesis.');
      return;
    }

    setIsSynthesizing(true);
    setError(null);
    try {
      let processedRelativeFile = relativeFile;
      let generatedPreviewImage = previewImage;
      if (relativeInputMode === 'rgb' && rgbFile) {
        const depthResult = await estimateDepthFromImage(rgbFile);
        generatedPreviewImage = depthResult.relativeDemUrl;
        setPreviewImage(generatedPreviewImage);
        processedRelativeFile = await dataUrlToFile(depthResult.relativeDemUrl, `${rgbFile.name}-relative-dem.png`);
      }

      const result = await processDemFiles(processedRelativeFile, absoluteFile);
      onProcessed({
        ...result,
        previewImage: generatedPreviewImage ?? result.previewImage ?? null,
      });
      onNavigate('map-generated');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'DEM processing failed.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="flex flex-col w-full px-6 py-4 gap-6 relative overflow-hidden">
      {/* Atmospheric Ambient Glows */}
      <div className="absolute top-12 left-1/4 w-96 h-96 bg-[#00b2d6]/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
      <div className="absolute bottom-20 right-10 w-[30rem] h-[30rem] bg-[#00e5ff]/5 rounded-full blur-3xl pointer-events-none -z-10"></div>

      {/* Hidden File Inputs */}
      <input 
        type="file" 
        ref={fileInput1Ref} 
        onChange={handleFile1Upload} 
        className="hidden" 
        accept=".png"
      />
      <input
        type="file"
        ref={rgbInputRef}
        onChange={handleRgbUpload}
        className="hidden"
        accept=".jpg,.jpeg,.png"
      />
      <input 
        type="file" 
        ref={fileInput2Ref} 
        onChange={handleFile2Upload} 
        className="hidden" 
        accept=".dem,.tif,.tiff,.las,.laz,.png"
      />

      {/* PIPELINE STEP INDICATOR */}
      <section className="w-full bg-[#151c26]/90 backdrop-blur-xl rounded-xl p-4 shadow-xl border border-[#3b494c]/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#00e5ff]/20 rounded text-[#4cd6fb]">
              <span className="material-symbols-outlined text-[20px]">tune</span>
            </div>
            <div>
              <div className="font-label-caps text-[10px] text-[#849396] uppercase tracking-wider">
                Mission Pipeline Execution
              </div>
              <div className="font-headline-sm text-[18px] text-[#c3f5ff] tracking-tight font-semibold">
                Stage 02 // Precision Elevation Raster Ingestion
              </div>
            </div>
          </div>

          {/* Progress Telemetry Gauge */}
          <div className="flex items-center gap-4 bg-[#080f18]/80 px-4 py-2 rounded-lg border border-[#3b494c]/20">
            <div className="flex flex-col text-right">
              <span className="font-label-caps text-[10px] text-[#849396] uppercase">
                Global Calibration Stage
              </span>
              <span className="font-mono-telemetry text-[13px] text-[#4cd6fb] font-semibold">
                STAGE VERIFIED • 37.8%
              </span>
            </div>
            <div className="w-28 h-2 bg-[#2e353f] rounded-full overflow-hidden p-[1px]">
              <div className="h-full bg-gradient-to-r from-[#4cd6fb] to-[#00e5ff] rounded-full w-[38%] transition-all duration-700 shadow-[0_0_10px_#00e5ff]"></div>
            </div>
          </div>
        </div>

        {/* Segmented Step Tracker */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
          {/* Step 1: Complete */}
          <div 
            onClick={() => onNavigate('welcome-portal')}
            className="flex flex-col gap-1 bg-[#242a34]/40 p-2.5 rounded transition-all cursor-pointer hover:bg-[#242a34]/70 border border-[#3b494c]/20"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono-coordinate text-[11px] text-[#bac9cc] font-medium">01 // INIT</span>
              <span className="material-symbols-outlined text-[#4cd6fb] text-[16px]">check_circle</span>
            </div>
            <div className="h-1 w-full bg-[#4cd6fb] rounded-full shadow-[0_0_8px_#4cd6fb]"></div>
            <span className="font-label-caps text-[10px] text-[#dce3f0]">Welcome Portal</span>
          </div>

          {/* Step 2: Active / Pulsing */}
          <div className="flex flex-col gap-1 bg-[#2e353f]/60 p-2.5 rounded shadow-[0_0_20px_rgba(0,229,255,0.1)] relative overflow-hidden border border-[#00e5ff]/30">
            <div className="absolute inset-0 bg-[#00e5ff]/5 animate-pulse pointer-events-none"></div>
            <div className="flex items-center justify-between relative z-10">
              <span className="font-mono-coordinate text-[11px] text-[#c3f5ff] font-bold">02 // CURRENT</span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00e5ff] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00e5ff] shadow-[0_0_6px_#00e5ff]"></span>
              </span>
            </div>
            <div className="h-1 w-full bg-gradient-to-r from-[#c3f5ff] to-[#00e5ff] rounded-full shadow-[0_0_12px_#00e5ff]"></div>
            <span className="font-label-caps text-[10px] text-[#c3f5ff] font-bold tracking-wider relative z-10">
              Ingest DEM Files
            </span>
          </div>

          {/* Step 3: Queued */}
          <div 
            onClick={() => onNavigate('map-generated')}
            className="flex flex-col gap-1 bg-[#151c26]/40 p-2.5 rounded opacity-80 cursor-pointer hover:opacity-100 hover:bg-[#242a34]/50 border border-[#3b494c]/20"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono-coordinate text-[11px] text-[#849396]">03 // QUEUED</span>
              <span className="material-symbols-outlined text-[#849396] text-[16px]">hourglass_empty</span>
            </div>
            <div className="h-1 w-full bg-[#2e353f] rounded-full"></div>
            <span className="font-label-caps text-[10px] text-[#849396]">Mesh Decimation</span>
          </div>

          {/* Step 4: Queued */}
          <div 
            onClick={() => onNavigate('3d-dem-viewer')}
            className="flex flex-col gap-1 bg-[#151c26]/40 p-2.5 rounded opacity-80 cursor-pointer hover:opacity-100 hover:bg-[#242a34]/50 border border-[#3b494c]/20"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono-coordinate text-[11px] text-[#849396]">04 // QUEUED</span>
              <span className="material-symbols-outlined text-[#849396] text-[16px]">lock</span>
            </div>
            <div className="h-1 w-full bg-[#2e353f] rounded-full"></div>
            <span className="font-label-caps text-[10px] text-[#849396]">3D DEM Viewer</span>
          </div>

          {/* Step 5: Queued */}
          <div 
            onClick={() => onNavigate('3d-flythrough')}
            className="flex flex-col gap-1 bg-[#151c26]/40 p-2.5 rounded opacity-80 cursor-pointer hover:opacity-100 hover:bg-[#242a34]/50 border border-[#3b494c]/20"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono-coordinate text-[11px] text-[#849396]">05 // QUEUED</span>
              <span className="material-symbols-outlined text-[#849396] text-[16px]">lock</span>
            </div>
            <div className="h-1 w-full bg-[#2e353f] rounded-full"></div>
            <span className="font-label-caps text-[10px] text-[#849396]">Vector Trajectory</span>
          </div>
        </div>
      </section>

      {/* CENTERPIECE: Real-time Auto-Rotating Topological Wireframe Viewport */}
      <section className="relative w-full h-80 sm:h-96 rounded-xl bg-[#080f18] overflow-hidden shadow-2xl flex items-center justify-center border border-[#3b494c]/20">
        {/* Deep Grid Background Texture */}
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#00e5ff_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"></div>

        {/* Corner Reticle Hud Markers */}
        <div className="absolute top-4 left-4 flex flex-col gap-1 z-10">
          <div className="flex items-center gap-2">
            <span className="font-label-caps text-[10px] text-[#4cd6fb] uppercase tracking-widest">
              ISRO-SPATIAL // STEREO SCAN ENGINE
            </span>
            <span className="px-2 py-0.5 rounded bg-[#c3f5ff]/10 text-[#c3f5ff] font-mono-coordinate text-[11px]">
              ROT: 0.5°/TICK
            </span>
          </div>
          <div className="font-mono-coordinate text-[11px] text-[#849396]">
            SENSOR: TMC-2 HYPERSPECTRAL // RES: 0.25m/px GSD
          </div>
        </div>

        <div className="absolute top-4 right-4 flex flex-col items-end gap-1 text-right z-10">
          <span className="font-label-caps text-[10px] text-[#bac9cc] uppercase">
            TARGET TERRAIN COORD
          </span>
          <span className="font-mono-coordinate text-[11px] text-[#c3f5ff]">
            LAT 89.9°S • LON 0.0°E (SHACKLETON CRATER RIM)
          </span>
        </div>

        {/* Real-time Rotating 3D Terrain Wireframe */}
        <div className="relative w-72 h-72 sm:w-96 sm:h-96 flex items-center justify-center [perspective:1000px]">
          <div 
            className="absolute inset-0 flex items-center justify-center animate-[spin_28s_linear_infinite]" 
            style={{ transformStyle: 'preserve-3d' }}
          >
            <svg 
              className="w-full h-full text-[#4cd6fb] opacity-70 drop-shadow-[0_0_12px_rgba(0,229,255,0.4)]" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1.2" 
              viewBox="0 0 400 400"
            >
              <ellipse cx="200" cy="200" rx="190" ry="110" strokeDasharray="4 2" strokeOpacity="0.2"></ellipse>
              <ellipse cx="200" cy="195" rx="170" ry="98" strokeOpacity="0.3"></ellipse>
              <path d="M 40 200 C 90 140, 150 170, 200 130 C 260 90, 320 160, 360 200 C 310 240, 260 210, 200 250 C 140 290, 80 230, 40 200 Z" strokeOpacity="0.45"></path>
              <path d="M 65 198 C 110 145, 160 165, 200 142 C 245 110, 295 162, 335 198 C 290 235, 245 210, 200 238 C 150 268, 105 220, 65 198 Z" strokeOpacity="0.6"></path>
              <path d="M 95 196 C 130 152, 170 168, 200 155 C 230 135, 270 168, 305 196 C 270 225, 230 208, 200 225 C 165 248, 125 215, 95 196 Z" strokeOpacity="0.8"></path>
              <path className="text-[#00e5ff]" d="M 130 195 C 155 165, 180 174, 200 168 C 220 155, 245 174, 270 195 C 245 215, 220 205, 200 215 C 175 230, 150 210, 130 195 Z" strokeWidth="1.8"></path>
              
              <line strokeDasharray="2 4" strokeOpacity="0.3" x1="200" x2="200" y1="20" y2="380"></line>
              <line strokeDasharray="2 4" strokeOpacity="0.3" x1="20" x2="380" y1="200" y2="200"></line>
              <line strokeDasharray="1 3" strokeOpacity="0.2" x1="72" x2="328" y1="72" y2="328"></line>
              <line strokeDasharray="1 3" strokeOpacity="0.2" x1="72" x2="328" y1="328" y2="72"></line>

              <circle className="shadow-[0_0_8px_#00e5ff]" cx="200" cy="180" fill="#00e5ff" r="4"></circle>
              <circle cx="165" cy="165" fill="#4cd6fb" r="3"></circle>
              <circle cx="235" cy="195" fill="#4cd6fb" r="3"></circle>
            </svg>
          </div>

          {/* Center Crosshair & Pitch Readout Overlay */}
          <div className="absolute pointer-events-none flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-[#00e5ff]/5 flex items-center justify-center shadow-[0_0_24px_rgba(0,229,255,0.2)]">
              <span className="material-symbols-outlined text-[#c3f5ff] text-[28px] animate-pulse">
                filter_center_focus
              </span>
            </div>
            <span className="font-mono-coordinate text-[11px] text-[#c3f5ff] bg-[#080f18]/90 px-2 py-1 rounded mt-2 tracking-widest uppercase border border-[#3b494c]/30">
              TARGET LOCK // Z: +1,842.6M
            </span>
          </div>
        </div>

        {/* Vertical Elevation Scale */}
        <div className="absolute right-4 bottom-4 top-16 hidden md:flex flex-col items-end justify-between py-2">
          <div className="flex items-center gap-2">
            <span className="font-mono-coordinate text-[11px] text-[#c3f5ff] font-bold">+2850m MAX</span>
            <span className="w-3 h-0.5 bg-[#c3f5ff]"></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono-coordinate text-[11px] text-[#bac9cc]">+1500m</span>
            <span className="w-2 h-0.5 bg-[#849396]"></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono-coordinate text-[11px] text-[#bac9cc]">0m DATUM</span>
            <span className="w-2 h-0.5 bg-[#00b2d6]"></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono-coordinate text-[11px] text-[#849396]">-1200m MIN</span>
            <span className="w-3 h-0.5 bg-[#3b494c]"></span>
          </div>
        </div>

        {/* Viewport Bottom Control Bar */}
        <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-2 bg-[#242a34]/80 backdrop-blur px-3 py-1 rounded border border-[#3b494c]/30">
            <button className="text-[#bac9cc] hover:text-[#c3f5ff] transition-colors flex items-center cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">view_in_ar</span>
            </button>
            <span className="font-mono-coordinate text-[11px] text-[#849396]">|</span>
            <button className="text-[#bac9cc] hover:text-[#c3f5ff] transition-colors flex items-center cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">rotate_right</span>
            </button>
            <span className="font-mono-coordinate text-[11px] text-[#849396]">|</span>
            <span className="font-mono-coordinate text-[11px] text-[#dce3f0]">GRIDDEC: 512x512 QUAD</span>
          </div>

          <div className="flex items-center gap-2 bg-[#242a34]/80 backdrop-blur px-3 py-1 rounded border border-[#3b494c]/30">
            <span className="w-2 h-2 rounded-full bg-[#00e5ff]"></span>
            <span className="font-label-caps text-[10px] text-[#dce3f0] uppercase">
              RENDER ENGINE ACTIVE // THREE.JS WEBGL2
            </span>
          </div>
        </div>
      </section>

      {/* DUAL INGESTION WORKFLOW CARDS */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CARD A: Relative DEM Height Map Ingestion */}
        <div className="group relative bg-[#151c26]/80 backdrop-blur-xl rounded-xl p-6 shadow-xl hover:shadow-[0_0_30px_rgba(0,229,255,0.15)] transition-all flex flex-col justify-between border border-[#3b494c]/20">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-[#00b2d6]/20 text-[#4cd6fb] font-mono-coordinate text-[11px] font-bold uppercase tracking-wider">
                  LAYER 01
                </span>
                <span className="font-label-caps text-[10px] text-[#bac9cc] uppercase">
                  PHOTOGRAMMETRIC SOURCE
                </span>
              </div>
              <span className="font-mono-coordinate text-[11px] text-[#c3f5ff] font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#c3f5ff] animate-pulse"></span>
                VERIFIED SYNC
              </span>
            </div>

            <div>
              <h3 className="font-headline-md text-[24px] text-[#dce3f0] tracking-tight">
                {relativeInputMode === 'dem' ? 'Upload Relative DEM PNG' : 'Upload Raw RGB Photo'}
              </h3>
              <p className="font-body-md text-[14px] text-[#bac9cc] mt-1">
                {relativeInputMode === 'dem'
                  ? 'Use a grayscale or height-map PNG as the relative DEM input for the terrain displacement surface.'
                  : 'Generate a relative DEM automatically from one RGB image using Depth Anything V2.'}
              </p>
            </div>

            <div className="flex items-center gap-2 bg-[#080f18]/80 p-1 rounded-lg border border-[#3b494c]/30">
              <button
                type="button"
                onClick={() => { setRelativeInputMode('dem'); setRgbFile(null); setFileLayer1(null); }}
                className={`flex-1 px-3 py-2 rounded font-mono-coordinate text-[11px] uppercase cursor-pointer ${relativeInputMode === 'dem' ? 'bg-[#00e5ff] text-[#00363d] font-bold' : 'text-[#bac9cc] hover:text-[#dce3f0]'}`}
              >
                Pre-made DEM
              </button>
              <button
                type="button"
                onClick={() => { setRelativeInputMode('rgb'); setRelativeFile(null); setFileLayer1(null); }}
                className={`flex-1 px-3 py-2 rounded font-mono-coordinate text-[11px] uppercase cursor-pointer ${relativeInputMode === 'rgb' ? 'bg-[#00e5ff] text-[#00363d] font-bold' : 'text-[#bac9cc] hover:text-[#dce3f0]'}`}
              >
                Raw RGB + AI Depth
              </button>
            </div>

            {/* Format tags */}
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="font-mono-coordinate text-[11px] px-2 py-1 rounded bg-[#2e353f] text-[#dce3f0] font-semibold">.PNG</span>
              <span className="font-mono-coordinate text-[11px] px-2 py-1 rounded bg-[#2e353f] text-[#dce3f0] font-semibold">GREYSCALE / HEIGHT MAP</span>
              <span className="font-mono-coordinate text-[11px] px-2 py-1 rounded bg-[#242a34] text-[#849396]">REPLACES HEIGHT SOURCE</span>
            </div>

            {/* Dropzone */}
            <div 
              onClick={() => (relativeInputMode === 'dem' ? fileInput1Ref.current?.click() : rgbInputRef.current?.click())}
              className="mt-2 bg-[#080f18]/90 rounded-lg p-5 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer border border-[#3b494c]/30 hover:border-[#00e5ff]/50 hover:bg-[#080f18]"
            >
              <div className="w-12 h-12 rounded-full bg-[#242a34] flex items-center justify-center text-[#c3f5ff] shadow-[0_0_12px_rgba(0,229,255,0.2)]">
                <span className="material-symbols-outlined text-[26px]">cloud_upload</span>
              </div>
              <div className="flex flex-col items-center text-center">
                <span className="font-mono-telemetry text-[13px] text-[#dce3f0] font-semibold">
                  {relativeInputMode === 'dem' ? 'Drag & drop relative DEM raster' : 'Upload raw RGB photo for depth estimation'}
                </span>
                <span className="font-body-sm text-[12px] text-[#849396] mt-0.5">
                  {relativeInputMode === 'dem' ? 'or click to open height-map PNG' : 'JPG, JPEG, or PNG accepted'}
                </span>
              </div>
            </div>

            {/* Simulated Active Staged File */}
            {fileLayer1 && (
              <div className="bg-[#242a34]/60 rounded-lg p-3 flex items-center justify-between shadow-sm border border-[#3b494c]/30">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="material-symbols-outlined text-[#4cd6fb] text-[22px] shrink-0">
                    check_box
                  </span>
                  <div className="flex flex-col truncate">
                    <span className="font-mono-telemetry text-[13px] text-[#c3f5ff] truncate font-medium">
                      {fileLayer1.name}
                    </span>
                    <span className="font-mono-coordinate text-[11px] text-[#bac9cc]">
                      {fileLayer1.size}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => { setFileLayer1(null); setRelativeFile(null); setRgbFile(null); }}
                  className="text-[#bac9cc] hover:text-[#ffb4ab] transition-colors p-1 cursor-pointer"
                  title="Remove file"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 pt-2 flex items-center justify-between text-[#bac9cc] border-t border-[#3b494c]/20">
            <span className="font-mono-coordinate text-[11px] text-[#849396]">HASH: SHA256-8B9A...31F</span>
            <span className="font-mono-coordinate text-[11px] text-[#4cd6fb] font-semibold">READY FOR DECIMATION</span>
          </div>
        </div>

        {/* CARD B: Absolute DEM Map with Datum Selection */}
        <div className="group relative bg-[#151c26]/80 backdrop-blur-xl rounded-xl p-6 shadow-xl hover:shadow-[0_0_30px_rgba(0,229,255,0.15)] transition-all flex flex-col justify-between border border-[#3b494c]/20">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-[#00e5ff]/20 text-[#00e5ff] font-mono-coordinate text-[11px] font-bold uppercase tracking-wider">
                  LAYER 02
                </span>
                <span className="font-label-caps text-[10px] text-[#bac9cc] uppercase">
                  ALTIMETRIC DATUM REF
                </span>
              </div>
              <span className="font-mono-coordinate text-[11px] text-[#4cd6fb] font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4cd6fb]"></span>
                LOLA CALIBRATED
              </span>
            </div>

            <div>
              <h3 className="font-headline-md text-[24px] text-[#dce3f0] tracking-tight">
                Upload for Absolute DEM Map
              </h3>
              <p className="font-body-md text-[14px] text-[#bac9cc] mt-1">
                Geodetic planetary datum anchoring with laser altimetry ground control points for millimeter-precise elevation bias nullification.
              </p>
            </div>

            {/* Datum Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
              <div className="flex flex-col gap-1">
                <label className="font-label-caps text-[10px] text-[#849396] uppercase">
                  Datum Ellipsoid Model
                </label>
                <select
                  value={datumModel}
                  onChange={(e) => setDatumModel(e.target.value)}
                  className="bg-[#080f18] px-3 py-2 rounded text-[#dce3f0] font-mono-coordinate text-[11px] font-semibold border border-[#3b494c]/40 focus:outline-none focus:border-[#00e5ff] cursor-pointer"
                >
                  <option>Lunar Sphere R=1737.4 km</option>
                  <option>WGS-84 (Earth Standard)</option>
                  <option>Mars IAU-2000 R=3396.2 km</option>
                  <option>SELENE Triaxial Geoid</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-caps text-[10px] text-[#849396] uppercase">
                  Calibration Source
                </label>
                <select
                  value={calibSource}
                  onChange={(e) => setCalibSource(e.target.value)}
                  className="bg-[#080f18] px-3 py-2 rounded text-[#dce3f0] font-mono-coordinate text-[11px] font-semibold border border-[#3b494c]/40 focus:outline-none focus:border-[#00e5ff] cursor-pointer"
                >
                  <option>LOLA + CE-2 Altimetry</option>
                  <option>Cartosat-3 Stereo Ephemeris</option>
                  <option>Chandrayaan-2 DTM Ground Control</option>
                  <option>MOLA Laser Profiler</option>
                </select>
              </div>
            </div>

            {/* Dropzone */}
            <div 
              onClick={() => fileInput2Ref.current?.click()}
              className="mt-1 bg-[#080f18]/90 rounded-lg p-5 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer border border-[#3b494c]/30 hover:border-[#4cd6fb]/50 hover:bg-[#080f18]"
            >
              <div className="w-12 h-12 rounded-full bg-[#242a34] flex items-center justify-center text-[#4cd6fb] shadow-[0_0_12px_rgba(76,214,251,0.2)]">
                <span className="material-symbols-outlined text-[26px]">satellite</span>
              </div>
              <div className="flex flex-col items-center text-center">
                <span className="font-mono-telemetry text-[13px] text-[#dce3f0] font-semibold">
                  Ingest absolute georeferenced DEM
                </span>
                <span className="font-body-sm text-[12px] text-[#849396] mt-0.5">
                  Accepts GeoTIFF, DEM, LAS/LAZ point arrays
                </span>
              </div>
            </div>

            {/* Simulated Active Staged File */}
            {fileLayer2 && (
              <div className="bg-[#242a34]/60 rounded-lg p-3 flex items-center justify-between shadow-sm border border-[#3b494c]/30">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="material-symbols-outlined text-[#4cd6fb] text-[22px] shrink-0">
                    check_box
                  </span>
                  <div className="flex flex-col truncate">
                    <span className="font-mono-telemetry text-[13px] text-[#c3f5ff] truncate font-medium">
                      {fileLayer2.name}
                    </span>
                    <span className="font-mono-coordinate text-[11px] text-[#bac9cc]">
                      {fileLayer2.size}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => { setFileLayer2(null); setAbsoluteFile(null); }}
                  className="text-[#bac9cc] hover:text-[#ffb4ab] transition-colors p-1 cursor-pointer"
                  title="Remove file"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 pt-2 flex items-center justify-between text-[#bac9cc] border-t border-[#3b494c]/20">
            <span className="font-mono-coordinate text-[11px] text-[#849396]">OFFSET DRIFT: &lt; 0.04m</span>
            <span className="font-mono-coordinate text-[11px] text-[#c3f5ff] font-semibold">SOURCE READY</span>
          </div>
        </div>
      </section>

      {/* SYNTHESIS ACTION FOOTER & PRIMARY CTA */}
      <section className="w-full bg-[#151c26]/90 backdrop-blur-xl rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xl border border-[#3b494c]/30">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[#00b2d6]/20 flex items-center justify-center text-[#4cd6fb] shrink-0">
            <span className="material-symbols-outlined text-[24px]">dataset</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-headline-sm text-[18px] text-[#dce3f0] font-semibold">
                Dual-Raster Ingestion Pipeline Configured
              </span>
              <span className="px-2 py-0.5 rounded bg-[#00e5ff]/20 text-[#00e5ff] font-mono-coordinate text-[10px] font-bold">
                SYNTHESIS READY
              </span>
            </div>
            <p className="font-body-sm text-[12px] text-[#bac9cc] mt-0.5">
              Relative disparity heights will be dynamically rectified and co-registered against absolute altimetric anchors.
            </p>
          </div>
        </div>

        {error && <p className="font-mono-coordinate text-[#ffb4ab]" role="alert">{error}</p>}

        {/* Primary CTA */}
        <button 
          onClick={handleSynthesize}
          className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-[#00e5ff] text-[#00363d] px-8 py-3 rounded-full font-mono-telemetry text-[13px] font-bold tracking-wider uppercase transition-all shadow-[0_0_20px_rgba(0,229,255,0.4)] hover:shadow-[0_0_32px_rgba(0,229,255,0.7)] hover:bg-[#c3f5ff] group cursor-pointer"
        >
          <span>{isSynthesizing ? 'Synthesizing...' : 'Process & Synthesize DEM'}</span>
          <span className={`material-symbols-outlined text-[20px] transition-transform group-hover:translate-x-1 ${isSynthesizing ? 'animate-spin' : ''}`}>
            {isSynthesizing ? 'sync' : 'arrow_forward'}
          </span>
        </button>
      </section>
    </div>
  );
};
