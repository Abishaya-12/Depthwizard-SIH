import React, { useEffect, useRef, useState } from 'react';
import { TabId } from '../types';

interface WelcomePortalProps {
  onNavigate: (tab: TabId) => void;
}

export const WelcomePortal: React.FC<WelcomePortalProps> = ({ onNavigate }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [typedText, setTypedText] = useState('');
  const [isDense, setIsDense] = useState(false);
  const [isBenchmarking, setIsBenchmarking] = useState(false);

  // Typewriter effect
  useEffect(() => {
    const fullText = "Welcome to DepthWizard";
    let index = 0;
    let timer: NodeJS.Timeout;

    const typeNext = () => {
      if (index <= fullText.length) {
        setTypedText(fullText.slice(0, index));
        index++;
        const delay = Math.random() * 40 + 35 + (fullText[index - 1] === ' ' ? 80 : 0);
        timer = setTimeout(typeNext, delay);
      }
    };

    timer = setTimeout(typeNext, 250);
    return () => clearTimeout(timer);
  }, []);

  // Topographic interactive mathematical wave mesh
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let animId: number;
    let time = 0;
    let waveIntensity = isDense ? 1.8 : 1.0;
    if (isBenchmarking) waveIntensity = 2.5;

    const mouse = { x: -1000, y: -1000, targetX: -1000, targetY: -1000 };

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = canvas.parentElement?.clientWidth || window.innerWidth;
      height = canvas.parentElement?.clientHeight || window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.resetTransform?.();
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.targetX = e.clientX - rect.left;
      mouse.targetY = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouse.targetX = -1000;
      mouse.targetY = -1000;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    const render = () => {
      time += 0.018;
      mouse.x += (mouse.targetX - mouse.x) * 0.08;
      mouse.y += (mouse.targetY - mouse.y) * 0.08;

      ctx.clearRect(0, 0, width, height);

      const cols = isDense ? 36 : 22;
      const rows = isDense ? 24 : 16;
      const cellW = width / cols;
      const cellH = height / rows;

      const grid: { x: number; y: number; z: number }[][] = [];

      for (let j = 0; j <= rows; j++) {
        grid[j] = [];
        for (let i = 0; i <= cols; i++) {
          const baseX = i * cellW;
          const baseY = j * cellH;

          const distToMouse = Math.hypot(baseX - mouse.x, baseY - mouse.y);
          const mouseEffect = Math.max(0, 1 - distToMouse / 280);

          const elevation = (
            Math.sin(i * 0.35 + time) * 8 +
            Math.cos(j * 0.4 + time * 0.8) * 10 +
            Math.sin((i + j) * 0.2 + time * 1.2) * 6
          ) * waveIntensity;

          const pushZ = Math.sin(mouseEffect * Math.PI) * 32 * waveIntensity;
          const finalX = baseX;
          const finalY = baseY - elevation - pushZ;

          grid[j][i] = { x: finalX, y: finalY, z: elevation + pushZ };
        }
      }

      ctx.lineWidth = 1;

      // Horizontal contour lines
      for (let j = 0; j <= rows; j++) {
        ctx.beginPath();
        for (let i = 0; i <= cols; i++) {
          const p = grid[j][i];
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = 'rgba(0, 218, 243, 0.14)';
        ctx.stroke();
      }

      // Vertical iso lines
      for (let i = 0; i <= cols; i++) {
        ctx.beginPath();
        for (let j = 0; j <= rows; j++) {
          const p = grid[j][i];
          if (j === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = 'rgba(76, 214, 251, 0.09)';
        ctx.stroke();
      }

      // Elevated nodes
      for (let j = 0; j <= rows; j += (isDense ? 3 : 2)) {
        for (let i = 0; i <= cols; i += (isDense ? 3 : 2)) {
          const p = grid[j][i];
          const alpha = Math.min(1, Math.max(0.15, (p.z + 15) / 45));

          ctx.fillStyle = `rgba(0, 229, 255, ${alpha * 0.75})`;
          ctx.fillRect(p.x - 1, p.y - 1, 2.5, 2.5);

          const dist = Math.hypot(p.x - mouse.x, p.y - mouse.y);
          if (dist < 140) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 229, 255, 0.45)';
            ctx.fill();
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isDense, isBenchmarking]);

  const handleRunBenchmark = () => {
    setIsBenchmarking(true);
    setTimeout(() => {
      setIsBenchmarking(false);
    }, 2200);
  };

  return (
    <div className="flex flex-col w-full relative min-h-[calc(100vh-4rem)] overflow-hidden bg-[#0d141d] select-none">
      {/* Interactive Mathematical Canvas Mesh */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 w-full h-full pointer-events-auto z-0" 
      />

      {/* Ambient Optical Gradients */}
      <div className="absolute inset-0 bg-radial from-[#00b2d6]/10 via-transparent to-[#0d141d]/90 pointer-events-none z-10"></div>
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-[#00e5ff]/5 blur-[120px] pointer-events-none rounded-full"></div>

      {/* HUD Reticle Alignment Frame Overlay */}
      <div className="absolute inset-x-8 inset-y-6 pointer-events-none z-20 flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2 bg-[#080f18]/80 px-3 py-1 rounded-lg backdrop-blur-md shadow-sm border border-[#3b494c]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00daf3] animate-ping"></span>
            <span className="font-mono-coordinate text-[11px] text-[#c3f5ff] tracking-widest uppercase">
              SYS.BEACON // 0x7F-LOLA
            </span>
          </div>
          <div className="hidden sm:flex flex-col items-end text-right bg-[#080f18]/60 px-3 py-1 rounded-lg backdrop-blur-sm border border-[#3b494c]/20">
            <span className="font-label-caps text-[10px] text-[#bac9cc] uppercase">
              Sub-Orbital Optical View
            </span>
            <span className="font-mono-coordinate text-[11px] text-[#4cd6fb] tracking-widest">
              FOV: 64.2° | INC: 89.9° P
            </span>
          </div>
        </div>

        <div className="flex justify-between items-end">
          <div className="flex items-center gap-4">
            <div className="h-12 w-1 bg-gradient-to-b from-[#00e5ff] to-transparent opacity-40"></div>
            <div className="flex flex-col">
              <span className="font-label-caps text-[10px] text-[#849396] uppercase tracking-wider">
                Geodetic Frame
              </span>
              <span className="font-mono-coordinate text-[11px] text-[#dce3f0]">
                SELENE / LOLA GEOID REV 1.4
              </span>
            </div>
          </div>
          <div className="text-right flex flex-col items-end">
            <span className="font-label-caps text-[10px] text-[#849396] uppercase tracking-wider">
              Raster Buffer
            </span>
            <span className="font-mono-coordinate text-[11px] text-[#c3f5ff]">
              0.00 GB ALLOCATED
            </span>
          </div>
        </div>
      </div>

      {/* Central Scientific Instrument Stage */}
      <div className="relative z-30 flex-1 flex flex-col items-center justify-center px-6 text-center max-w-5xl mx-auto w-full my-auto py-12">
        {/* Status Chip */}
        <div className="inline-flex items-center gap-3 px-4 py-1 rounded-full bg-[#151c26]/70 backdrop-blur-xl shadow-lg mb-6 border border-[#3b494c]/30">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c3f5ff] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00e5ff]"></span>
          </span>
          <span className="font-mono-coordinate text-[11px] tracking-widest uppercase text-[#4cd6fb]">
            CHANDRAYAAN-2 TMC-2 DTM SYNCHRONIZER
          </span>
          <span className="font-label-caps text-[10px] px-2 py-0.5 rounded bg-[#242a34] text-[#9cf0ff] font-bold">
            ONLINE
          </span>
        </div>

        {/* Typewritten Headline */}
        <div className="min-h-[72px] sm:min-h-[84px] flex items-center justify-center">
          <h1 className="font-display-lg text-[28px] sm:text-[56px] text-[#c3f5ff] tracking-tight font-semibold flex items-center">
            <span>{typedText}</span>
            <span className="inline-block w-1 sm:w-1.5 h-8 sm:h-12 ml-1 bg-[#00e5ff] shadow-[0_0_12px_#00daf3] animate-pulse"></span>
          </h1>
        </div>

        {/* Technical Mission Subtitle */}
        <p className="mt-4 font-mono-telemetry text-[13px] text-[#bac9cc] max-w-2xl mx-auto leading-relaxed tracking-wide">
          ISRO Lunar &amp; Planetary Digital Elevation Model (DEM) Synthesizer // SIH-2024
          <span className="block mt-1 text-[#4cd6fb] font-mono-coordinate text-[11px] opacity-80">
            Cartographic Stereoscopy • Epipolar Inversion • Point Cloud Densification
          </span>
        </p>

        {/* Action Triggers */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
          <button 
            onClick={() => onNavigate('setup-upload')}
            className="group relative inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-[#00e5ff] text-[#00363d] font-mono-telemetry text-[13px] font-bold tracking-wider uppercase transition-all duration-300 shadow-[0_0_24px_rgba(0,218,243,0.35)] hover:shadow-[0_0_36px_rgba(0,218,243,0.7)] hover:scale-105 active:scale-95 cursor-pointer"
          >
            <span>Initialize Pipeline</span>
            <span className="material-symbols-outlined text-[18px] transition-transform duration-300 group-hover:translate-x-1">
              arrow_forward
            </span>
          </button>

          <button 
            onClick={handleRunBenchmark}
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#242a34]/80 text-[#c3f5ff] hover:bg-[#333a44] font-mono-telemetry text-[13px] transition-all duration-200 shadow-md border border-[#3b494c]/30 cursor-pointer ${
              isBenchmarking ? 'ring-2 ring-[#00e5ff] shadow-[0_0_20px_rgba(0,229,255,0.4)]' : ''
            }`}
          >
            <span className={`material-symbols-outlined text-[16px] ${isBenchmarking ? 'animate-spin text-[#00e5ff]' : ''}`}>
              {isBenchmarking ? 'sync' : 'play_circle'}
            </span>
            <span>{isBenchmarking ? 'Running Benchmark...' : 'Run Synthetic Benchmark'}</span>
          </button>
        </div>

        {/* Dynamic Geodetic Target Metadata Mosaic */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-3xl pt-4">
          <div className="p-3 rounded-lg bg-[#080f18]/60 backdrop-blur-md shadow-sm text-left border border-[#3b494c]/20">
            <div className="font-label-caps text-[10px] text-[#849396] uppercase">Spatial Sampling</div>
            <div className="font-mono-telemetry text-[13px] text-[#dce3f0] font-semibold mt-1">0.25 m/GSD</div>
          </div>
          <div className="p-3 rounded-lg bg-[#080f18]/60 backdrop-blur-md shadow-sm text-left border border-[#3b494c]/20">
            <div className="font-label-caps text-[10px] text-[#849396] uppercase">Target Zone</div>
            <div className="font-mono-telemetry text-[13px] text-[#4cd6fb] font-semibold mt-1">South Pole Aitken</div>
          </div>
          <div className="p-3 rounded-lg bg-[#080f18]/60 backdrop-blur-md shadow-sm text-left border border-[#3b494c]/20">
            <div className="font-label-caps text-[10px] text-[#849396] uppercase">Confidence Index</div>
            <div className="font-mono-telemetry text-[13px] text-[#c3f5ff] font-semibold mt-1">99.84% (Q-Flag)</div>
          </div>
          <div className="p-3 rounded-lg bg-[#080f18]/60 backdrop-blur-md shadow-sm text-left border border-[#3b494c]/20">
            <div className="font-label-caps text-[10px] text-[#849396] uppercase">Processing Kernel</div>
            <div className="font-mono-telemetry text-[13px] text-[#dce3f0] font-semibold mt-1">CUDA-DEM-v8</div>
          </div>
        </div>
      </div>

      {/* Persistent Bottom Mission Telemetry Strip */}
      <div className="relative z-30 mt-auto w-full bg-[#080f18]/90 backdrop-blur-xl px-6 py-2 shadow-[0_-4px_20px_rgba(0,0,0,0.5)] border-t border-[#3b494c]/30">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-3 flex-wrap justify-center md:justify-start">
            <span className="font-mono-coordinate text-[11px] text-[#849396]">
              SYS_VER: <span className="text-[#dce3f0]">4.2.0</span>
            </span>
            <span className="text-[#3b494c] font-mono-coordinate">•</span>
            <span className="font-mono-coordinate text-[11px] text-[#849396]">
              COORD_SYS: <span className="text-[#4cd6fb]">WGS84/LOLA</span>
            </span>
            <span className="text-[#3b494c] font-mono-coordinate">•</span>
            <span className="font-mono-coordinate text-[11px] text-[#00daf3] font-medium tracking-wide">
              STATUS: READY FOR RASTER INGESTION
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="font-label-caps text-[10px] text-[#bac9cc] uppercase">
                INTERACTIVE BENCHMARK:
              </span>
              <button 
                onClick={() => setIsDense(!isDense)}
                className="font-mono-coordinate text-[11px] text-[#4cd6fb] bg-[#242a34] px-2 py-1 rounded hover:bg-[#333a44] transition-colors cursor-pointer border border-[#3b494c]/40"
              >
                {isDense ? "MODE: HIGH-RES ELEVATION" : "MODE: TOPOLOGICAL SPARSE"}
              </button>
            </div>

            <button 
              onClick={() => onNavigate('setup-upload')}
              className="flex items-center gap-1 font-mono-coordinate text-[11px] text-[#c3f5ff] hover:text-white transition-colors cursor-pointer"
            >
              <span>WINDOW 02</span>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
