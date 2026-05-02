import { AuthGuard } from '@/core/auth';
import { Controller, Get, Header, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';

@UseGuards(AuthGuard)
@Controller('logs/ui')
export class LogsUiController {
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  ui(@Res() res: Response) {
    res.send(HTML);
  }
}

const HTML = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Logs — Control Plane</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0d1117; color: #e6edf3; height: 100vh; display: flex; flex-direction: column; }

    header {
      padding: 12px 20px;
      background: #161b22;
      border-bottom: 1px solid #30363d;
      display: flex;
      align-items: center;
      gap: 16px;
      flex-shrink: 0;
    }
    header h1 { font-size: 16px; font-weight: 600; color: #58a6ff; }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
    }
    input[type="text"], input[type="number"] {
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      color: #e6edf3;
      padding: 6px 10px;
      font-size: 13px;
      font-family: 'Cascadia Code', 'Fira Code', monospace;
    }
    input[type="text"] { flex: 1; min-width: 200px; }
    input[type="number"] { width: 80px; }
    button {
      padding: 6px 14px;
      border-radius: 6px;
      border: none;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }
    .btn-run { background: #238636; color: #fff; }
    .btn-run:hover { background: #2ea043; }
    .btn-stream { background: #1f6feb; color: #fff; }
    .btn-stream:hover { background: #388bfd; }
    .btn-stop { background: #b62324; color: #fff; }
    .btn-stop:hover { background: #da3633; }
    .btn-clear { background: #21262d; color: #e6edf3; border: 1px solid #30363d; }
    .btn-clear:hover { background: #30363d; }

    .status-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #30363d;
      flex-shrink: 0;
    }
    .status-dot.live { background: #2ea043; box-shadow: 0 0 6px #2ea043; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }

    #log-container {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      font-family: 'Cascadia Code', 'Fira Code', 'Courier New', monospace;
      font-size: 12.5px;
      line-height: 1.6;
    }

    .log-line {
      display: flex;
      gap: 12px;
      padding: 2px 6px;
      border-radius: 3px;
    }
    .log-line:hover { background: #161b22; }
    .log-ts { color: #8b949e; flex-shrink: 0; }
    .log-stream { color: #58a6ff; flex-shrink: 0; font-size: 11px; }
    .log-msg { color: #e6edf3; word-break: break-all; white-space: pre-wrap; }

    .empty { color: #484f58; text-align: center; padding: 60px 20px; font-size: 14px; }

    label { font-size: 12px; color: #8b949e; white-space: nowrap; }
    .sep { color: #30363d; }
  </style>
</head>
<body>
  <header>
    <h1>📋 Logs</h1>
    <div class="toolbar">
      <input id="query" type="text" placeholder='LogQL query, e.g. {job="app"}' value='{job="app"}' />
      <label>Limit:</label>
      <input id="limit" type="number" value="200" min="1" max="1000" />
      <span class="sep">|</span>
      <button class="btn-run" onclick="runQuery()">Run</button>
      <button class="btn-stream" id="btn-stream" onclick="toggleStream()">▶ Stream</button>
      <button class="btn-clear" onclick="clearLogs()">Clear</button>
      <div class="status-dot" id="status-dot"></div>
    </div>
  </header>
  <div id="log-container"><p class="empty">Run a query or start streaming to see logs.</p></div>

  <script>
    let ws = null;
    let streaming = false;

    const qEl = () => document.getElementById('query').value.trim();
    const limitEl = () => parseInt(document.getElementById('limit').value) || 200;
    const container = () => document.getElementById('log-container');
    const dot = () => document.getElementById('status-dot');
    const btnStream = () => document.getElementById('btn-stream');

    function formatNano(ns) {
      return new Date(parseInt(ns) / 1e6).toISOString().replace('T', ' ').replace('Z', '');
    }

    function renderLines(results) {
      const frag = document.createDocumentFragment();
      for (const stream of results) {
        const labels = Object.entries(stream.stream).map(([k,v]) => k+'='+v).join(' ');
        for (const [ts, msg] of stream.values) {
          const div = document.createElement('div');
          div.className = 'log-line';
          div.innerHTML =
            '<span class="log-ts">' + formatNano(ts) + '</span>' +
            '<span class="log-stream">' + escapeHtml(labels) + '</span>' +
            '<span class="log-msg">' + escapeHtml(msg) + '</span>';
          frag.appendChild(div);
        }
      }
      return frag;
    }

    function escapeHtml(s) {
      return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function clearLogs() {
      container().innerHTML = '<p class="empty">Cleared.</p>';
    }

    async function runQuery() {
      const q = qEl();
      if (!q) return;
      const c = container();
      c.innerHTML = '<p class="empty">Loading…</p>';
      try {
        const params = new URLSearchParams({ query: q, limit: limitEl() });
        const res = await fetch('/api/logs?' + params);
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        c.innerHTML = '';
        if (!data.length) { c.innerHTML = '<p class="empty">No results.</p>'; return; }
        c.appendChild(renderLines(data));
        c.scrollTop = c.scrollHeight;
      } catch(e) {
        c.innerHTML = '<p class="empty" style="color:#f85149">Error: ' + escapeHtml(e.message) + '</p>';
      }
    }

    function toggleStream() {
      streaming ? stopStream() : startStream();
    }

    function startStream() {
      if (ws) ws.close();
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(proto + '//' + location.host + '/api/logs/stream');
      ws.onopen = () => {
        ws.send(JSON.stringify({ event: 'subscribe', data: { query: qEl(), start: new Date(Date.now() - 60000).toISOString() } }));
        streaming = true;
        dot().classList.add('live');
        btnStream().textContent = '⏹ Stop';
        btnStream().className = 'btn-stop';
      };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'logs' && msg.data?.length) {
          const c = container();
          const wasEmpty = c.querySelector('.empty');
          if (wasEmpty) c.innerHTML = '';
          c.appendChild(renderLines(msg.data));
          c.scrollTop = c.scrollHeight;
        }
      };
      ws.onclose = () => stopStream();
    }

    function stopStream() {
      if (ws) { ws.close(); ws = null; }
      streaming = false;
      dot().classList.remove('live');
      btnStream().textContent = '▶ Stream';
      btnStream().className = 'btn-stream';
    }
  </script>
</body>
</html>
`;
