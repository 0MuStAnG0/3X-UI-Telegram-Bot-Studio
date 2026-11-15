import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BOT_ROOT = path.join(__dirname, 'bot');
const DIST_DIR = path.join(__dirname, 'dist');
const PORT = Number(process.env.PORT || 3000);

interface ProjectFileEntry {
  path: string;
  size: number;
  language: string;
  content: string;
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
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/bot-files', (_req, res) => {
    try {
      const files = collectBotFiles(BOT_ROOT, BOT_ROOT);
      res.json({ ok: true, count: files.length, files });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Failed to read bot files' });
    }
  });

  app.get('/api/install.sh', (_req, res) => {
    try {
      const files = collectBotFiles(BOT_ROOT, BOT_ROOT);
      const script = buildSelfExtractingBundle(files);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(script);
    } catch (err) {
      res.status(500).send('# Error generating install script\nexit 1\n');
    }
  });

  app.get('/api/download-bundle', (_req, res) => {
    try {
      const files = collectBotFiles(BOT_ROOT, BOT_ROOT);
      const script = buildSelfExtractingBundle(files);
      res.setHeader('Content-Type', 'application/x-sh; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="install-3xui-bot.sh"');
      res.send(script);
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Failed to build bundle' });
    }
  });

  app.post('/api/test-panel', async (req, res) => {
    const { panelUrl, panelPath = '', apiToken } = (req.body ?? {}) as {
      panelUrl?: string;
      panelPath?: string;
      apiToken?: string;
    };

    if (!panelUrl || !apiToken) {
      res.status(400).json({ ok: false, error: 'آدرس پنل و API Token الزامی است.' });
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(panelUrl.trim());
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        res.status(400).json({ ok: false, error: 'پروتکل باید http یا https باشد.' });
        return;
      }
    } catch {
      res.status(400).json({ ok: false, error: 'فرمت آدرس پنل معتبر نیست.' });
      return;
    }

    const cleanBase = parsedUrl.toString().replace(/\/+$/, '');
    const cleanPath = panelPath.trim() ? '/' + panelPath.trim().replace(/^\/+|\/+$/g, '') : '';
    const target = `${cleanBase}${cleanPath}/panel/api/inbounds/list`;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(target, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiToken.trim()}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      const rawText = await response.text();
      let json: { success?: boolean; msg?: string; obj?: Array<{ id: number; remark?: string; protocol?: string; port?: number }> } | null = null;
      try {
        json = JSON.parse(rawText);
      } catch {
        json = null;
      }

      if (!response.ok || !json?.success) {
        res.status(502).json({
          ok: false,
          status: response.status,
          error: json?.msg || `پاسخ غیرموفق از پنل (HTTP ${response.status})`,
        });
        return;
      }

      res.json({
        ok: true,
        status: response.status,
        inbounds: (json.obj || []).map((ib) => ({
          id: ib.id,
          remark: ib.remark || `inbound-${ib.id}`,
          protocol: ib.protocol || 'vless',
          port: ib.port || 443,
        })),
      });
    } catch (err) {
      res.status(502).json({
        ok: false,
        error: err instanceof Error ? `خطا در اتصال به پنل: ${err.message}` : 'خطا در اتصال به پنل',
      });
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
