/**
 * Core Proxy Engine for BlackBerry & Legacy Web Clients (v6 Merged)
 * Compatible with Node.js Express server and Cloudflare Worker v6 pipeline
 */

export interface ProxyOptions {
  stripScripts?: boolean;
  stripStyles?: boolean;
  textOnly?: boolean;
  injectBase?: boolean;
  userAgent?: string;
  customHeaders?: Record<string, string>;
}

export interface ProxyResult {
  statusCode: number;
  statusText: string;
  headers: Record<string, string>;
  body: Buffer | string;
  contentType: string;
  isHtml: boolean;
  stats?: {
    originalSize: number;
    processedSize: number;
    scriptsRemovedCount: number;
    durationMs: number;
    targetUrl: string;
  };
}

export const ALLOWED_PROTOCOLS = ['http:', 'https:'];

export const STRIP_RESPONSE_HEADERS = [
  'content-security-policy',
  'content-security-policy-report-only',
  'strict-transport-security',
  'x-frame-options',
  'x-content-type-options',
  'permissions-policy',
  'cross-origin-opener-policy',
  'cross-origin-embedder-policy',
  'cross-origin-resource-policy',
  'report-to',
  'nel',
  'content-encoding',
];

export const STRIP_REQUEST_HEADERS = [
  'host',
  'cf-connecting-ip',
  'cf-ipcountry',
  'cf-ray',
  'cf-visitor',
  'cf-worker',
  'x-forwarded-for',
  'x-forwarded-proto',
  'x-real-ip',
  'sec-ch-ua',
  'sec-ch-ua-mobile',
  'sec-ch-ua-platform',
  'sec-fetch-dest',
  'sec-fetch-mode',
  'sec-fetch-site',
  'sec-fetch-user',
];

export function isValidUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    return ALLOWED_PROTOCOLS.includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function buildProxyUrl(baseUrlHost: string, targetUrl: string): string {
  const host = baseUrlHost.replace(/\/$/, '');
  return `${host}/proxy/${targetUrl}`;
}

export function rewriteUrl(baseUrlHost: string, rawUrl: string, currentTargetUrl: string): string {
  if (!rawUrl || rawUrl.startsWith('data:') || rawUrl.startsWith('blob:') || rawUrl.startsWith('javascript:') || rawUrl.startsWith('mailto:') || rawUrl.startsWith('tel:') || rawUrl.startsWith('#')) {
    return rawUrl;
  }

  let resolved: URL;
  try {
    resolved = new URL(rawUrl, currentTargetUrl);
  } catch {
    return rawUrl;
  }

  if (!ALLOWED_PROTOCOLS.includes(resolved.protocol)) {
    return rawUrl;
  }

  return buildProxyUrl(baseUrlHost, resolved.href);
}

const URL_RE = /url\((["']?)([^"'()]+)(["']?)\)/g;
const SRCSET_RE = /(srcset=["'])([^"']*)(["'])/gi;
const ATTR_RE = /((?:href|src|action|poster|data-src|data-href)=["'])([^"']*)(["'])/gi;
const META_RE = /(<meta[^>]*content=["']\d+;\s*url=)([^"']*)(["'])/gi;
const LINK_RE = /<([^>]+)>/g;
const SPLIT_RE = /\s+/;
const BASE_TAG_RE = /<base\s[^>]*>/i;
const HEAD_RE = /<head[^>]*>/i;
const SCRIPT_RE = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const NOSCRIPT_RE = /<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi;
const STYLE_RE = /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi;
const IMG_RE = /<img\b[^>]*>/gi;

