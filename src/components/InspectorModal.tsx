import React, { useState } from 'react';
import { 
  X, 
  Code, 
  ShieldCheck, 
  Layers, 
  FileCode, 
  Copy, 
  Check, 
  Zap, 
  Clock, 
  FileCheck,
  Server,
  Download
} from 'lucide-react';
import { ProxyInspectData } from '../types';

interface InspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  inspectData: ProxyInspectData | null;
  isLoading: boolean;
}

export const InspectorModal: React.FC<InspectorModalProps> = ({
  isOpen,
  onClose,
  inspectData,
  isLoading,
}) => {
  const [activeTab, setActiveTab] = useState<'metrics' | 'headers' | 'html' | 'proxyInfo'>('metrics');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const stats = inspectData?.stats;
  const originalSizeKb = stats ? (stats.originalSize / 1024).toFixed(1) : '0';
  const processedSizeKb = stats ? (stats.processedSize / 1024).toFixed(1) : '0';
  const savingsBytes = stats ? Math.max(0, stats.originalSize - stats.processedSize) : 0;
  const savingsPct = stats && stats.originalSize > 0 
    ? ((savingsBytes / stats.originalSize) * 100).toFixed(0) 
    : '0';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[88vh] bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-neutral-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 border border-sky-500/30 rounded-lg text-sky-400">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Proxy Inspector &amp; Sanitizer Metrics
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  {inspectData?.statusCode || 200} {inspectData?.statusText || 'OK'}
                </span>
              </h2>
              <p className="text-xs text-neutral-400 font-mono truncate max-w-lg">
                {inspectData?.url || 'No active URL'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 border-b border-neutral-800 bg-neutral-900/50">
          <button
            onClick={() => setActiveTab('metrics')}
            className={`py-3 px-3 text-xs font-medium border-b-2 flex items-center gap-2 transition ${
              activeTab === 'metrics'
                ? 'border-sky-400 text-sky-400 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Performance &amp; Stripping
          </button>
          <button
            onClick={() => setActiveTab('headers')}
            className={`py-3 px-3 text-xs font-medium border-b-2 flex items-center gap-2 transition ${
              activeTab === 'headers'
                ? 'border-sky-400 text-sky-400 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Rewritten Headers
          </button>
          <button
            onClick={() => setActiveTab('html')}
            className={`py-3 px-3 text-xs font-medium border-b-2 flex items-center gap-2 transition ${
              activeTab === 'html'
                ? 'border-sky-400 text-sky-400 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            HTML Preview ({processedSizeKb} KB)
          </button>
          <button
            onClick={() => setActiveTab('proxyInfo')}
            className={`py-3 px-3 text-xs font-medium border-b-2 flex items-center gap-2 transition ${
              activeTab === 'proxyInfo'
                ? 'border-sky-400 text-sky-400 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            BB10 Compatibility Engine
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-neutral-400">
              <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-mono">Analyzing upstream payload &amp; rewriting AST...</p>
            </div>
          ) : !inspectData ? (
            <div className="py-12 text-center text-neutral-500 font-mono text-sm">
              No proxy data available. Run a request to inspect.
            </div>
          ) : (
            <>
              {activeTab === 'metrics' && (
                <div className="space-y-6">
                  {/* KPI Cards Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl">
                      <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
                        <span>Scripts Stripped</span>
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="text-2xl font-bold font-mono text-emerald-400">
                        {stats?.scriptsRemovedCount ?? 0}
                      </div>
                      <span className="text-[10px] text-neutral-500">
                        Prevents legacy browser crashes
                      </span>
                    </div>

                    <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl">
                      <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
                        <span>Bandwidth Saved</span>
                        <Zap className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="text-2xl font-bold font-mono text-amber-400">
                        {savingsPct}%
                      </div>
                      <span className="text-[10px] text-neutral-500">
                        {(savingsBytes / 1024).toFixed(1)} KB payload reduction
                      </span>
                    </div>

                    <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl">
                      <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
                        <span>Roundtrip Latency</span>
                        <Clock className="w-4 h-4 text-sky-400" />
                      </div>
                      <div className="text-2xl font-bold font-mono text-sky-400">
                        {stats?.durationMs ?? 0} ms
                      </div>
                      <span className="text-[10px] text-neutral-500">
                        Fetch + Parse + Sanitization
                      </span>
                    </div>

                    <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl">
                      <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
                        <span>Content Type</span>
                        <FileCheck className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="text-sm font-bold font-mono text-purple-300 truncate mt-1">
                        {inspectData.contentType || 'text/html'}
                      </div>
                      <span className="text-[10px] text-neutral-500">
                        Base URL tag injected
                      </span>
                    </div>
                  </div>

                  {/* Sanitization Breakdown */}
                  <div className="p-5 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      Sanitization &amp; Rewriting Pipeline Actions
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="flex items-start gap-2 p-3 bg-neutral-900 rounded-lg border border-neutral-800">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <div>
                          <p className="font-semibold text-neutral-200">&lt;script&gt; Removal</p>
                          <p className="text-neutral-400 text-[11px]">
                            Eliminated modern ES6+ scripts that stall BB10 / WebKit 537 engine.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 p-3 bg-neutral-900 rounded-lg border border-neutral-800">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <div>
                          <p className="font-semibold text-neutral-200">&lt;base href&gt; Injection</p>
                          <p className="text-neutral-400 text-[11px]">
                            Forces relative assets to route through the proxy endpoint.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 p-3 bg-neutral-900 rounded-lg border border-neutral-800">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <div>
                          <p className="font-semibold text-neutral-200">Attribute URL Rewriting</p>
                          <p className="text-neutral-400 text-[11px]">
                            Updated `href`, `src`, `action`, `srcset`, and CSS `url()`.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 p-3 bg-neutral-900 rounded-lg border border-neutral-800">
                        <span className="text-emerald-400 font-bold">✓</span>
                        <div>
                          <p className="font-semibold text-neutral-200">Security Header Cleaning</p>
                          <p className="text-neutral-400 text-[11px]">
                            Stripped CSP, X-Frame-Options, and COOP to permit sandbox rendering.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'headers' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-400 font-mono">
                      Rewritten Outgoing Headers ({Object.keys(inspectData.headers).length} keys)
                    </span>
                    <button
                      onClick={() => handleCopy(JSON.stringify(inspectData.headers, null, 2))}
                      className="px-2.5 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded flex items-center gap-1.5 transition font-mono"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      Copy JSON
                    </button>
                  </div>

                  <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 font-mono text-xs overflow-x-auto max-h-96 space-y-1.5">
                    {Object.entries(inspectData.headers).map(([key, val]) => (
                      <div key={key} className="flex gap-2">
                        <span className="text-sky-400 font-semibold">{key}:</span>
                        <span className="text-neutral-300 break-all">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'html' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-400 font-mono">
                      Sanitized HTML Payload Output
                    </span>
                    <button
                      onClick={() => handleCopy(inspectData.previewHtmlSnippet || '')}
                      className="px-2.5 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded flex items-center gap-1.5 transition font-mono"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      Copy HTML
                    </button>
                  </div>

                  <pre className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl font-mono text-xs text-emerald-300 overflow-x-auto max-h-96 whitespace-pre-wrap leading-relaxed">
                    {inspectData.previewHtmlSnippet || 'No HTML snippet captured.'}
                  </pre>
                </div>
              )}

              {activeTab === 'proxyInfo' && (
                <div className="space-y-4 text-xs">
                  <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2">
                    <h4 className="font-bold text-sky-400 text-sm">Why BlackBerry 10 &amp; Passport Need This:</h4>
                    <p className="text-neutral-300 leading-relaxed">
                      The BlackBerry Passport runs BlackBerry 10.3 OS with a WebKit browser version from 2015. Modern web pages ship megabytes of React, Angular, and tracking JS scripts which crash or freeze legacy mobile CPU cores and throw unsupported ES syntax errors.
                    </p>
                    <p className="text-neutral-300 leading-relaxed">
                      <strong>BB-Proxy</strong> intercepts upstream responses on the server side, removes scripts, rewrites URLs to pass through proxy tunnels, unwraps <code>&lt;noscript&gt;</code> tags to preserve articles, and serves pure, fast semantic HTML and CSS.
                    </p>
                  </div>

                  <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2 font-mono">
                    <h4 className="font-bold text-emerald-400 text-sm font-sans">Direct Proxy URL for External Devices:</h4>
                    <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg text-sky-300 select-all break-all">
                      {inspectData.proxyUrl}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between">
          <span className="text-[11px] text-neutral-500 font-mono">
            BB-Proxy v4 Node.js Engine
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold rounded-lg transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
