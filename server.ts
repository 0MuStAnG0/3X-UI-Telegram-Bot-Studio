import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import {
  WebPanelState,
  createDefaultPanelState,
  createVpnConfig,
  deleteVpnConfig,
  getBroadcastRecipients,
  renewVpnConfig,
  rotateVpnConfigLink,
} from './src/utils/webPanelEngine';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BOT_ROOT = path.join(__dirname, 'bot');
const DIST_DIR = path.join(__dirname, 'dist');
const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'panel_state.json');
const PORT = Number(process.env.PORT || 3000);

interface ProjectFileEntry {
  path: string;
  size: number;
  language: string;
  content: string;
}

function loadPanelState(): WebPanelState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<WebPanelState>;
      const base = createDefaultPanelState();
      return {
        ...base,
        ...parsed,
        bot: { ...base.bot, ...(parsed.bot ?? {}) },
        panel: { ...base.panel, ...(parsed.panel ?? {}) },
        pricing: { ...base.pricing, ...(parsed.pricing ?? {}) },
        features: {
          ...base.features,
          ...(parsed.features ?? {}),
          tutorials: {
            ...base.features.tutorials,
            ...(parsed.features?.tutorials ?? {}),
          },
        },
      };
    }
  } catch {
    // Fallback cleanly to default state
  }
  return createDefaultPanelState();
}

function savePanelState(state: WebPanelState): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

function isRealPanelConfigured(state: WebPanelState): boolean {
  const url = state.panel.panelUrl.trim();
  const token = state.panel.panelApiToken.trim();
  return Boolean(url && token && !url.includes('example.com'));
}

async function call3xuiApi(
  panelUrl: string,
  panelPath: string,
  apiToken: string,
  method: 'GET' | 'POST',
  endpoint: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; data?: Record<string, unknown>; error?: string }> {
  const cleanBase = panelUrl.trim().replace(/\/+$/, '');
  const cleanPath = panelPath.trim() ? '/' + panelPath.trim().replace(/^\/+|\/+$/g, '') : '';
  const target = `${cleanBase}${cleanPath}${endpoint}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(target, {
      method,
      headers: {
        Authorization: `Bearer ${apiToken.trim()}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const rawText = await response.text();
    let json: Record<string, unknown> | undefined;
    try {
      json = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      json = undefined;
    }
    if (!response.ok || !json?.success) {
      return {
        ok: false,
        status: response.status,
        data: json,
        error: String(json?.msg || `پاسخ غیرموفق از پنل 3X-UI (HTTP ${response.status})`),
      };
    }
    return { ok: true, status: response.status, data: json };
  } catch (err) {
    clearTimeout(timer);
    return {
      ok: false,
      status: 502,
      error: err instanceof Error ? `خطا در اتصال به پنل: ${err.message}` : 'خطا در اتصال به پنل',
    };
  }
}

function detectLanguage(relPath: string): string {
  if (relPath.endsWith('.py')) return 'python';
  if (relPath.endsWith('.sh')) return 'bash';
  if (relPath.endsWith('.service')) return 'ini';
  if (relPath.endsWith('.md')) return 'markdown';
  if (relPath.endsWith('.txt') || relPath.includes('.env')) return 'dotenv';
  return 'text';
}

function collectBotFiles(dir: string, baseDir: string): ProjectFileEntry[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results: ProjectFileEntry[] = [];
  for (const entry of entries) {
    if (entry.name === '__pycache__' || entry.name.endsWith('.pyc') || entry.name.endsWith('.db')) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectBotFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      const content = fs.readFileSync(fullPath, 'utf-8');
      results.push({
        path: relPath,
        size: Buffer.byteLength(content, 'utf-8'),
        language: detectLanguage(relPath),
        content,
      });
    }
  }
  return results.sort((a, b) => a.path.localeCompare(b.path));
}

