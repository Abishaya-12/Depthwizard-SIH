import React from 'react';
import { TabId } from '../types';
import logo from '../../../Logo.jpeg';

interface HeaderProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onSelectTab }) => {
  const tabs: { id: TabId; num: string; label: string }[] = [
    { id: 'welcome-portal', num: '01', label: 'Intro' },
    { id: 'setup-upload', num: '02', label: 'Setup' },
    { id: 'map-generated', num: '03', label: 'Mesh' },
    { id: '3d-dem-viewer', num: '04', label: 'Viewport' },
    { id: '3d-flythrough', num: '05', label: 'Trajectory' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#080f18]/80 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.6)] border-b border-[#3b494c]/20">
      <div className="h-16 w-full px-4 flex items-center justify-between gap-4">
        {/* Logo and Brand */}
        <div 
          className="flex items-center gap-4 min-w-max cursor-pointer"
          onClick={() => onSelectTab('welcome-portal')}
        >
          <img 
            alt="DepthWizard ISRO Logo" 
            className="h-8 w-auto object-contain" 
            src={logo}
          />
          <div className="flex flex-col">
            <span className="font-headline-sm text-[18px] text-[#c3f5ff] tracking-tight font-bold">
              DepthWizard
            </span>
            <span className="font-mono-coordinate text-[11px] text-[#4cd6fb] uppercase">
              ISRO Spatial Core • v3.8
            </span>
          </div>
          <div className="hidden xl:flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#242a34]/60">
            <span className="w-2 h-2 rounded-full bg-[#00e5ff] animate-pulse"></span>
            <span className="font-label-caps text-[10px] text-[#bac9cc] uppercase tracking-wider">
              CARTOSAT-3 / CHANDRAYAAN DEM SYSTEM ONLINE
            </span>
          </div>
        </div>

        {/* Center Tabs & Coordinate Readout */}
        <div className="hidden lg:flex items-center gap-6">
          <nav className="flex items-center gap-1 px-1 py-1 bg-[#151c26]/70 rounded">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onSelectTab(tab.id)}
                  className={`px-2.5 py-1 text-[13px] font-mono-telemetry transition-all rounded cursor-pointer ${
                    isActive
                      ? 'bg-[#00e5ff] text-[#00363d] font-bold shadow-[0_0_12px_rgba(0,229,255,0.4)]'
                      : 'text-[#bac9cc] hover:bg-[#242a34] hover:text-[#dce3f0]'
                  }`}
                >
                  {tab.num} {tab.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 px-3 py-1 bg-[#19202a]/60 rounded">
            <span className="font-mono-coordinate text-[11px] text-[#bac9cc]">
              LAT <span className="text-[#c3f5ff] font-semibold">14.0532° N</span>
            </span>
            <span className="font-mono-coordinate text-[11px] text-[#bac9cc]">
              LON <span className="text-[#c3f5ff] font-semibold">77.1042° E</span>
            </span>
          </div>
        </div>

        {/* Telemetry and Profile */}
        <div className="flex items-center gap-4 min-w-max">
          <div className="hidden sm:flex flex-col text-right">
            <span className="font-label-caps text-[10px] text-[#bac9cc] uppercase">
              Telemetry Link
            </span>
            <span className="font-mono-coordinate text-[11px] text-[#4cd6fb]">
              Uplink 8.4 GHz • Polar Orbit
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#c3f5ff] flex items-center justify-center text-[#00363d] shadow-sm">
            <span className="material-symbols-outlined text-[18px]">person</span>
          </div>
        </div>
      </div>
    </header>
  );
};
