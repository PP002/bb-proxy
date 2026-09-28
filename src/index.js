/**
 * Web Proxy for BlackBerry Passport Browser (v4 — server-side rendering)
 *
 * Uses Cloudflare Browser Rendering (headless Chromium via @cloudflare/puppeteer)
 * to fully render JavaScript-heavy pages at the edge, then strips scripts and
 * sends the static HTML to the legacy BB10 browser.
 *
 * For non-HTML resources (images, CSS, JS, fonts), falls back to direct proxying.
 */

import puppeteer from "@cloudflare/puppeteer";

const ALLOWED_PROTOCOLS = ["http:", "https:"];

const STRIP_RESPONSE_HEADERS = [
  "content-security-policy",
  "content-security-policy-report-only",
  "strict-transport-security",
  "x-frame-options",
  "x-content-type-options",
  "permissions-policy",
  "cross-origin-opener-policy",
  "cross-origin-embedder-policy",
  "cross-origin-resource-policy",
  "report-to",
  "nel",
];

const STRIP_REQUEST_HEADERS = [
  "host",
  "cf-connecting-ip",
  "cf-ipcountry",
  "cf-ray",
  "cf-visitor",
  "cf-worker",
  "x-forwarded-for",
  "x-forwarded-proto",
  "x-real-ip",
];

function getTargetUrl(request) {
  const url = new URL(request.url);
  if (url.searchParams.has("url")) {
    return url.searchParams.get("url");
  }
  const proxyPrefix = "/proxy/";
  if (url.pathname.startsWith(proxyPrefix)) {
    return url.pathname.slice(proxyPrefix.length) + url.search;
  }
  return null;
}

function getTargetFromReferer(request) {
  var referer = request.headers.get("referer");
  if (!referer) return null;
  try {
    var refUrl = new URL(referer);
    var proxyPrefix = "/proxy/";
    if (!refUrl.pathname.startsWith(proxyPrefix)) return null;
    var targetStr = refUrl.pathname.slice(proxyPrefix.length) + refUrl.search;
    var targetUrl = new URL(targetStr);
    if (!ALLOWED_PROTOCOLS.includes(targetUrl.protocol)) return null;
    return targetUrl;
  } catch {
    return null;
  }
}

function isValidUrl(urlStr) {
  try {
    var parsed = new URL(urlStr);
    return ALLOWED_PROTOCOLS.includes(parsed.protocol);
  } catch {
    return false;
  }
}

function buildProxyUrl(workerUrl, targetUrl) {
  var base = new URL(workerUrl);
  return base.origin + "/proxy/" + targetUrl;
}

function rewriteUrl(workerUrl, rawUrl, baseUrl) {
  if (!rawUrl) return rawUrl;
  var resolved;
  try {
    resolved = new URL(rawUrl, baseUrl);
  } catch {
    return rawUrl;
  }
  if (!ALLOWED_PROTOCOLS.includes(resolved.protocol)) return rawUrl;
  return buildProxyUrl(workerUrl, resolved.href);
}

var URL_RE = /url\((["']?)([^"'()]+)(["']?)\)/g;
var SRCSET_RE = /(srcset=["'])([^"']*)(["'])/gi;
var ATTR_RE = /((?:href|src|action|poster|data-src|data-href)=["'])([^"']*)(["'])/gi;
var META_RE = /(<meta[^>]*content=["']\d+;\s*url=)([^"']*)(["'])/gi;
var LINK_RE = /<([^>]+)>/g;
var SPLIT_RE = /\s+/;
var BASE_TAG_RE = /<base\s[^>]*>/i;
var HEAD_RE = /<head[^>]*>/i;
var SCRIPT_RE = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
var NOSCRIPT_RE = /<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi;

