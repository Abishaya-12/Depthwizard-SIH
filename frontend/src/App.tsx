import React, { useState } from 'react';
import { DemProcessingResponse, TabId } from './types';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { WelcomePortal } from './components/WelcomePortal';
import { SetupUpload } from './components/SetupUpload';
import { MeshProcessing } from './components/MeshProcessing';
import { DemViewport } from './components/DemViewport';
import { FlythroughPath } from './components/FlythroughPath';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('welcome-portal');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [processingResult, setProcessingResult] = useState<DemProcessingResponse | null>(null);

  return (
    <div className="min-h-screen bg-[#0d141d] text-[#dce3f0] selection:bg-[#00e5ff] selection:text-[#00363d] flex flex-col font-body-md antialiased overflow-x-hidden">
      {/* Persistent Global Application Header */}
      <Header activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* Main Body Layout */}
      <div className="pt-16 flex-1 flex relative">
        {/* Persistent Fixed Operational Sidebar */}
        <div className="hidden md:block">
          <Sidebar activeTab={activeTab} onSelectTab={setActiveTab} />
        </div>

        {/* Mobile Sidebar Toggle Button */}
        <div className="fixed bottom-4 right-4 md:hidden z-50">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-12 h-12 rounded-full bg-[#00e5ff] text-[#00363d] shadow-[0_0_20px_rgba(0,229,255,0.6)] flex items-center justify-center cursor-pointer"
            aria-label="Toggle navigation"
          >
            <span className="material-symbols-outlined text-[24px]">
              {sidebarOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>

        {/* Mobile Drawer */}
        {sidebarOpen && (
          <div className="md:hidden fixed inset-0 top-16 bg-[#080f18]/90 backdrop-blur-2xl z-40 p-4">
            <Sidebar 
              activeTab={activeTab} 
              onSelectTab={(tab) => {
                setActiveTab(tab);
                setSidebarOpen(false);
              }} 
            />
          </div>
        )}

        {/* Main Viewport Workspace Container */}
        <main className="flex-1 md:pl-64 w-full flex flex-col min-h-[calc(100vh-4rem)]">
          {activeTab === 'welcome-portal' && (
            <WelcomePortal onNavigate={setActiveTab} />
          )}

          {activeTab === 'setup-upload' && (
            <SetupUpload onNavigate={setActiveTab} onProcessed={setProcessingResult} />
          )}

          {activeTab === 'map-generated' && (
            <MeshProcessing onNavigate={setActiveTab} processingResult={processingResult} />
          )}

          {activeTab === '3d-dem-viewer' && (
            <DemViewport onNavigate={setActiveTab} />
          )}

          {activeTab === '3d-flythrough' && (
            <FlythroughPath onNavigate={setActiveTab} />
          )}
        </main>
      </div>
    </div>
  );
}
