import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, 
  Smartphone, 
  Layers, 
  Terminal, 
  RefreshCw, 
  Code, 
  Search, 
  ExternalLink, 
  Zap, 
  Clock, 
  Sparkles,
  Sliders,
  Maximize2,
  Minimize2,
  Activity,
  Info,
  Check
} from 'lucide-react';
import { PassportFrame } from './components/PassportFrame';
import { BookmarksBar } from './components/BookmarksBar';
import { InspectorModal } from './components/InspectorModal';
import { CurlModal } from './components/CurlModal';
import { DeviceMode, ProxyInspectData, ActivityItem } from './types';

export default function App() {
  const [currentUrl, setCurrentUrl] = useState<string>('https://en.wikipedia.org/wiki/BlackBerry_Passport');
  const [activeUrl, setActiveUrl] = useState<string>('https://en.wikipedia.org/wiki/BlackBerry_Passport');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('passport');
  const [textOnly, setTextOnly] = useState<boolean>(false);
  const [stripScripts, setStripScripts] = useState<boolean>(true);
  
  // Inspection and metrics state
  const [inspectData, setInspectData] = useState<ProxyInspectData | null>(null);
  const [isInspectOpen, setIsInspectOpen] = useState<boolean>(false);
  const [isCurlOpen, setIsCurlOpen] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [activityList, setActivityList] = useState<ActivityItem[]>([]);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Computed proxy endpoint
  const getProxyUrl = useCallback((target: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const query = new URLSearchParams();
    if (textOnly) query.set('textOnly', '1');
    if (!stripScripts) query.set('raw', '1');
    
    const qs = query.toString() ? `?${query.toString()}` : '';
    return `${origin}/proxy/${target}${qs}`;
  }, [textOnly, stripScripts]);

  const [iframeProxyUrl, setIframeProxyUrl] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/proxy/https://en.wikipedia.org/wiki/BlackBerry_Passport`;
    }
    return null;
  });
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Fetch inspection data for current URL
  const fetchInspection = useCallback(async (target: string) => {
    setIsAnalyzing(true);
    try {
      const res = await fetch(`/api/inspect?url=${encodeURIComponent(target)}&stripScripts=${stripScripts}&textOnly=${textOnly}`);
      if (res.ok) {
        const data: ProxyInspectData = await res.json();
        setInspectData(data);
      }
    } catch (err) {
      console.error('Failed to inspect URL', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [stripScripts, textOnly]);

  // Fetch live activity
  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/activity');
      if (res.ok) {
        const data = await res.json();
        setActivityList(data.activity || []);
      }
    } catch {
      // Ignore background poll errors
    }
  }, []);

  const navigateTo = useCallback((newUrl: string) => {
    let cleanUrl = newUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      if (cleanUrl.includes('.')) {
        cleanUrl = `https://${cleanUrl}`;
      } else {
        cleanUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(cleanUrl)}`;
      }
    }

    setCurrentUrl(cleanUrl);
    setActiveUrl(cleanUrl);
    setIsLoading(true);

    const targetProxy = getProxyUrl(cleanUrl);
    setIframeProxyUrl(targetProxy);
    setRefreshKey(prev => prev + 1);

    fetchInspection(cleanUrl);
    setTimeout(() => {
      setIsLoading(false);
      fetchActivity();
    }, 600);
  }, [getProxyUrl, fetchInspection, fetchActivity]);

  useEffect(() => {
    const initialProxy = getProxyUrl(activeUrl);
    setIframeProxyUrl(initialProxy);
    fetchInspection(activeUrl);
    fetchActivity();
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    setRefreshKey(prev => prev + 1);
    fetchInspection(activeUrl);
    setTimeout(() => {
      setIsLoading(false);
      fetchActivity();
    }, 300);
  };

  const handleCopyDirectLink = () => {
    const directUrl = `${window.location.origin}/proxy/${activeUrl}`;
    navigator.clipboard.writeText(directUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-sky-500 selection:text-white">
      
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 via-sky-500 to-cyan-400 p-0.5 shadow-lg shadow-sky-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-sky-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white flex items-center gap-1.5">
                  BB-Proxy
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 font-mono font-medium">
                    v4 SSR
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                High-performance HTML Sanitizer &amp; Proxy for BlackBerry Passport &amp; Legacy Browsers
              </p>
            </div>
          </div>

          {/* Quick Actions & Control Toggles */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Mode selector */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setDeviceMode('passport')}
                className={`px-3 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${
                  deviceMode === 'passport'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="1:1 Aspect Ratio (BlackBerry Passport 1440x1440)"
              >
                <Smartphone className="w-3.5 h-3.5" />
                Passport (1:1)
              </button>
              <button
                onClick={() => setDeviceMode('classic')}
                className={`px-3 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${
                  deviceMode === 'classic'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="4:3 Aspect Ratio (BlackBerry Bold 9900)"
              >
                Classic (4:3)
              </button>
              <button
                onClick={() => setDeviceMode('desktop')}
                className={`px-3 py-1 rounded-lg font-medium transition hidden md:flex items-center gap-1.5 ${
                  deviceMode === 'desktop'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Desktop Viewport"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Full Width
              </button>
            </div>

            {/* Inspect Modal Trigger */}
            <button
              onClick={() => setIsInspectOpen(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition"
              title="Inspect HTML and Stripping Metrics"
            >
              <Code className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Inspect</span>
            </button>

            {/* Hardware & cURL Helper */}
            <button
              onClick={() => setIsCurlOpen(true)}
              className="px-3 py-1.5 bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 rounded-xl border border-sky-500/40 text-xs font-medium flex items-center gap-1.5 transition"
              title="Hardware & cURL Commands"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Hardware Setup</span>
            </button>
          </div>

        </div>
      </header>

      {/* Main Workbench Body */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 flex flex-col gap-6">
        
        {/* Top Control Bar with URL Input & Quick Stripper Settings */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-4">
          
          {/* Main Proxy Search Input */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1 flex items-center">
              <div className="absolute left-3.5 text-slate-500 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-sky-400" />
              </div>
              <input
                type="text"
                value={currentUrl}
                onChange={(e) => setCurrentUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    navigateTo(currentUrl);
                  }
                }}
                placeholder="Enter any destination URL (e.g. https://en.wikipedia.org or cnn.com)..."
                className="w-full bg-slate-950 text-slate-100 text-sm pl-10 pr-24 py-2.5 rounded-xl border border-slate-700/80 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 font-mono"
              />
              <div className="absolute right-2 flex items-center gap-1">
                <button
                  onClick={() => navigateTo(currentUrl)}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-white text-xs font-bold rounded-lg shadow-md transition flex items-center gap-1"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Proxy Now
                </button>
              </div>
            </div>

            {/* Direct Link Share Button */}
            <button
              onClick={handleCopyDirectLink}
              className="px-3 py-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium rounded-xl flex items-center justify-center gap-2 transition"
              title="Copy direct proxy URL for external devices"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-mono">Copied Link!</span>
                </>
              ) : (
                <>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy Device URL</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Engine Toggles */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300">
                <input
                  type="checkbox"
                  checked={stripScripts}
                  onChange={(e) => {
                    setStripScripts(e.target.checked);
                    setTimeout(handleRefresh, 50);
                  }}
                  className="rounded bg-slate-950 border-slate-700 text-sky-500 focus:ring-0 focus:ring-offset-0"
                />
                <span className="flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Strip Heavy &lt;script&gt; Tags (BB10 Crash-Guard)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300">
                <input
                  type="checkbox"
                  checked={textOnly}
                  onChange={(e) => {
                    setTextOnly(e.target.checked);
                    setTimeout(handleRefresh, 50);
                  }}
                  className="rounded bg-slate-950 border-slate-700 text-sky-500 focus:ring-0 focus:ring-offset-0"
                />
                <span className="font-medium text-amber-300">
                  Ultra-Light Text-Only Mode
                </span>
              </label>
            </div>

            {/* Quick stats badge */}
            {inspectData?.stats && (
              <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
                <span className="text-emerald-400">
                  ⚡ {inspectData.stats.scriptsRemovedCount} scripts eliminated
                </span>
                <span>•</span>
                <span className="text-sky-400">
                  ⏱️ {inspectData.stats.durationMs}ms
                </span>
              </div>
            )}
          </div>

          {/* Preset Bookmarks */}
          <BookmarksBar onSelect={navigateTo} currentUrl={activeUrl} />
        </section>

        {/* Live BlackBerry Device & Simulator Area */}
        <section className="flex flex-col items-center justify-center">
          <PassportFrame
            currentUrl={activeUrl}
            proxyUrl={iframeProxyUrl}
            onNavigate={navigateTo}
            isLoading={isLoading || isAnalyzing}
            onRefresh={handleRefresh}
            deviceMode={deviceMode}
            onToggleDeviceMode={setDeviceMode}
            onOpenInspect={() => setIsInspectOpen(true)}
            textOnly={textOnly}
            refreshKey={refreshKey}
          />
        </section>

        {/* Live Proxy Activity & Traffic Stream */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                Live Proxy Engine Feed &amp; Traffic Logs
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Auto-recording proxy requests
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 pb-2">
                  <th className="py-2 px-3">TIME</th>
                  <th className="py-2 px-3">STATUS</th>
                  <th className="py-2 px-3">TARGET URL</th>
                  <th className="py-2 px-3">SCRIPTS STRIPPED</th>
                  <th className="py-2 px-3">SAVED BYTES</th>
                  <th className="py-2 px-3">LATENCY</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {activityList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500">
                      No traffic logged yet. Browse pages using the simulator or endpoints.
                    </td>
                  </tr>
                ) : (
                  activityList.slice(0, 8).map((act) => (
                    <tr key={act.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 text-slate-400">{act.timestamp}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          act.statusCode >= 200 && act.statusCode < 300
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {act.statusCode}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-200 truncate max-w-xs sm:max-w-md">
                        <button
                          onClick={() => navigateTo(act.url)}
                          className="hover:text-sky-400 hover:underline text-left truncate block w-full"
                        >
                          {act.url}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-emerald-400 font-semibold">
                        {act.scriptsRemoved > 0 ? `-${act.scriptsRemoved}` : '0'}
                      </td>
                      <td className="py-2.5 px-3 text-amber-400">
                        {act.originalSize > act.processedSize 
                          ? `${((act.originalSize - act.processedSize) / 1024).toFixed(1)} KB` 
                          : '0 KB'}
                      </td>
                      <td className="py-2.5 px-3 text-sky-400">
                        {act.durationMs}ms
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500 font-mono">
        BB-Proxy — Optimized for BlackBerry Passport 1:1, BlackBerry 10 WebKit, and vintage/low-resource hardware.
      </footer>

      {/* Modals */}
      <InspectorModal
        isOpen={isInspectOpen}
        onClose={() => setIsInspectOpen(false)}
        inspectData={inspectData}
        isLoading={isAnalyzing}
      />

      <CurlModal
        isOpen={isCurlOpen}
        onClose={() => setIsCurlOpen(false)}
        targetUrl={activeUrl}
      />

    </div>
  );
}