function rewriteHtml(workerUrl, html, baseUrl) {
  var result = html;

  // Remove all <script> tags — the BB10 browser can't run modern JS anyway,
  // and removing them prevents errors and unwanted requests
  result = result.replace(SCRIPT_RE, "");
  // Remove <noscript> tags and show their content (useful fallback content)
  result = result.replace(NOSCRIPT_RE, function(match) {
    var inner = match.replace(/<\/?noscript[^>]*>/gi, "");
    return inner;
  });

  // Inject <base> tag so relative URLs resolve through proxy
  var baseTag = '<base href="' + buildProxyUrl(workerUrl, baseUrl) + '">';
  if (BASE_TAG_RE.test(result)) {
    result = result.replace(BASE_TAG_RE, baseTag);
  } else if (HEAD_RE.test(result)) {
    result = result.replace(HEAD_RE, function(match) { return match + baseTag; });
  } else {
    result = baseTag + result;
  }

  result = result.replace(SRCSET_RE, function(match, open, val, close) {
    var rewritten = val.split(",").map(function(part) {
      var trimmed = part.trim();
      var pieces = trimmed.split(SPLIT_RE);
      var url = pieces[0];
      if (!url) return trimmed;
      var rest = pieces.slice(1).join(" ");
      return rewriteUrl(workerUrl, url, baseUrl) + (rest ? " " + rest : "");
    }).join(", ");
    return open + rewritten + close;
  });
  result = result.replace(ATTR_RE, function(match, open, val, close) {
    return open + rewriteUrl(workerUrl, val, baseUrl) + close;
  });
  result = result.replace(URL_RE, function(match, q1, val, q2) {
    return "url(" + q1 + rewriteUrl(workerUrl, val, baseUrl) + q2 + ")";
  });
  result = result.replace(META_RE, function(match, pre, val, close) {
    return pre + rewriteUrl(workerUrl, val, baseUrl) + close;
  });
  return result;
}

function rewriteCss(workerUrl, css, baseUrl) {
  return css.replace(URL_RE, function(match, q1, val, q2) {
    return "url(" + q1 + rewriteUrl(workerUrl, val, baseUrl) + q2 + ")";
  });
}

function rewriteHeaders(workerUrl, headers, baseUrl) {
  var location = headers.get("location");
  if (location) {
    headers.set("location", buildProxyUrl(workerUrl, new URL(location, baseUrl).href));
  }
  var link = headers.get("link");
  if (link) {
    var rewritten = link.replace(LINK_RE, function(m, url) {
      return "<" + rewriteUrl(workerUrl, url, baseUrl) + ">";
    });
    headers.set("link", rewritten);
  }
}

/**
 * Render a page using Browser Rendering (headless Chromium) and return
 * the fully rendered HTML with scripts stripped.
 */
async function renderPage(targetUrl, env, workerUrl) {
  console.log("[bb-proxy] RENDER: launching browser for", targetUrl.href);

  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const page = await browser.newPage();

    // Set a desktop viewport so we get full content
    await page.setViewport({ width: 1280, height: 800 });

    // Set a modern User-Agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    console.log("[bb-proxy] RENDER: navigating to", targetUrl.href);
    await page.goto(targetUrl.href, {
      waitUntil: "networkidle0",
      timeout: 20000,
    });

    // Give JS frameworks time to render
    await page.waitForFunction("document.readyState === 'complete'", { timeout: 10000 }).catch(() => {});

    // Get the fully rendered HTML
    const content = await page.content();
    console.log("[bb-proxy] RENDER: got content, length:", content.length);

    // Strip scripts and rewrite URLs
    const rewritten = rewriteHtml(workerUrl, content, targetUrl.href);
    console.log("[bb-proxy] RENDER: rewritten length:", rewritten.length);

    return new Response(rewritten, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "access-control-allow-origin": "*",
      },
    });
  } catch (err) {
    console.log("[bb-proxy] RENDER ERROR:", err.message, err.stack);
    return null;
  } finally {
    await browser.close();
  }
}

/**
 * Direct proxy (no rendering) for non-HTML resources
 */
