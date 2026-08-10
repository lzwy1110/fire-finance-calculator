import React, { useState, useEffect } from 'react';
import { Cloud, Copy, Check, Download, Upload, ShieldCheck, RefreshCw, X, Database, Server, Key, Link2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { createFullBackupJSON, restoreFromBackupJSON, syncWithCloudCodeAsync, autoSyncToCloud } from '../utils/storage';
import { checkBackendHealth, HealthCheckResponse } from '../services/api';
import { getCustomCredentials, saveCustomCredentials, testSupabaseDirectConnection } from '../services/supabaseFrontend';
import { getThemePreset } from '../utils/theme';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncCode: string;
  themeColor?: string;
  onDataRestored: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  syncCode,
  themeColor = 'cyan',
  onDataRestored,
}) => {
  if (!isOpen) return null;

  const currentTheme = getThemePreset(themeColor);

  const [copied, setCopied] = useState(false);
  const [inputSyncCode, setInputSyncCode] = useState('');
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ text: string; isError?: boolean } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Custom Supabase Credentials state
  const [customUrl, setCustomUrl] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [showCredsForm, setShowCredsForm] = useState(false);
  const [credsSavedMsg, setCredsSavedMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  // Health & Supabase status
  const [healthStatus, setHealthStatus] = useState<HealthCheckResponse | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const fetchHealth = async () => {
    setIsCheckingHealth(true);
    const health = await checkBackendHealth();
    setHealthStatus(health);
    setIsCheckingHealth(false);
  };

  useEffect(() => {
    fetchHealth();
    const creds = getCustomCredentials();
    setCustomUrl(creds.url);
    setCustomKey(creds.key);
    if (creds.url || creds.key) {
      setShowCredsForm(true);
    }
  }, []);

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    saveCustomCredentials(customUrl, customKey);
    setCredsSavedMsg({ text: '⏳ 憑證已儲存，正在測試與 Supabase 連線...' });

    const testRes = await testSupabaseDirectConnection();
    if (testRes.success) {
      setCredsSavedMsg({ text: testRes.message });
      fetchHealth();
      autoSyncToCloud();
      onDataRestored();
    } else {
      setCredsSavedMsg({ text: testRes.message, isError: true });
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(syncCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSyncByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputSyncCode.trim()) return;

    setIsSyncing(true);
    setSyncStatusMsg({ text: '⏳ 正在與 Supabase 資料庫連線並同步中...' });

    const result = await syncWithCloudCodeAsync(inputSyncCode);
    setIsSyncing(false);

    if (result) {
      setSyncStatusMsg({ text: `✅ 成功連線並同步來自 [${inputSyncCode.toUpperCase()}] 的 Supabase/雲端數據！` });
      onDataRestored();
      setInputSyncCode('');
    } else {
      setSyncStatusMsg({
        text: `⚠️ 找不到同步碼 [${inputSyncCode}] 的雲端備份。請確認手機與電腦上使用的同步碼是否一致。`,
        isError: true,
      });
    }
  };

  const handleManualPushToSupabase = async () => {
    setIsSyncing(true);
    setSyncStatusMsg({ text: '⏳ 正在將本地資料推送到 Supabase 資料庫...' });

    autoSyncToCloud();

    setTimeout(() => {
      setIsSyncing(false);
      setSyncStatusMsg({ text: '✅ 本地財務與 FIRE 規劃數據已成功同步至 Supabase！' });
    }, 1200);
  };

  const handleDownloadBackup = () => {
    const jsonStr = createFullBackupJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `FIRE_Planner_Backup_${syncCode}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUploadBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content && restoreFromBackupJSON(content)) {
        setSyncStatusMsg({ text: '✅ 備份 JSON 檔案回復成功！已同步至本地與雲端。' });
        onDataRestored();
      } else {
        setSyncStatusMsg({ text: '❌ 備份檔案格式不符合，還原失敗。', isError: true });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center space-x-3">
            <div
              className="p-2.5 rounded-2xl flex items-center justify-center text-black font-bold"
              style={{
                backgroundColor: currentTheme.primaryHex,
                boxShadow: `0 0 15px rgba(${currentTheme.bgGlowRgb}, 0.4)`,
              }}
            >
              <Cloud className="w-5 h-5 animate-pulse text-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-zinc-100">全棧 Supabase 數據同步與備份</h3>
                <span className="px-2 py-0.5 text-[10px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-md">
                  Vercel + Supabase
                </span>
              </div>
              <p className="text-xs text-zinc-400">前後端一體化多裝置即時財務數據互通</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-100 rounded-xl hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Backend & Supabase Status Panel */}
        <div className="bg-zinc-950/90 border border-zinc-800 p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
              <Server className="w-4 h-4 text-sky-400" /> API 與 Supabase 資料庫連線狀態
            </span>
            <button
              onClick={fetchHealth}
              disabled={isCheckingHealth}
              className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-lg transition cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isCheckingHealth ? 'animate-spin' : ''}`} />
              測試連線
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-zinc-900/80 p-3 rounded-xl border border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-400">資料庫連線:</span>
              <span
                className={`font-mono font-bold ${
                  healthStatus?.supabase?.dbStatus === 'connected'
                    ? 'text-emerald-400'
                    : healthStatus?.supabase?.configured
                    ? 'text-amber-400'
                    : 'text-zinc-400'
                }`}
              >
                {healthStatus?.supabase?.dbStatus === 'connected'
                  ? '● 已連通 Supabase'
                  : healthStatus?.supabase?.configured
                  ? '⚠️ 需建表/連線中'
                  : '○ 離線存儲模式'}
              </span>
            </div>

            <div className="bg-zinc-900/80 p-3 rounded-xl border border-zinc-800 flex items-center justify-between">
              <span className="text-zinc-400">同步通道:</span>
              <span className="font-mono font-bold text-sky-400">
                {healthStatus?.supabase?.dbStatus === 'connected' ? '前端直連 / API' : '本機 LocalStorage'}
              </span>
            </div>
          </div>

          {healthStatus?.supabase?.message && (
            <p className="text-[11px] text-zinc-400 bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-800/80 leading-relaxed">
              <Database className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />
              {healthStatus.supabase.message}
            </p>
          )}
        </div>

        {/* Custom Supabase Credentials Form (Toggleable Panel) */}
        <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-3">
          <button
            type="button"
            onClick={() => setShowCredsForm((prev) => !prev)}
            className="w-full flex items-center justify-between text-xs font-bold text-amber-300 hover:text-amber-200 transition"
          >
            <span className="flex items-center gap-1.5">
              <Key className="w-4 h-4 text-amber-400" /> 填入/修改 Supabase 資料庫憑證 (網頁端直連)
            </span>
            {showCredsForm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showCredsForm && (
            <form onSubmit={handleSaveCredentials} className="space-y-3 pt-2 border-t border-zinc-800/80 animate-fadeIn">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1 flex items-center gap-1">
                  <Link2 className="w-3 h-3 text-sky-400" /> Supabase Project URL:
                </label>
                <input
                  type="text"
                  placeholder="例如: https://xxxx.supabase.co"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-100 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1 flex items-center gap-1">
                  <Key className="w-3 h-3 text-emerald-400" /> Supabase Anon Public Key:
                </label>
                <input
                  type="password"
                  placeholder="例如: eyJhbGciOiJIUzI1Ni..."
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-zinc-100 focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  儲存憑證並測試連線
                </button>
              </div>

              {credsSavedMsg && (
                <div
                  className={`p-2.5 rounded-xl text-xs font-semibold ${
                    credsSavedMsg.isError
                      ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                      : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                  }`}
                >
                  {credsSavedMsg.text}
                </div>
              )}
            </form>
          )}
        </div>

        {/* Sync Code Box */}
        <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-2">
          <div className="text-xs font-semibold text-zinc-400 flex items-center justify-between">
            <span>您的裝置專屬 Supabase 雲端同步碼</span>
            <span className="text-emerald-400 text-[11px] flex items-center gap-1 font-bold">
              <ShieldCheck className="w-3.5 h-3.5" /> 雲端數據防護中
            </span>
          </div>

          <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 p-3 rounded-xl font-mono text-base font-bold text-amber-300">
            <span>{syncCode}</span>
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded-lg border border-zinc-700 transition cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">已複製</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>複製同步碼</span>
                </>
              )}
            </button>
          </div>
          <p className="text-[11px] text-zinc-400">
            在您的手機或另一台裝置輸入此同步碼，即可互相讀取 Supabase 上最新記帳與 FIRE 退休數據。
          </p>
        </div>

        {/* Connect Other Device Form */}
        <form onSubmit={handleSyncByCode} className="space-y-2">
          <label className="block text-xs font-semibold text-zinc-300">
            連線並同步其他裝置 (輸入同步碼)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="例如: FIRE-8X92-2026"
              value={inputSyncCode}
              onChange={(e) => setInputSyncCode(e.target.value)}
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-zinc-100 uppercase focus:border-amber-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!inputSyncCode || isSyncing}
              className="px-4 py-2.5 text-zinc-950 font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-40"
              style={{ backgroundColor: currentTheme.primaryHex }}
            >
              {isSyncing ? '同步中...' : '連線同步'}
            </button>
          </div>
        </form>

        {/* Manual Push Button */}
        <div className="flex justify-between items-center bg-zinc-950/60 p-3 rounded-xl border border-zinc-800">
          <div className="text-xs">
            <span className="font-bold text-zinc-200 block">手動強制推送到 Supabase</span>
            <span className="text-[11px] text-zinc-400">立即將本機最新的記帳與 FIRE 數據傳送至雲端</span>
          </div>
          <button
            onClick={handleManualPushToSupabase}
            disabled={isSyncing}
            className="px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            推送到 Supabase
          </button>
        </div>

        {/* Status Alert */}
        {syncStatusMsg && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold ${
              syncStatusMsg.isError
                ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
            }`}
          >
            {syncStatusMsg.text}
          </div>
        )}

        {/* Local JSON Backup / Restore */}
        <div className="pt-3 border-t border-zinc-800 space-y-3">
          <div className="text-xs font-semibold text-zinc-400">檔案手動備份與還原 (JSON)</div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleDownloadBackup}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs text-zinc-200 font-semibold transition cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              下載數據備份檔
            </button>

            <label className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs text-zinc-200 font-semibold transition cursor-pointer">
              <Upload className="w-4 h-4 text-amber-400" />
              <span>匯入備份 JSON</span>
              <input
                type="file"
                accept=".json"
                onChange={handleUploadBackup}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-zinc-800 text-right">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-zinc-800 text-zinc-200 rounded-xl text-xs font-bold hover:bg-zinc-700 transition cursor-pointer"
          >
            關閉視窗
          </button>
        </div>
      </div>
    </div>
  );
};
