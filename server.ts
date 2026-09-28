import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { processProxyRequest, isValidUrl, getTargetFromReferer } from './src/proxyEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// In-memory stats and activity log for proxy monitoring
interface ActivityEntry {
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

const recentActivity: ActivityEntry[] = [];

function recordActivity(entry: Omit<ActivityEntry, 'id' | 'timestamp'>) {
  recentActivity.unshift({
    id: Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toLocaleTimeString(),
    ...entry,
  });
  if (recentActivity.length > 50) {
    recentActivity.pop();
  }
}

// Helper to construct baseUrlHost from incoming Express request
function getBaseUrl(req: Request): string {
  const host = req.get('host') || `localhost:${PORT}`;
  const proto = req.protocol || 'http';
  return `${proto}://${host}`;
}

// API to inspect URL & get transformation metrics
app.get('/api/inspect', async (req: Request, res: Response) => {
  const target = req.query.url as string;
  if (!target || !isValidUrl(target)) {
    return res.status(400).json({ error: 'Valid ?url= parameter required' });
  }

  const userAgent = (req.query.ua as string) || undefined;
  const stripScripts = req.query.stripScripts !== 'false';
  const stripStyles = req.query.stripStyles === 'true';
  const textOnly = req.query.textOnly === 'true';

  const baseUrl = getBaseUrl(req);
  const result = await processProxyRequest(
    target,
    baseUrl,
    'GET',
    {},
    undefined,
    { stripScripts, stripStyles, textOnly, userAgent }
  );

  recordActivity({
    url: target,
    statusCode: result.statusCode,
    durationMs: result.stats?.durationMs || 0,
    originalSize: result.stats?.originalSize || 0,
    processedSize: result.stats?.processedSize || 0,
    scriptsRemoved: result.stats?.scriptsRemovedCount || 0,
    contentType: result.contentType,
  });

  return res.json({
    url: target,
    statusCode: result.statusCode,
    statusText: result.statusText,
    contentType: result.contentType,
    isHtml: result.isHtml,
    stats: result.stats,
    headers: result.headers,
    previewHtmlSnippet: typeof result.body === 'string' ? result.body.slice(0, 2000) : null,
    proxyUrl: `${baseUrl}/proxy/${target}`,
  });
});

// API to get live activity log
app.get('/api/activity', (_req: Request, res: Response) => {
  res.json({
    activity: recentActivity,
    totalProxied: recentActivity.length,
    totalScriptsRemoved: recentActivity.reduce((acc, curr) => acc + curr.scriptsRemoved, 0),
    totalBytesSaved: recentActivity.reduce((acc, curr) => acc + Math.max(0, curr.originalSize - curr.processedSize), 0),
  });
});

// Direct Proxy handler for /proxy/* and /proxy?url=...
async function handleProxyRoute(req: Request, res: Response) {
  let targetUrl = '';

  if (req.query.url) {
    targetUrl = req.query.url as string;
  } else {
    const fullPath = req.originalUrl || req.url;
    const proxyPrefixMatch = fullPath.match(/^\/proxy\/(.+)$/);
    if (proxyPrefixMatch && proxyPrefixMatch[1]) {
      targetUrl = proxyPrefixMatch[1];
    }
  }

  // Handle accidental single-slash schemes or missing schemes
  if (targetUrl.startsWith('http:/') && !targetUrl.startsWith('http://')) {
    targetUrl = targetUrl.replace('http:/', 'http://');
  } else if (targetUrl.startsWith('https:/') && !targetUrl.startsWith('https://')) {
    targetUrl = targetUrl.replace('https:/', 'https://');
  } else if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://') && targetUrl.includes('.')) {
    targetUrl = `https://${targetUrl}`;
  }

  if (!targetUrl || !isValidUrl(targetUrl)) {
    return res.status(400).send('Invalid or missing URL. Usage: /proxy/https://example.com or ?url=https://example.com');
  }

  const baseUrl = getBaseUrl(req);
  const result = await processProxyRequest(
    targetUrl,
    baseUrl,
    req.method,
    req.headers as Record<string, string>,
    req.body,
    {
      stripScripts: req.query.raw !== '1',
      stripStyles: req.query.textOnly === '1',
      textOnly: req.query.textOnly === '1',
    }
  );

  recordActivity({
    url: targetUrl,
    statusCode: result.statusCode,
    durationMs: result.stats?.durationMs || 0,
    originalSize: result.stats?.originalSize || 0,
    processedSize: result.stats?.processedSize || 0,
    scriptsRemoved: result.stats?.scriptsRemovedCount || 0,
    contentType: result.contentType,
  });

  // Apply headers
  Object.entries(result.headers).forEach(([k, v]) => {
    res.setHeader(k, v);
  });

  res.status(result.statusCode);

  if (typeof result.body === 'string') {
    return res.send(result.body);
  } else {
    return res.send(result.body);
  }
}

// Proxy routes (compatible with Express 5)
app.use('/proxy', handleProxyRoute);

// Query parameter direct fallback: e.g. /?url=https://...
app.get('/', (req: Request, res: Response, next) => {
  if (req.query.url) {
    return handleProxyRoute(req, res);
  }
  next();
});

// Referer fallback for JS/CSS/Image subrequests with absolute paths
app.use(async (req: Request, res: Response, next) => {
  // Only trigger if this is not a Vite/React dev route or API route
  const p = req.path;
  if (
    p.startsWith('/api/') ||
    p.startsWith('/src/') ||
    p.startsWith('/@') ||
    p.startsWith('/node_modules/') ||
    p === '/' ||
    p === '/index.html' ||
    p === '/favicon.ico'
  ) {
    return next();
  }

  const referer = req.get('referer');
  const refererTarget = getTargetFromReferer(referer);
  if (refererTarget) {
    try {
      const fallbackUrl = new URL(req.originalUrl || req.url, refererTarget.origin).href;
      const baseUrl = getBaseUrl(req);
      const result = await processProxyRequest(
        fallbackUrl,
        baseUrl,
        req.method,
        req.headers as Record<string, string>,
        req.body
      );

      Object.entries(result.headers).forEach(([k, v]) => {
        res.setHeader(k, v);
      });
      res.status(result.statusCode);
      return res.send(result.body);
    } catch {
      return next();
    }
  }

  next();
});

// Setup Vite development middleware or static serving
async function setupServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.use((_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), HOST, () => {
    console.log(`🚀 BB-Proxy server running at http://${HOST}:${PORT}`);
    console.log(`📱 Direct Proxy endpoint: http://${HOST}:${PORT}/proxy/https://example.com`);
  });
}

setupServer().catch((err) => {
  console.error('Failed to start server:', err);
});
