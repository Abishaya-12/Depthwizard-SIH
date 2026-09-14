import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Rectangle, TileLayer, useMap } from 'react-leaflet';
import { estimateDepthFromImage, fetchDemByBbox, processDemFiles } from '../api';
import { DemProcessingResponse, TabId } from '../types';

interface Bbox {
  south: number;
  north: number;
  west: number;
  east: number;
}

interface BboxDrawerProps {
  onDraw: (bbox: Bbox | null) => void;
}

const BboxDrawer: React.FC<BboxDrawerProps> = ({ onDraw }) => {
  const map = useMap();
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);
  const startPointRef = useRef<L.LatLng | null>(null);
  const onDrawRef = useRef(onDraw);

  onDrawRef.current = onDraw;

  useEffect(() => {
    const container = map.getContainer();
    let wasDraggingEnabled = true;

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      startPointRef.current = map.mouseEventToLatLng(event);
      wasDraggingEnabled = map.dragging.enabled();
      map.dragging.disable();
      event.preventDefault();
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!startPointRef.current) return;
      const currentPoint = map.mouseEventToLatLng(event);
      setBounds(L.latLngBounds(startPointRef.current, currentPoint));
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (!startPointRef.current) return;
      const currentPoint = map.mouseEventToLatLng(event);
      const nextBounds = L.latLngBounds(startPointRef.current, currentPoint);
      startPointRef.current = null;
      if (wasDraggingEnabled) map.dragging.enable();

      if (nextBounds.getNorth() - nextBounds.getSouth() < 0.001 || nextBounds.getEast() - nextBounds.getWest() < 0.001) {
        setBounds(null);
        onDrawRef.current(null);
        return;
      }

      setBounds(nextBounds);
      onDrawRef.current({
        south: nextBounds.getSouth(),
        north: nextBounds.getNorth(),
        west: nextBounds.getWest(),
        east: nextBounds.getEast(),
      });
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (startPointRef.current && wasDraggingEnabled) map.dragging.enable();
    };
  }, [map]);

  return bounds ? <Rectangle bounds={bounds} pathOptions={{ color: '#00e5ff', weight: 2 }} /> : null;
};

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
  const [bbox, setBbox] = useState<Bbox | null>(null);
  const [isFetchingDem, setIsFetchingDem] = useState(false);
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

  const handleFetchDem = async () => {
    if (!bbox) return;

    setIsFetchingDem(true);
    setError(null);
    try {
      const result = await fetchDemByBbox(bbox);
      const response = await fetch(result.demUrl);
      if (!response.ok) throw new Error('The fetched DEM file could not be downloaded.');
      const demFile = new File([await response.blob()], `bhuvan-dem-${result.jobId}.tif`, { type: 'image/tiff' });
      setAbsoluteFile(demFile);
      setPreviewImage(result.previewImage ?? null);
      setFileLayer2({
        name: demFile.name,
        size: `${(demFile.size / (1024 * 1024)).toFixed(1)} MB • Downloaded • GeoTIFF WGS84`,
        verified: true,
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'DEM area fetch failed.');
    } finally {
      setIsFetchingDem(false);
    }
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

      {/* ISRO BHUVAN MAP NAVIGATION */}
      <section className="relative w-full overflow-hidden rounded-xl bg-[#080f18] p-6 sm:p-8 shadow-2xl border border-[#3b494c]/20">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#00e5ff_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"></div>
        <div className="relative z-10 flex flex-col gap-5">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-[#00e5ff] text-[22px]">public</span>
              <span className="font-label-caps text-[10px] text-[#4cd6fb] uppercase tracking-widest">
                ISRO GEOSPATIAL ACCESS
              </span>
            </div>
            <h2 className="font-headline-md text-[24px] sm:text-[28px] text-[#c3f5ff] font-semibold">
              Navigate in Bhuvan
            </h2>
            <p className="font-body-md text-[14px] text-[#bac9cc] mt-2 leading-relaxed">
              Draw a small area on the map to fetch an SRTM elevation raster directly into the absolute DEM layer.
            </p>
          </div>
            <div className="flex items-center gap-3">
              <span className="font-mono-coordinate text-[11px] text-[#849396]">DRAG TO DRAW AREA</span>
              <a href="https://bhuvan.nrsc.gov.in/" target="_blank" rel="noopener noreferrer" className="font-mono-coordinate text-[11px] text-[#4cd6fb] underline underline-offset-2 hover:text-[#c3f5ff]">
                Open full Bhuvan portal
              </a>
            </div>
          </div>
          <div className="h-[400px] overflow-hidden rounded-lg border border-[#3b494c]/40">
            <MapContainer center={[20.5937, 78.9629]} zoom={5} scrollWheelZoom className="h-full w-full">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <BboxDrawer onDraw={setBbox} />
            </MapContainer>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#151c26]/80 rounded-lg px-4 py-3 border border-[#3b494c]/30">
            <span className="font-mono-coordinate text-[11px] text-[#bac9cc]">
              {bbox ? `S ${bbox.south.toFixed(3)} | N ${bbox.north.toFixed(3)} | W ${bbox.west.toFixed(3)} | E ${bbox.east.toFixed(3)}` : 'NO AREA SELECTED'}
            </span>
            <button
              type="button"
              onClick={handleFetchDem}
              disabled={!bbox || isFetchingDem}
              className="inline-flex items-center justify-center gap-2 bg-[#00e5ff] text-[#00363d] px-5 py-2.5 rounded-full font-mono-telemetry text-[12px] font-bold tracking-wider uppercase transition-all hover:bg-[#c3f5ff] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>{isFetchingDem ? 'Fetching DEM...' : 'Fetch DEM for this area'}</span>
              <span className={`material-symbols-outlined text-[17px] ${isFetchingDem ? 'animate-spin' : ''}`}>{isFetchingDem ? 'sync' : 'download'}</span>
            </button>
          </div>
        </div>
        <div className="relative z-10 mt-6 pt-4 border-t border-[#3b494c]/30 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono-coordinate text-[11px] text-[#849396]">
          <span>PROVIDER: ISRO / NRSC</span>
          <span>DATA: OPENTOPOGRAPHY SRTMGL1</span>
          <span className="text-[#4cd6fb]">MAP: OPENSTREETMAP BASEMAP</span>
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
