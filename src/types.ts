export interface ProxyInspectData {
  url: string;
  statusCode: number;
  statusText: string;
  contentType: string;
  isHtml: boolean;
  stats?: {
    originalSize: number;
    processedSize: number;
    scriptsRemovedCount: number;
    durationMs: number;
    targetUrl: string;
  };
  headers: Record<string, string>;
  previewHtmlSnippet?: string | null;
  proxyUrl: string;
}

export interface ActivityItem {
  id: string;
  timestamp: string;
  url: string;
  statusCode: number;
  durationMs: number;
  originalSize: number;
  processedSize: number;
  scriptsRemoved: number;
  contentType: string;
}

export type DeviceMode = 'passport' | 'classic' | 'retro' | 'desktop' | 'raw';