export function rewriteHtml(
  baseUrlHost: string,
  html: string,
  targetUrl: string,
  options: ProxyOptions = { stripScripts: true, injectBase: true }
): { html: string; scriptsRemovedCount: number } {
  let result = html;
  let scriptsRemovedCount = 0;

  if (options.stripScripts !== false) {
    const matches = result.match(SCRIPT_RE);
    scriptsRemovedCount = matches ? matches.length : 0;
    // Remove all <script> tags — legacy BlackBerry/mobile browsers can't run modern heavy JS
    result = result.replace(SCRIPT_RE, '');
  }

  // Remove <noscript> tags and show their content (v6 logic)
  result = result.replace(NOSCRIPT_RE, (match) => {
    return match.replace(/<\/?noscript[^>]*>/gi, '');
  });

  if (options.stripStyles) {
    result = result.replace(STYLE_RE, '');
    result = result.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi, '');
  }

  if (options.textOnly) {
    result = result.replace(IMG_RE, '');
  }

  // Inject <base> tag and BB10 form-submit helper script into <head> (from v6)
  if (options.injectBase !== false) {
    const baseHref = buildProxyUrl(baseUrlHost, targetUrl);
    const baseTag = `<base href="${baseHref}">`;
    const formScript = '<script>document.addEventListener("keydown",function(e){if(e.keyCode===13){var t=e.target;var isText=t.tagName==="TEXTAREA"||(t.tagName=="INPUT"&&(t.type=="text"||t.type=="search"));if(isText){var f=t.form;if(f){e.preventDefault();f.submit()}}}},true);</script>';
    const inject = `${baseTag}\n${formScript}`;

    if (BASE_TAG_RE.test(result)) {
      result = result.replace(BASE_TAG_RE, baseTag);
      if (HEAD_RE.test(result)) {
        result = result.replace(HEAD_RE, (match) => `${match}\n${formScript}`);
      } else {
        result = `${formScript}\n${result}`;
      }
    } else if (HEAD_RE.test(result)) {
      result = result.replace(HEAD_RE, (match) => `${match}\n${inject}`);
    } else {
      result = `${inject}\n${result}`;
    }
  }

  // Rewrite srcset
  result = result.replace(SRCSET_RE, (_match, open, val, close) => {
    const rewritten = val
      .split(',')
      .map((part: string) => {
        const trimmed = part.trim();
        const pieces = trimmed.split(SPLIT_RE);
        const url = pieces[0];
        if (!url) return trimmed;
        const rest = pieces.slice(1).join(' ');
        return rewriteUrl(baseUrlHost, url, targetUrl) + (rest ? ' ' + rest : '');
      })
      .join(', ');
    return open + rewritten + close;
  });

  // Rewrite href, src, action, poster, data-src, data-href
  result = result.replace(ATTR_RE, (_match, open, val, close) => {
    return open + rewriteUrl(baseUrlHost, val, targetUrl) + close;
  });

  // Rewrite url(...) in inline styles
  result = result.replace(URL_RE, (_match, q1, val, q2) => {
    return `url(${q1}${rewriteUrl(baseUrlHost, val, targetUrl)}${q2})`;
  });

  // Rewrite meta refresh
  result = result.replace(META_RE, (_match, pre, val, close) => {
    return pre + rewriteUrl(baseUrlHost, val, targetUrl) + close;
  });

  return { html: result, scriptsRemovedCount };
}

export function rewriteCss(baseUrlHost: string, css: string, targetUrl: string): string {
  return css.replace(URL_RE, (_match, q1, val, q2) => {
    return `url(${q1}${rewriteUrl(baseUrlHost, val, targetUrl)}${q2})`;
  });
}