async function proxyRequest(request, targetUrl, workerUrl) {
  var reqHeaders = new Headers(request.headers);
  for (var i = 0; i < STRIP_REQUEST_HEADERS.length; i++) {
    reqHeaders.delete(STRIP_REQUEST_HEADERS[i]);
  }
  reqHeaders.set("Host", targetUrl.host);
  reqHeaders.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  reqHeaders.set("Referer", targetUrl.origin + "/");
  reqHeaders.delete("origin");

  console.log("[bb-proxy] direct proxy to:", targetUrl.href);

  var bodyOpt = ["GET", "HEAD"].includes(request.method) ? undefined : request.body;
  var upstreamReq = new Request(targetUrl.href, {
    method: request.method,
    headers: reqHeaders,
    body: bodyOpt,
    redirect: "manual",
  });

  var response;
  try {
    response = await fetch(upstreamReq);
  } catch (err) {
    console.log("[bb-proxy] FETCH ERROR:", err.message, err.stack);
    return new Response("Failed to fetch upstream: " + err.message, {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  console.log("[bb-proxy] upstream response status:", response.status, response.statusText);

  var respHeaders = new Headers(response.headers);
  for (var j = 0; j < STRIP_RESPONSE_HEADERS.length; j++) {
    respHeaders.delete(STRIP_RESPONSE_HEADERS[j]);
  }
  rewriteHeaders(workerUrl, respHeaders, targetUrl.href);
  respHeaders.set("Access-Control-Allow-Origin", "*");

  var contentType = (respHeaders.get("content-type") || "").toLowerCase();

  if (contentType.includes("text/css")) {
    var css = await response.text();
    var rewrittenCss = rewriteCss(workerUrl, css, targetUrl.href);
    return new Response(rewrittenCss, {
      status: response.status,
      statusText: response.statusText,
      headers: respHeaders,
    });
  }

  // Stream everything else (images, JS, fonts, XML, etc.) directly
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: respHeaders,
  });
}

export default {
  async fetch(request, env, ctx) {
    var workerUrl = request.url;
    var targetUrlStr = getTargetUrl(request);

    console.log("[bb-proxy] incoming request:", request.method, workerUrl);

    if (!targetUrlStr) {
      var url = new URL(workerUrl);
      if (url.pathname === "/" || url.pathname === "/proxy") {
        console.log("[bb-proxy] serving landing page");
        return new Response(landingPage(url.origin), {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }

      // Referer fallback for JS-initiated requests with absolute paths
      var refererTarget = getTargetFromReferer(request);
      if (refererTarget) {
        var fallbackUrl = new URL(url.pathname + url.search, refererTarget.origin);
        console.log("[bb-proxy] REFERER FALLBACK:", fallbackUrl.href);
        return proxyRequest(request, fallbackUrl, workerUrl);
      }

      console.log("[bb-proxy] 404 - no target, pathname:", url.pathname);
      return new Response("Not found", { status: 404 });
    }

    if (!isValidUrl(targetUrlStr)) {
      console.log("[bb-proxy] invalid URL:", targetUrlStr);
      return new Response("Invalid or unsupported URL. Only http and https are allowed.", {
        status: 400,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    var targetUrl = new URL(targetUrlStr);
    console.log("[bb-proxy] target:", targetUrl.href);

    // For HTML page requests, try server-side rendering first
    // For non-HTML (images, CSS, JS, fonts, API calls), use direct proxy
    var accept = (request.headers.get("accept") || "").toLowerCase();
    var isPageRequest = accept.includes("text/html") || accept.includes("*/*");

    if (isPageRequest && env.BROWSER) {
      console.log("[bb-proxy] attempting server-side render for", targetUrl.href);
      var rendered = await renderPage(targetUrl, env, workerUrl);
      if (rendered) {
        console.log("[bb-proxy] render succeeded");
        return rendered;
      }
      console.log("[bb-proxy] render failed, falling back to direct proxy");
    }

    return proxyRequest(request, targetUrl, workerUrl);
  },
};

function landingPage(origin) {
  return [
    "<!DOCTYPE html>",
    '<html><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<title>Web Proxy</title>",
    "<style>",
    "body{font-family:sans-serif;max-width:600px;margin:40px auto;padding:0 16px}",
    "form{display:flex;gap:8px}",
    "input[type=url]{flex:1;padding:10px;font-size:16px}",
    "button{padding:10px 20px;font-size:16px}",
    ".hint{color:#666;font-size:14px;margin-top:12px}",
    "</style></head><body>",
    "<h1>Web Proxy</h1>",
    "<p>Enter a URL to load through the proxy:</p>",
    '<form action="' + origin + '/proxy" method="get">',
    '<input type="url" name="url" placeholder="https://example.com" required>',
    '<button type="submit">Go</button></form>',
    '<p class="hint">Or append a URL directly: <code>' + origin + '/proxy/https://example.com</code></p>',
    "</body></html>",
  ].join("\n");
}
