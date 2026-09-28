import React, { useState, useRef } from 'react';
import { 
  Wifi, 
  Battery, 
  RotateCw, 
  ExternalLink, 
  Globe, 
  Smartphone, 
  Maximize2, 
  Minimize2,
  ShieldCheck,
  Zap,
  RefreshCw,
  Code
} from 'lucide-react';
import { DeviceMode } from '../types';

interface PassportFrameProps {
  currentUrl: string;
  proxyUrl: string | null;
  onNavigate: (url: string) => void;
  isLoading: boolean;
  onRefresh: () => void;
  deviceMode: DeviceMode;
  onToggleDeviceMode: (mode: DeviceMode) => void;
  onOpenInspect: () => void;
  textOnly: boolean;
  refreshKey?: number;
}

export const PassportFrame: React.FC<PassportFrameProps> = ({
  currentUrl,
  proxyUrl,
  onNavigate,
  isLoading,
  onRefresh,
  deviceMode,
  onToggleDeviceMode,
  onOpenInspect,
  textOnly,
  refreshKey,
}) => {
  const [urlInput, setUrlInput] = useState(currentUrl);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(true);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleKeyPress = (key: string) => {
    setActiveKey(key);
    setTimeout(() => setActiveKey(null), 150);

    if (key === 'Enter') {
      onNavigate(urlInput);
    } else if (key === 'Backspace') {
      setUrlInput(prev => prev.slice(0, -1));
    } else if (key === 'Space') {
      setUrlInput(prev => prev + ' ');
    } else if (key === '.com') {
      setUrlInput(prev => prev + '.com');
    } else if (key.length === 1) {
      setUrlInput(prev => prev + key);
    }
  };

  const keyboardRows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Backspace'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '.com', 'Enter']
  ];

  // Screen container dimensions based on device mode
  const getContainerStyle = () => {
    switch (deviceMode) {
      case 'passport':
        return 'w-full max-w-[560px] aspect-[1/1]'; // 1:1 BlackBerry Passport iconic screen
      case 'classic':
        return 'w-full max-w-[480px] aspect-[4/3]'; // 4:3 BlackBerry Bold / Classic
      case 'retro':
        return 'w-full max-w-[420px] aspect-[9/16]'; // Portrait phone
      case 'desktop':
        return 'w-full max-w-full aspect-[16/10]';
      default:
        return 'w-full max-w-[560px] aspect-[1/1]';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-2 sm:p-6 w-full">
      {/* Device Body Chassis */}
      <div className={`relative transition-all duration-300 rounded-[32px] p-4 sm:p-6 bg-gradient-to-b from-neutral-900 via-neutral-950 to-black border-2 border-neutral-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_40px_rgba(56,189,248,0.06)] flex flex-col items-center ${
        deviceMode === 'desktop' ? 'w-full max-w-6xl' : 'w-full max-w-[620px]'
      }`}>
        
        {/* Top Earpiece Grill & Notification LED */}
        <div className="w-full flex items-center justify-between px-6 mb-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]" title="BlackBerry Notification LED" />
            <span className="text-[10px] font-mono tracking-widest text-neutral-500 uppercase font-semibold">
              {deviceMode === 'passport' ? 'BlackBerry Passport' : deviceMode === 'classic' ? 'BlackBerry Bold 9900' : 'Legacy Sandbox'}
            </span>
          </div>
          {/* Speaker grill */}
          <div className="w-16 h-1.5 bg-neutral-800 rounded-full border border-neutral-700/50 shadow-inner" />
          <div className="text-[10px] font-mono text-neutral-500">
            BB10 OS
          </div>
        </div>

        {/* Screen Bezel & Display */}
        <div className="w-full bg-black rounded-2xl overflow-hidden border border-neutral-800 shadow-inner flex flex-col">
          
          {/* BB10 Top Status Bar */}
          <div className="bg-neutral-900/90 backdrop-blur text-neutral-300 px-3 py-1 flex items-center justify-between text-xs font-mono select-none border-b border-neutral-800">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sky-400">4G LTE</span>
              <span className="text-neutral-500">|</span>
              <span className="text-[11px] text-neutral-400">BlackBerry</span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              {textOnly && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-sans font-medium">
                  TEXT ONLY
                </span>
              )}
              <span className="text-neutral-400 font-sans">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <Wifi className="w-3.5 h-3.5 text-neutral-300" />
              <div className="flex items-center gap-0.5">
                <Battery className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] text-emerald-400 font-sans">100%</span>
              </div>
            </div>
          </div>

          {/* In-Device Browser Chrome */}
          <div className="bg-neutral-900 border-b border-neutral-800 px-3 py-2 flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              title="Refresh Page"
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition disabled:opacity-50"
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
            </button>

            {/* Embedded URL Bar */}
            <div className="flex-1 relative flex items-center">
              <div className="absolute left-2.5 text-neutral-500 flex items-center pointer-events-none">
                <Globe className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onNavigate(urlInput);
                  }
                }}
                placeholder="Enter URL (e.g. en.wikipedia.org or cnn.com)..."
                className="w-full bg-neutral-950 text-neutral-200 text-xs pl-8 pr-16 py-1.5 rounded-lg border border-neutral-700/80 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 font-mono"
              />
              <button
                onClick={() => onNavigate(urlInput)}
                className="absolute right-1 px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-medium rounded-md transition shadow"
              >
                Go
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={onOpenInspect}
                title="Inspect Sanitized HTML & Headers"
                className="p-1.5 text-neutral-400 hover:text-sky-300 rounded-lg hover:bg-neutral-800 transition"
              >
                <Code className="w-4 h-4" />
              </button>
              {proxyUrl && (
                <a
                  href={proxyUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Open directly in new tab"
                  className="p-1.5 text-neutral-400 hover:text-sky-300 rounded-lg hover:bg-neutral-800 transition"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          {/* Simulated Web View Display */}
          <div className="relative w-full bg-white overflow-hidden flex flex-col items-center justify-center">
            {isLoading && (
              <div className="absolute inset-0 z-20 bg-neutral-950/70 backdrop-blur-sm flex flex-col items-center justify-center text-white gap-3">
                <div className="relative">
                  <div className="w-10 h-10 border-3 border-sky-500/20 border-t-sky-400 rounded-full animate-spin" />
                  <Zap className="w-4 h-4 text-sky-400 absolute inset-0 m-auto" />
                </div>
                <div className="text-xs font-mono text-neutral-300 flex items-center gap-1.5">
                  <span>Rewriting & Stripping Scripts...</span>
                </div>
              </div>
            )}

            {/* The actual iframe loading the proxy endpoint */}
            <div className={`w-full overflow-auto bg-white ${getContainerStyle()}`}>
              {proxyUrl ? (
                <iframe
                  key={refreshKey ?? proxyUrl}
                  ref={iframeRef}
                  src={proxyUrl}
                  title="BlackBerry Proxy Display"
                  className="w-full h-full min-h-[440px] sm:min-h-[500px] border-0 bg-white"
                  sandbox="allow-same-origin allow-forms allow-popups"
                />
              ) : (
                <div className="w-full h-full min-h-[440px] sm:min-h-[500px] flex items-center justify-center text-neutral-400 text-xs font-mono">
                  Loading proxy target...
                </div>
              )}
            </div>
          </div>

          {/* Bottom BB10 Touch Gesture Bar */}
          <div className="bg-neutral-900 py-1 px-4 flex items-center justify-between text-neutral-500 border-t border-neutral-800 select-none text-[11px]">
            <span className="flex items-center gap-1 text-emerald-400 font-mono text-[10px]">
              <ShieldCheck className="w-3.5 h-3.5" />
              Scripts Stripped &amp; CSP Sanitized
            </span>
            <div className="w-20 h-1 bg-neutral-700 rounded-full mx-auto cursor-pointer hover:bg-neutral-500 transition" title="Swipe Up for App Grid" />
            <button
              onClick={() => setIsKeyboardVisible(!isKeyboardVisible)}
              className="text-[10px] text-neutral-400 hover:text-white underline font-mono"
            >
              {isKeyboardVisible ? 'Hide Keyboard' : 'Show Keyboard'}
            </button>
          </div>
        </div>

        {/* Physical 3-Row Hardware QWERTY Keyboard */}
        {isKeyboardVisible && deviceMode !== 'desktop' && (
          <div className="w-full mt-4 pt-3 pb-1 border-t border-neutral-800/80 flex flex-col gap-1.5 select-none">
            {/* Stainless Steel Frets between rows */}
            {keyboardRows.map((row, rowIdx) => (
              <div key={rowIdx} className="flex justify-center gap-1 sm:gap-1.5 w-full">
                {row.map((key) => {
                  const isSpecial = key === 'Backspace' || key === 'Enter' || key === '.com';
                  const isPressed = activeKey === key;
                  return (
                    <button
                      key={key}
                      onClick={() => handleKeyPress(key)}
                      className={`
                        relative transition-all duration-75 rounded-md font-mono font-bold
                        ${isSpecial ? 'px-2.5 sm:px-3 text-[10px] sm:text-xs text-neutral-300 bg-neutral-800/90' : 'flex-1 max-w-[42px] py-2 text-xs sm:text-sm text-neutral-100 bg-gradient-to-b from-neutral-800 to-neutral-900'}
                        border border-neutral-700/60 shadow-[0_2px_4px_rgba(0,0,0,0.6)]
                        hover:from-neutral-700 hover:to-neutral-800 hover:border-neutral-600
                        active:translate-y-0.5 active:shadow-inner
                        ${isPressed ? 'ring-2 ring-sky-400 bg-sky-950 text-sky-200' : ''}
                      `}
                    >
                      {/* Sculpted Keycap Texture */}
                      <span className="relative z-10 flex items-center justify-center">
                        {key === 'Backspace' ? '⌫' : key === 'Enter' ? '⏎' : key}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
            {/* Space Bar Row */}
            <div className="flex justify-center items-center gap-2 mt-1 w-full px-8">
              <button
                onClick={() => handleKeyPress('Space')}
                className="w-3/5 py-1.5 bg-gradient-to-b from-neutral-800 to-neutral-900 hover:from-neutral-700 hover:to-neutral-800 rounded-md border border-neutral-700/80 shadow text-[10px] font-mono text-neutral-400 active:translate-y-0.5"
              >
                SPACE
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