export function rewriteHeaders(baseUrlHost: string, headers: Headers, targetUrl: string): Record<string, string> {
  const result: Record<string, string> = {};

  headers.forEach((val, key) => {
    const lower = key.toLowerCase();
    if (STRIP_RESPONSE_HEADERS.includes(lower)) return;
    result[lower] = val;
  });

  // Location redirect header
  const location = headers.get('location');
  if (location) {
    try {
      const resolved = new URL(location, targetUrl).href;
      result['location'] = buildProxyUrl(baseUrlHost, resolved);
    } catch {
      result['location'] = location;
    }
  }

  // Link header (preload/stylesheet)
  const link = headers.get('link');
  if (link) {
    const rewritten = link.replace(LINK_RE, (_m, url) => {
      return `<${rewriteUrl(baseUrlHost, url, targetUrl)}>`;
    });
    result['link'] = rewritten;
  }

  result['access-control-allow-origin'] = '*';
  result['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS, HEAD';
  result['access-control-allow-headers'] = '*';

  return result;
}

export function getTargetFromReferer(refererHeader: string | undefined): URL | null {
  if (!refererHeader) return null;
  try {
    const refUrl = new URL(refererHeader);
    let targetStr: string | null = null;

    const proxyPrefix = '/proxy/';
    if (refUrl.pathname.startsWith(proxyPrefix)) {
      targetStr = refUrl.pathname.slice(proxyPrefix.length) + refUrl.search;
    }

    if (!targetStr && refUrl.pathname === '/proxy' && refUrl.searchParams.has('url')) {
      targetStr = refUrl.searchParams.get('url');
    }

    if (!targetStr) return null;
    const targetUrl = new URL(targetStr);
    if (!ALLOWED_PROTOCOLS.includes(targetUrl.protocol)) return null;
    return targetUrl;
  } catch {
    return null;
  }
}

export async function processProxyRequest(
  targetUrlStr: string,
  baseUrlHost: string,
  requestMethod: string = 'GET',
  requestHeaders: Record<string, string> = {},
  requestBody?: any,
  options: ProxyOptions = {}
): Promise<ProxyResult> {
  const startTime = Date.now();

  if (!isValidUrl(targetUrlStr)) {
    return {
      statusCode: 400,
      statusText: 'Bad Request',
      headers: { 'content-type': 'text/plain; charset=utf-8' },
      body: 'Invalid or unsupported URL. Only http:// and https:// protocols are supported.',
      contentType: 'text/plain',
      isHtml: false,
    };
  }

  const targetUrl = new URL(targetUrlStr);

  const upstreamHeaders = new Headers();
  for (const [key, value] of Object.entries(requestHeaders)) {
    const lower = key.toLowerCase();
    if (!STRIP_REQUEST_HEADERS.includes(lower)) {
      upstreamHeaders.set(key, value);
    }
  }

  // Spoof desktop Chrome or BB10 headers (from v6)
  upstreamHeaders.set('Host', targetUrl.host);
  const defaultUA =
    options.userAgent ||
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  upstreamHeaders.set('User-Agent', defaultUA);
  upstreamHeaders.set('Referer', `${targetUrl.origin}/`);
  upstreamHeaders.delete('origin');
  if (!upstreamHeaders.has('Accept')) {
    upstreamHeaders.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8');
  }

  try {
    const fetchResponse = await fetch(targetUrl.href, {
      method: requestMethod,
      headers: upstreamHeaders,
      body: ['GET', 'HEAD'].includes(requestMethod.toUpperCase()) ? undefined : requestBody,
      redirect: 'follow',
    });

    const contentType = (fetchResponse.headers.get('content-type') || '').toLowerCase();
    const isHtml = contentType.includes('text/html') || contentType.includes('application/xhtml+xml');
    const isCss = contentType.includes('text/css');

    const cleanHeaders = rewriteHeaders(baseUrlHost, fetchResponse.headers, targetUrl.href);

    if (isHtml) {
      const originalText = await fetchResponse.text();
      const originalSize = Buffer.byteLength(originalText, 'utf-8');
      const { html: rewrittenHtml, scriptsRemovedCount } = rewriteHtml(
        baseUrlHost,
        originalText,
        targetUrl.href,
        options
      );
      const processedSize = Buffer.byteLength(rewrittenHtml, 'utf-8');

      cleanHeaders['content-type'] = 'text/html; charset=utf-8';
      cleanHeaders['x-bb-proxy-scripts-removed'] = String(scriptsRemovedCount);
      cleanHeaders['x-bb-proxy-size-reduction'] = `${Math.max(0, originalSize - processedSize)} bytes`;

      return {
        statusCode: fetchResponse.status,
        statusText: fetchResponse.statusText,
        headers: cleanHeaders,
        body: rewrittenHtml,
        contentType: 'text/html',
        isHtml: true,
        stats: {
          originalSize,
          processedSize,
          scriptsRemovedCount,
          durationMs: Date.now() - startTime,
          targetUrl: targetUrl.href,
        },
      };
    }

    if (isCss) {
      const originalText = await fetchResponse.text();
      const rewrittenCss = rewriteCss(baseUrlHost, originalText, targetUrl.href);
      cleanHeaders['content-type'] = 'text/css; charset=utf-8';

      return {
        statusCode: fetchResponse.status,
        statusText: fetchResponse.statusText,
        headers: cleanHeaders,
        body: rewrittenCss,
        contentType: 'text/css',
        isHtml: false,
        stats: {
          originalSize: Buffer.byteLength(originalText, 'utf-8'),
          processedSize: Buffer.byteLength(rewrittenCss, 'utf-8'),
          scriptsRemovedCount: 0,
          durationMs: Date.now() - startTime,
          targetUrl: targetUrl.href,
        },
      };
    }

    // Binary / Media / Other streams
    const arrayBuffer = await fetchResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
      statusCode: fetchResponse.status,
      statusText: fetchResponse.statusText,
      headers: cleanHeaders,
      body: buffer,
      contentType: contentType || 'application/octet-stream',
      isHtml: false,
      stats: {
        originalSize: buffer.length,
        processedSize: buffer.length,
        scriptsRemovedCount: 0,
        durationMs: Date.now() - startTime,
        targetUrl: targetUrl.href,
      },
    };
  } catch (error: any) {
    return {
      statusCode: 502,
      statusText: 'Bad Gateway',
      headers: { 'content-type': 'text/html; charset=utf-8' },
      body: `<!DOCTYPE html><html><head><title>Proxy Error</title><style>body{font-family:system-ui,-apple-system,sans-serif;padding:32px;background:#111;color:#eee;max-width:700px;margin:auto}h1{color:#f87171}code{background:#222;padding:2px 6px;border-radius:4px;color:#38bdf8}a{color:#60a5fa}</style></head><body><h1>⚠️ BB-Proxy Gateway Error</h1><p>Failed to fetch upstream target: <code>${targetUrlStr}</code></p><p><strong>Reason:</strong> ${error?.message || 'Connection failed'}</p><p><a href="/">← Return to Proxy Console</a></p></body></html>`,
      contentType: 'text/html',
      isHtml: true,
      stats: {
        originalSize: 0,
        processedSize: 0,
        scriptsRemovedCount: 0,
        durationMs: Date.now() - startTime,
        targetUrl: targetUrlStr,
      },
    };
  }
}
