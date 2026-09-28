import React, { useState } from 'react';
import { X, Terminal, Copy, Check, Smartphone, Cloud, Radio } from 'lucide-react';

interface CurlModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUrl: string;
}

export const CurlModal: React.FC<CurlModalProps> = ({ isOpen, onClose, targetUrl }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const currentOrigin = window.location.origin;
  const proxyEndpoint = `${currentOrigin}/proxy/${targetUrl}`;

  const commands = [
    {
      title: 'Direct Proxy Request (cURL)',
      desc: 'Fetch sanitized HTML directly via terminal',
      cmd: `curl -i "${proxyEndpoint}"`,
    },
    {
      title: 'Query Param Format',
      desc: 'Alternative format supported by legacy browser bookmarks',
      cmd: `curl -i "${currentOrigin}/?url=${encodeURIComponent(targetUrl)}"`,
    },
    {
      title: 'BB10 Browser User-Agent Emulation',
      desc: 'Test with authentic BlackBerry Passport headers',
      cmd: `curl -i -H "User-Agent: Mozilla/5.0 (BlackBerry; U; BlackBerry 9983; en-US) AppleWebKit/537.35+ (KHTML, like Gecko) Version/10.3.3.3216 Mobile Safari/537.35+" "${proxyEndpoint}"`,
    },
    {
      title: 'Inspect Transformation JSON via API',
      desc: 'Get script-stripping counts and metrics as JSON',
      cmd: `curl -i "${currentOrigin}/api/inspect?url=${encodeURIComponent(targetUrl)}"`,
    },
  ];

  const handleCopy = (cmd: string, index: number) => {
    navigator.clipboard.writeText(cmd);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-neutral-200">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                cURL &amp; Hardware Setup Helper
              </h2>
              <p className="text-xs text-neutral-400 font-mono">
                Connect external BlackBerry devices or automate requests
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

        <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
          {/* Setup Guide for Real BlackBerry Devices */}
          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
            <h3 className="text-sm font-semibold text-sky-400 flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              How to use on a physical BlackBerry Passport / Classic:
            </h3>
            <ol className="text-xs text-neutral-300 space-y-1.5 list-decimal list-inside leading-relaxed">
              <li>Open the native <strong>BlackBerry Browser</strong> on your BB10 device.</li>
              <li>Navigate to your proxy root URL: <code className="text-sky-300 bg-neutral-900 px-1 py-0.5 rounded">{currentOrigin}</code></li>
              <li>Bookmark the URL or type <code className="text-sky-300 bg-neutral-900 px-1 py-0.5 rounded">{currentOrigin}/proxy/https://en.wikipedia.org</code></li>
              <li>Enjoy fast, crash-free browsing with heavy JS stripped!</li>
            </ol>
          </div>

          {/* Commands list */}
          <div className="space-y-4">
            {commands.map((item, idx) => (
              <div key={idx} className="p-4 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-neutral-200">{item.title}</h4>
                    <p className="text-[11px] text-neutral-500">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => handleCopy(item.cmd, idx)}
                    className="px-2.5 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded flex items-center gap-1.5 transition font-mono"
                  >
                    {copiedIndex === idx ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    Copy
                  </button>
                </div>
                <pre className="p-2.5 bg-neutral-900 border border-neutral-800/80 rounded-lg text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap select-all">
                  {item.cmd}
                </pre>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-3 border-t border-neutral-800 bg-neutral-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold rounded-lg transition"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
