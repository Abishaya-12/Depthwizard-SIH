import React, { useEffect, useRef, useState } from 'react';
import { TabId } from '../types';
import { createTerrainEngine } from '../../../src/script.js';

interface FlythroughPathProps {
  onNavigate: (tab: TabId) => void;
  previewImage?: string | null;
  originalPhotoUrl?: string | null;
  zExaggeration: number;
}

export const FlythroughPath: React.FC<FlythroughPathProps> = ({ onNavigate, previewImage, originalPhotoUrl, zExaggeration }) => {
  const terrainRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ReturnType<typeof createTerrainEngine> | null>(null);
  const [cameraPreset, setCameraPreset] = useState<'front' | 'top' | 'orbit' | 'reset'>('front');
  const [autopilot, setAutopilot] = useState(false);

  useEffect(() => {
    if (!terrainRef.current) return;
    engineRef.current = createTerrainEngine(terrainRef.current, {
      mode: 'flythrough',
      heightMap: previewImage ?? undefined,
      textureMap: originalPhotoUrl ?? previewImage ?? undefined,
    });
    engineRef.current.update({
      displacementScale: zExaggeration,
      autoRotate: autopilot,
      cameraPreset,
    });
    return () => engineRef.current?.destroy();
  }, [previewImage, originalPhotoUrl, zExaggeration]);

  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.update({ autoRotate: autopilot, cameraPreset });
  }, [autopilot, cameraPreset]);

  const handleRecenter = () => {
    setCameraPreset('reset');
    engineRef.current?.update({ resetCamera: true, autoRotate: false });
  };

  return (
    <div className="flex flex-col w-full h-[calc(100vh-4rem)] relative overflow-hidden bg-[#080f18] select-none">
      <div className="absolute inset-0">
        <div
          ref={terrainRef}
          tabIndex={0}
          onPointerDown={(event) => event.currentTarget.focus()}
          className="absolute inset-0 outline-none"
          aria-label="Generated Three.js flythrough terrain"
        />
      </div>

      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-[#151c26]/80 px-3 py-2 rounded-xl border border-[#3b494c]/30 backdrop-blur-md">
          {(['front', 'top', 'orbit', 'reset'] as const).map((preset) => (
            <button
              key={preset}
              onClick={() => {
                setCameraPreset(preset);
                engineRef.current?.update({ cameraPreset: preset, autoRotate: false });
              }}
              className={`px-3 py-1.5 rounded-full font-mono-coordinate text-[10px] uppercase transition-all cursor-pointer ${
                cameraPreset === preset
                  ? 'bg-[#00e5ff] text-[#00363d] font-bold'
                  : 'text-[#bac9cc] bg-[#242a34] hover:text-white'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 bg-[#151c26]/80 px-3 py-2 rounded-xl border border-[#3b494c]/30 backdrop-blur-md">
          <button
            onClick={() => setAutopilot((prev) => !prev)}
            className={`px-3 py-1.5 rounded-full font-mono-coordinate text-[10px] uppercase cursor-pointer ${
              autopilot ? 'bg-[#00e5ff] text-[#00363d]' : 'bg-[#242a34] text-[#bac9cc]'
            }`}
          >
            {autopilot ? 'autopilot on' : 'manual fly'}
          </button>
          <button
            onClick={handleRecenter}
            className="px-3 py-1.5 rounded-full bg-[#242a34] text-[#dce3f0] font-mono-coordinate text-[10px] uppercase cursor-pointer"
          >
            recenter
          </button>
          <button
            onClick={() => onNavigate('3d-dem-viewer')}
            className="px-3 py-1.5 rounded-full bg-[#00e5ff] text-[#00363d] font-mono-coordinate text-[10px] uppercase cursor-pointer font-bold"
          >
            exit
          </button>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3">
        <div className="bg-[#151c26]/80 px-4 py-2 rounded-xl border border-[#3b494c]/30 text-[#dce3f0] font-mono-coordinate text-[10px] uppercase tracking-wide backdrop-blur-md">
          W/A/S/D move • Q/E rise/fall • drag mouse to look • SHIFT boost
        </div>
      </div>
    </div>
  );
};
