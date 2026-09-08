import React from 'react';
import { TabId } from '../types';

interface SidebarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab }) => {
  const menuItems: { id: TabId; label: string; icon: string }[] = [
    { id: 'welcome-portal', label: '01 : Overview', icon: 'grid_view' },
    { id: 'setup-upload', label: '02 : Data Ingestion', icon: 'satellite_alt' },
    { id: 'map-generated', label: '03 : Mesh Processing', icon: 'layers' },
    { id: '3d-dem-viewer', label: '04 : DEM Viewport', icon: 'view_in_ar' },
    { id: '3d-flythrough', label: '05 : Flythrough Path', icon: 'flight' },
  ];

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-64 bg-[#151c26]/70 backdrop-blur-xl z-40 flex flex-col justify-between py-4 shadow-[4px_0_24px_rgba(0,0,0,0.4)] border-r border-[#3b494c]/20">
      <div className="flex flex-col gap-2">
        <div className="px-4 py-1">
          <span className="font-label-caps text-[10px] text-[#849396] uppercase tracking-wider">
            Operational Windows
          </span>
        </div>

        <nav className="flex flex-col gap-1 px-2">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-3 px-3 py-2 rounded text-left transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#00e5ff] text-[#00363d] font-bold shadow-[0_0_12px_rgba(0,229,255,0.3)]'
                    : 'text-[#bac9cc] hover:bg-[#242a34] hover:text-[#dce3f0]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px] shrink-0">
                  {item.icon}
                </span>
                <span className="font-mono-telemetry text-[13px]">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Sensor Mode Status Card */}
      <div className="px-4 pt-3 pb-2 bg-[#080f18]/50 mx-2 rounded border border-[#3b494c]/20">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-label-caps text-[10px] text-[#849396] uppercase">
            Sensor Mode
          </span>
          <span className="font-label-caps text-[10px] text-[#4cd6fb] uppercase font-semibold">
            Active
          </span>
        </div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-mono-coordinate text-[11px] text-[#bac9cc]">
            Resolution
          </span>
          <span className="font-mono-coordinate text-[11px] text-[#dce3f0]">
            0.25m / px
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono-coordinate text-[11px] text-[#bac9cc]">
            Elevation Bias
          </span>
          <span className="font-mono-coordinate text-[11px] text-[#00daf3] font-semibold">
            ±0.04m
          </span>
        </div>
      </div>
    </aside>
  );
};