function buildSelfExtractingBundle(files: ProjectFileEntry[]): string {
  const lines: string[] = [
    '#!/bin/bash',
    'set -e',
    '',
    'if [ "$EUID" -ne 0 ]; then',
    '    echo "Please run as root: sudo bash $0"',
    '    exit 1',
    'fi',
    '',
    'TARGET_DIR="${1:-/opt/3xui-vpn-bot}"',
    'echo "[*] Extracting 3X-UI Telegram Bot & Web Panel project to $TARGET_DIR..."',
    'mkdir -p "$TARGET_DIR"',
    '',
  ];

  for (const file of files) {
    const dirName = path.dirname(file.path);
    const b64 = Buffer.from(file.content, 'utf-8').toString('base64');
    if (dirName !== '.') {
      lines.push(`mkdir -p "$TARGET_DIR/${dirName}"`);
    }
    lines.push(`echo "${b64}" | base64 -d > "$TARGET_DIR/${file.path}"`);
    if (file.path.endsWith('.sh')) {
      lines.push(`chmod +x "$TARGET_DIR/${file.path}"`);
    }
  }

  lines.push('');
  lines.push('echo "[OK] Project files extracted to $TARGET_DIR"');
  lines.push('exec bash "$TARGET_DIR/install.sh"');
  return lines.join('\n') + '\n';
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '512kb' }));

  app.get('/api/panel-state', (_req, res) => {
    res.json({ ok: true, state: loadPanelState() });
  });

  app.put('/api/panel-state', (req, res) => {
    const body = req.body as { state?: WebPanelState };
    if (!body?.state || typeof body.state !== 'object') {
      res.status(400).json({ ok: false, error: 'ساختار داده‌های وب‌پنل نامعتبر است.' });
      return;
    }
    savePanelState(body.state);
    res.json({ ok: true, state: body.state });
  });

  app.post('/api/panel-state/reset', (_req, res) => {
    const fresh = createDefaultPanelState();
    savePanelState(fresh);
    res.json({ ok: true, state: fresh });
  });

  app.post('/api/test-bot', async (req, res) => {
    const { botToken = '' } = (req.body ?? {}) as { botToken?: string };
    const token = botToken.trim();
    if (!token || !token.includes(':')) {
      res.status(400).json({ ok: false, error: 'فرمت توکن ربات تلگرام معتبر نیست.' });
      return;
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = (await resp.json()) as {
        ok?: boolean;
        description?: string;
        result?: { id: number; username?: string; first_name?: string };
      };
      if (!resp.ok || !data.ok || !data.result) {
        res.status(502).json({
          ok: false,
          error: data.description || `خطای تلگرام (HTTP ${resp.status})`,
        });
        return;
      }
      res.json({
        ok: true,
        bot: {
          id: data.result.id,
          username: data.result.username || '',
          firstName: data.result.first_name || '',
        },
      });
    } catch (err) {
      res.status(502).json({
        ok: false,
        error: err instanceof Error ? `خطا در اتصال به API تلگرام: ${err.message}` : 'خطا در اتصال به تلگرام',
      });
    }
  });

  app.post('/api/test-panel', async (req, res) => {
    const { panelUrl = '', panelPath = '', apiToken = '' } = (req.body ?? {}) as {
      panelUrl?: string;
      panelPath?: string;
      apiToken?: string;
    };

    if (!panelUrl.trim() || !apiToken.trim()) {
      res.status(400).json({ ok: false, error: 'آدرس پنل 3X-UI و API Token الزامی است.' });
      return;
    }

    try {
      const parsedUrl = new URL(panelUrl.trim());
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        res.status(400).json({ ok: false, error: 'پروتکل باید http یا https باشد.' });
        return;
      }
    } catch {
      res.status(400).json({ ok: false, error: 'فرمت آدرس پنل معتبر نیست.' });
      return;
    }

    const result = await call3xuiApi(panelUrl, panelPath, apiToken, 'GET', '/panel/api/inbounds/list');
    if (!result.ok) {
      res.status(502).json({ ok: false, status: result.status, error: result.error });
      return;
    }

    const rawInbounds = (result.data?.obj as Array<Record<string, unknown>> | undefined) ?? [];
    res.json({
      ok: true,
      status: result.status,
      inbounds: rawInbounds.map((ib) => ({
        id: Number(ib.id),
        remark: String(ib.remark || `inbound-${ib.id}`),
        protocol: String(ib.protocol || 'vless'),
        port: Number(ib.port || 443),
        clientCount: Array.isArray(ib.clientStats) ? ib.clientStats.length : 0,
      })),
    });
  });

  app.post('/api/panel/clients/create', async (req, res) => {
    const state = loadPanelState();
    const {
      telegramId,
      clientEmail,
      inboundId,
      gb,
      days = 30,
      amountPaid,
      deductWallet = false,
      orderType = 'new',
    } = (req.body ?? {}) as {
      telegramId?: number;
      clientEmail?: string;
      inboundId?: number;
      gb?: number;
      days?: number;
      amountPaid?: number;
      deductWallet?: boolean;
      orderType?: 'new' | 'trial';
    };

    const subId = crypto.randomBytes(8).toString('hex');
    const created = createVpnConfig(state, {
      telegramId: Number(telegramId),
      clientEmail: String(clientEmail || ''),
      inboundId: Number(inboundId),
      gb: Number(gb),
      days: Number(days),
      amountPaid: typeof amountPaid === 'number' ? amountPaid : undefined,
      deductWallet: Boolean(deductWallet),
      orderType,
      subId,
    });

    if (!created.ok) {
      res.status(400).json({ ok: false, error: created.error });
      return;
    }

    let syncedWithPanel = false;
    let panelMessage = 'ذخیره در دیتابیس وب‌پنل (پنل سنایی متصل نیست یا در حالت آدرس نمونه است).';

    if (isRealPanelConfigured(state)) {
      const ib = state.inbounds.find((x) => x.id === created.order.inboundId);
      const expireMs = Date.now() + created.order.daysLeft * 86_400_000;
      const totalBytes = Math.round(created.order.gb * 1024 ** 3);
      const apiRes = await call3xuiApi(
        state.panel.panelUrl,
        state.panel.panelPath,
        state.panel.panelApiToken,
        'POST',
        '/panel/api/clients/add',
        {
          client: {
            email: created.order.clientEmail,
            subId: created.order.subId,
            flow: ib?.flow || '',
            totalGB: totalBytes,
            expiryTime: expireMs,
            tgId: created.order.telegramId,
            limitIp: 0,
            enable: true,
          },
          inboundIds: [created.order.inboundId],
        }
      );
      if (apiRes.ok) {
        syncedWithPanel = true;
        panelMessage = 'کانفیگ هم در پنل سنایی 3X-UI و هم در دیتابیس وب‌پنل ثبت شد.';
      } else {
        res.status(502).json({ ok: false, error: apiRes.error || 'خطا در ساخت کلاینت در پنل 3X-UI' });
        return;
      }
    }

    savePanelState(created.state);
    res.json({ ok: true, syncedWithPanel, panelMessage, state: created.state, order: created.order });
  });

  app.post('/api/panel/clients/renew', async (req, res) => {
    const state = loadPanelState();
    const { clientEmail = '', addGb = 0, addDays = 30 } = (req.body ?? {}) as {
      clientEmail?: string;
      addGb?: number;
      addDays?: number;
    };

    const existing = state.orders.find((o) => o.clientEmail === clientEmail);
    if (!existing) {
      res.status(404).json({ ok: false, error: 'کانفیگ مورد نظر یافت نشد.' });
      return;
    }

    let syncedWithPanel = false;
    if (isRealPanelConfigured(state)) {
      const getRes = await call3xuiApi(
        state.panel.panelUrl,
        state.panel.panelPath,
        state.panel.panelApiToken,
        'GET',
        `/panel/api/clients/get/${encodeURIComponent(clientEmail)}`
      );
      if (!getRes.ok) {
        res.status(502).json({ ok: false, error: getRes.error });
        return;
      }
      const obj = (getRes.data?.obj as Record<string, unknown> | undefined) ?? {};
      const client = (obj.client as Record<string, unknown> | undefined) ?? {};
      const newTotal = Number(client.totalGB || 0) + Number(addGb) * 1024 ** 3;
      const newExpire = Date.now() + Number(addDays) * 86_400_000;
      const updRes = await call3xuiApi(
        state.panel.panelUrl,
        state.panel.panelPath,
        state.panel.panelApiToken,
        'POST',
        `/panel/api/clients/update/${encodeURIComponent(clientEmail)}`,
        {
          email: clientEmail,
          subId: String(client.subId || existing.subId),
          flow: String(client.flow || ''),
          totalGB: newTotal,
          expiryTime: newExpire,
          tgId: existing.telegramId,
          limitIp: 0,
          enable: true,
        }
      );
      if (!updRes.ok) {
        res.status(502).json({ ok: false, error: updRes.error });
        return;
      }
      syncedWithPanel = true;
    }

    const nextState = renewVpnConfig(state, clientEmail, Number(addGb), Number(addDays));
    savePanelState(nextState);
    res.json({ ok: true, syncedWithPanel, state: nextState });
  });

  app.post('/api/panel/clients/rotate', async (req, res) => {
    const state = loadPanelState();
    const { clientEmail = '' } = (req.body ?? {}) as { clientEmail?: string };
    const existing = state.orders.find((o) => o.clientEmail === clientEmail);
    if (!existing) {
      res.status(404).json({ ok: false, error: 'کانفیگ مورد نظر یافت نشد.' });
      return;
    }

    const newSubId = crypto.randomBytes(8).toString('hex');
    let syncedWithPanel = false;
    if (isRealPanelConfigured(state)) {
      const getRes = await call3xuiApi(
        state.panel.panelUrl,
        state.panel.panelPath,
        state.panel.panelApiToken,
        'GET',
        `/panel/api/clients/get/${encodeURIComponent(clientEmail)}`
      );
      if (!getRes.ok) {
        res.status(502).json({ ok: false, error: getRes.error });
        return;
      }
      const obj = (getRes.data?.obj as Record<string, unknown> | undefined) ?? {};
      const client = (obj.client as Record<string, unknown> | undefined) ?? {};
      const updRes = await call3xuiApi(
        state.panel.panelUrl,
        state.panel.panelPath,
        state.panel.panelApiToken,
        'POST',
        `/panel/api/clients/update/${encodeURIComponent(clientEmail)}`,
        {
          id: crypto.randomUUID(),
          email: clientEmail,
          subId: newSubId,
          flow: String(client.flow || ''),
          totalGB: Number(client.totalGB || existing.gb * 1024 ** 3),
          expiryTime: Number(client.expiryTime || Date.now() + existing.daysLeft * 86_400_000),
          tgId: existing.telegramId,
          limitIp: 0,
          enable: true,
        }
      );
      if (!updRes.ok) {
        res.status(502).json({ ok: false, error: updRes.error });
        return;
      }
      syncedWithPanel = true;
    }

    const nextState = rotateVpnConfigLink(state, clientEmail, newSubId);
    savePanelState(nextState);
    res.json({ ok: true, syncedWithPanel, newSubId, state: nextState });
  });

  app.delete('/api/panel/clients/:email', async (req, res) => {
    const state = loadPanelState();
    const clientEmail = req.params.email;
    let syncedWithPanel = false;

    if (isRealPanelConfigured(state)) {
      const delRes = await call3xuiApi(
        state.panel.panelUrl,
        state.panel.panelPath,
        state.panel.panelApiToken,
        'POST',
        `/panel/api/clients/del/${encodeURIComponent(clientEmail)}`
      );
      if (!delRes.ok) {
        res.status(502).json({ ok: false, error: delRes.error });
        return;
      }
      syncedWithPanel = true;
    }

    const nextState = deleteVpnConfig(state, clientEmail);
    savePanelState(nextState);
    res.json({ ok: true, syncedWithPanel, state: nextState });
  });

  app.post('/api/bot/broadcast', async (req, res) => {
    const state = loadPanelState();
    const { message = '', audience = 'all' } = (req.body ?? {}) as {
      message?: string;
      audience?: 'all' | 'active_buyers';
    };
    const text = message.trim();
    if (!text) {
      res.status(400).json({ ok: false, error: 'متن پیام همگانی نمی‌تواند خالی باشد.' });
      return;
    }

    const recipients = getBroadcastRecipients(state, audience);
    const token = state.bot.botToken.trim();
    let sentCount = 0;
    let failedCount = 0;

    if (token && token.includes(':') && !token.includes('demo')) {
      for (const user of recipients) {
        try {
          const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: user.telegramId, text }),
          });
          if (resp.ok) sentCount += 1;
          else failedCount += 1;
        } catch {
          failedCount += 1;
        }
      }
    } else {
      sentCount = recipients.length;
    }

    const entry = {
      id: state.nextBroadcastId,
      message: text,
      audience,
      sentCount,
      failedCount,
      createdAt: new Date().toLocaleString('fa-IR'),
    };
    const nextState: WebPanelState = {
      ...state,
      broadcastLogs: [entry, ...state.broadcastLogs].slice(0, 30),
      nextBroadcastId: state.nextBroadcastId + 1,
    };
    savePanelState(nextState);
    res.json({ ok: true, entry, state: nextState });
  });

  // Headless script endpoints kept for server install compatibility
  app.get('/api/install.sh', (_req, res) => {
    try {
      const files = collectBotFiles(BOT_ROOT, BOT_ROOT);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(buildSelfExtractingBundle(files));
    } catch {
      res.status(500).send('# Error generating install script\nexit 1\n');
    }
  });

  app.get('/api/download-bundle', (_req, res) => {
    try {
      const files = collectBotFiles(BOT_ROOT, BOT_ROOT);
      res.setHeader('Content-Type', 'application/x-sh; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="install-3xui-bot.sh"');
      res.send(buildSelfExtractingBundle(files));
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Failed to build bundle' });
    }
  });

  if (process.env.NODE_ENV !== 'production' && !fs.existsSync(DIST_DIR)) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(DIST_DIR)) {
    const { createServer: createViteServer } =
      process.env.NODE_ENV !== 'production' ? await import('vite') : { createServer: null };
    if (createViteServer) {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      app.use(express.static(DIST_DIR));
      app.get('/{*splat}', (_req, res) => {
        res.sendFile(path.join(DIST_DIR, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

createServer();
