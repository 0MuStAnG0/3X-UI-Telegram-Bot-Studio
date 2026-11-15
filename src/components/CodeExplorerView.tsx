import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, FileCode2, FolderTree } from 'lucide-react';

interface BotFileItem {
  path: string;
  size: number;
  language: string;
  content: string;
}

interface CodeExplorerViewProps {
  onDownloadBundle: () => void;
}

export function CodeExplorerView({ onDownloadBundle }: CodeExplorerViewProps) {
  const [files, setFiles] = useState<BotFileItem[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedOneLine, setCopiedOneLine] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-app-url';
  const oneLineCmd = `bash <(curl -fsSL ${origin}/api/install.sh)`;

  const handleCopyOneLine = async () => {
    await navigator.clipboard.writeText(oneLineCmd);
    setCopiedOneLine(true);
    setTimeout(() => setCopiedOneLine(false), 1800);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch('/api/bot-files')
      .then((res) => res.json())
      .then((data: { ok: boolean; files?: BotFileItem[]; error?: string }) => {
        if (!active) return;
        if (!data.ok || !data.files) {
          setError(data.error || 'خطا در بارگذاری فایل‌های پروژه');
          setLoading(false);
          return;
        }
        setFiles(data.files);
        const preferred = data.files.find((f) => f.path === 'main.py') || data.files[0];
        if (preferred) setSelectedPath(preferred.path);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError('امکان دریافت فایل‌های پروژه وجود ندارد.');
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const currentFile = files.find((f) => f.path === selectedPath) || null;

  const handleCopy = async () => {
    if (!currentFile) return;
    await navigator.clipboard.writeText(currentFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownloadFile = () => {
    if (!currentFile) return;
    const blob = new Blob([currentFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFile.path.split('/').pop() || 'file.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            سورس کامل پروژه پایتون و نصب تک‌خطی روی سرور لینوکس
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            اجرای اسکریپت تک‌فایل زیر تمام پروژه را در مسیر <code className="font-mono">/opt/3xui-vpn-bot</code> نصب کرده، سرویس systemd را راه‌اندازی می‌کند و در پایان آدرس وب‌پنل را نمایش می‌دهد.
          </p>
        </div>

        <button
          type="button"
          onClick={onDownloadBundle}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          <span>دانلود اسکریپت تک‌فایل (install-3xui-bot.sh)</span>
        </button>
      </div>

      <section className="bg-slate-900 text-slate-100 rounded-xl p-4 sm:p-5 border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-white">دستور نصب یک‌خطی در سرور لینوکس (Ubuntu / Debian)</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              پس از اتمام نصب، آدرس <code className="font-mono text-teal-300">http://SERVER_IP:8080</code> و رمز وب‌پنل به صورت خودکار چاپ می‌شود.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyOneLine}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-teal-700 hover:bg-teal-600 text-white rounded-lg whitespace-nowrap shrink-0"
          >
            {copiedOneLine ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedOneLine ? 'کپی شد' : 'کپی دستور نصب'}</span>
          </button>
        </div>
        <pre
          data-testid="one-line-install-cmd"
          dir="ltr"
          className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-emerald-300 overflow-x-auto"
        >
          {oneLineCmd}
        </pre>
      </section>

      {loading ? (
        <div className="p-8 bg-white border border-slate-200 rounded-xl text-sm text-slate-500">
          در حال بارگذاری ساختار فایل‌های پروژه...
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-800">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <FolderTree className="w-4 h-4 text-teal-700" aria-hidden="true" />
                <span>فایل‌های پروژه ({files.length})</span>
              </div>
              <span className="text-[11px] font-mono text-slate-500">bot/</span>
            </div>
            <div className="max-h-[540px] overflow-y-auto divide-y divide-slate-100">
              {files.map((file) => {
                const active = file.path === selectedPath;
                return (
                  <button
                    key={file.path}
                    type="button"
                    onClick={() => setSelectedPath(file.path)}
                    className={`w-full px-4 py-2.5 text-left flex items-center justify-between gap-2 transition-colors ${
                      active ? 'bg-teal-50 text-teal-900' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                    dir="ltr"
                  >
                    <span className="inline-flex items-center gap-2 text-xs font-mono truncate">
                      <FileCode2 className="w-3.5 h-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                      <span className="truncate">{file.path}</span>
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 tabular-nums shrink-0">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="lg:col-span-8 bg-slate-900 text-slate-100 rounded-xl overflow-hidden border border-slate-800">
            {currentFile ? (
              <>
                <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs font-mono text-slate-200" dir="ltr">
                    bot/{currentFile.path} · {currentFile.language}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-md whitespace-nowrap"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'کپی شد' : 'کپی کد'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadFile}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-teal-700 hover:bg-teal-600 text-white rounded-md whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>دانلود فایل</span>
                    </button>
                  </div>
                </div>
                <pre
                  data-testid="code-explorer-content"
                  dir="ltr"
                  className="p-4 text-xs font-mono leading-relaxed overflow-x-auto max-h-[540px] text-slate-200"
                >
                  {currentFile.content}
                </pre>
              </>
            ) : (
              <div className="p-8 text-sm text-slate-400">یک فایل را از لیست انتخاب کنید.</div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
