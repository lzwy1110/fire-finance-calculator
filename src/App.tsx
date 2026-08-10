import React, { useState, useEffect } from 'react';
import {
  CategoryItem,
  FIREConfig,
  QuickPreset,
  Transaction,
} from './types';
import { calculateFIRE } from './utils/fireCalculator';
import {
  autoSyncToCloud,
  getOrCreateSyncCode,
  loadCategories,
  loadFIREConfig,
  loadQuickPresets,
  loadTransactions,
  removeSingleTransactionFromCloud,
  resetAllDataToDefault,
  saveCategories,
  saveFIREConfig,
  saveTransactions,
  syncSingleTransactionToCloud,
} from './utils/storage';
import { fetchCloudData } from './services/api';

import { Header } from './components/Header';
import { DashboardOverview } from './components/DashboardOverview';
import { MonthlyYearlySummary } from './components/MonthlyYearlySummary';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { TransactionList } from './components/TransactionList';
import { QuickAddModal } from './components/QuickAddModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { CategoryManagerModal } from './components/CategoryManagerModal';
import { SystemSettingsModal } from './components/SystemSettingsModal';
import { applyThemeToCSSVariables } from './utils/theme';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'monthly' | 'yearly' | 'ledger' | 'analytics'>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [quickPresets, setQuickPresets] = useState<QuickPreset[]>([]);
  const [fireConfig, setFireConfig] = useState<FIREConfig>(loadFIREConfig());
  const [syncCode, setSyncCode] = useState<string>('');

  // Modals state
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isCloudSyncOpen, setIsCloudSyncOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isSystemSettingsOpen, setIsSystemSettingsOpen] = useState(false);

  // Initialize data locally first, then sync with Supabase / Express backend if connected
  useEffect(() => {
    const localTx = loadTransactions();
    const localCat = loadCategories();
    const localPresets = loadQuickPresets();
    const loadedConfig = loadFIREConfig();
    const code = getOrCreateSyncCode();

    setTransactions(localTx);
    setCategories(localCat);
    setQuickPresets(localPresets);
    setFireConfig(loadedConfig);
    setSyncCode(code);
    applyThemeToCSSVariables(loadedConfig.themeColor);

    // Background fetch from Supabase backend
    fetchCloudData(code).then((cloudRes) => {
      if (cloudRes && cloudRes.success && cloudRes.data) {
        const { transactions: cTx, categories: cCat, fireConfig: cCfg, quickPresets: cPresets } = cloudRes.data;
        if (Array.isArray(cTx)) {
          setTransactions(cTx);
          saveTransactions(cTx);
        }
        if (Array.isArray(cCat) && cCat.length > 0) {
          setCategories(cCat);
          saveCategories(cCat);
        }
        if (cCfg) {
          setFireConfig(cCfg);
          saveFIREConfig(cCfg);
          applyThemeToCSSVariables(cCfg.themeColor);
        }
        if (Array.isArray(cPresets) && cPresets.length > 0) {
          setQuickPresets(cPresets);
        }
      }
    });
  }, []);

  // Sync theme changes
  useEffect(() => {
    applyThemeToCSSVariables(fireConfig.themeColor);
  }, [fireConfig.themeColor]);

  // Handle App Launch from Android Widget Deep Link
  useEffect(() => {
    const handleWidgetUrl = (urlStr: string) => {
      if (!urlStr) return;
      try {
        const urlObj = new URL(urlStr);
        if (urlObj.protocol === 'fireflow:' || urlStr.includes('quick-add') || urlStr.includes('quick_add')) {
          const cat = urlObj.searchParams.get('cat');
          const sub = urlObj.searchParams.get('sub');
          const amt = urlObj.searchParams.get('amt');

          if (cat && sub && amt) {
            const parsedAmt = parseFloat(amt);
            if (!isNaN(parsedAmt)) {
              handleAddTransaction({
                type: cat === '收入' ? 'income' : cat === '投資資產' ? 'investment' : cat === '稅金規費' ? 'tax' : 'expense',
                amount: parsedAmt,
                mainCategory: cat,
                subCategory: sub,
                date: new Date().toISOString().slice(0, 10),
                note: '來自 Android 桌面小工具 1 秒速記',
                isQuickPreset: true,
              });
            }
          }
          setIsQuickAddOpen(true);
        }
      } catch (e) {
        if (urlStr.includes('quick-add')) {
          setIsQuickAddOpen(true);
        }
      }
    };

    handleWidgetUrl(window.location.href);

    import('@capacitor/app').then(({ App: CapApp }) => {
      CapApp.addListener('appUrlOpen', (data) => {
        handleWidgetUrl(data.url);
      });
    }).catch(() => {});
  }, []);

  // Add Transaction
  const handleAddTransaction = (t: Omit<Transaction, 'id'>) => {
    const newRecord: Transaction = {
      ...t,
      id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    const updated = [newRecord, ...transactions];
    setTransactions(updated);
    saveTransactions(updated);
    syncSingleTransactionToCloud(newRecord);

    // Also update currentNetWorth dynamically if investment was logged!
    if (t.type === 'investment') {
      const newConfig = {
        ...fireConfig,
        currentNetWorth: fireConfig.currentNetWorth + t.amount,
      };
      setFireConfig(newConfig);
      saveFIREConfig(newConfig);
    }
  };

  const handleDeleteTransaction = (id: string) => {
    const updated = transactions.filter((t) => t.id !== id);
    setTransactions(updated);
    saveTransactions(updated);
    removeSingleTransactionFromCloud(id);
  };

  const handleUpdateFIREConfig = (newConfig: FIREConfig) => {
    setFireConfig(newConfig);
    saveFIREConfig(newConfig);
  };

  const handleUpdateCategories = (newCategories: CategoryItem[]) => {
    setCategories(newCategories);
    saveCategories(newCategories);
  };

  const handleDataRestored = () => {
    setTransactions(loadTransactions());
    setCategories(loadCategories());
    setQuickPresets(loadQuickPresets());
    const loadedConfig = loadFIREConfig();
    setFireConfig(loadedConfig);
    setSyncCode(getOrCreateSyncCode());
    applyThemeToCSSVariables(loadedConfig.themeColor);
  };

  const handleResetDefaultData = () => {
    if (window.confirm('確定要將財務資料重設為預設範例資料嗎？')) {
      resetAllDataToDefault();
      handleDataRestored();
      autoSyncToCloud();
    }
  };

  // Calculate FIRE Metrics
  const fireResult = calculateFIRE(fireConfig);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-300">
      {/* Top Sticky Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenQuickAdd={() => setIsQuickAddOpen(true)}
        onOpenCloudSync={() => setIsCloudSyncOpen(true)}
        onOpenConfig={() => setIsSystemSettingsOpen(true)}
        syncCode={syncCode}
        themeColor={fireConfig.themeColor}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Tab 1: Dashboard Overview */}
        {activeTab === 'dashboard' && (
          <DashboardOverview
            transactions={transactions}
            categories={categories}
            quickPresets={quickPresets}
            fireConfig={fireConfig}
            fireResult={fireResult}
            onUpdateFIREConfig={handleUpdateFIREConfig}
            onAddTransaction={handleAddTransaction}
            onOpenQuickAdd={() => setIsQuickAddOpen(true)}
            onOpenCategoryManager={() => setIsCategoryManagerOpen(true)}
            onOpenCloudSync={() => setIsCloudSyncOpen(true)}
            setActiveTab={setActiveTab}
          />
        )}

        {/* Tab 2: Monthly Summary */}
        {activeTab === 'monthly' && (
          <MonthlyYearlySummary
            transactions={transactions}
            fireConfig={fireConfig}
            initialMode="monthly"
          />
        )}

        {/* Tab 3: Yearly Summary */}
        {activeTab === 'yearly' && (
          <MonthlyYearlySummary
            transactions={transactions}
            fireConfig={fireConfig}
            initialMode="yearly"
          />
        )}

        {/* Tab 4: Ledger Transactions */}
        {activeTab === 'ledger' && (
          <TransactionList
            transactions={transactions}
            categories={categories}
            fireConfig={fireConfig}
            onDeleteTransaction={handleDeleteTransaction}
            onOpenQuickAdd={() => setIsQuickAddOpen(true)}
            onResetDefaultData={handleResetDefaultData}
          />
        )}

        {/* Tab 5: Analytics Charts */}
        {activeTab === 'analytics' && (
          <AnalyticsCharts
            transactions={transactions}
            fireConfig={fireConfig}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950 py-6 text-center text-xs text-zinc-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-300">FIRE Planner</span>
            <span>• 整合收入、支出細類、稅金、投資與 FIRE 退休天數預估（Supabase 資料庫連通版）</span>
          </div>
          <div className="flex items-center gap-4 text-zinc-400">
            <button onClick={() => setIsCloudSyncOpen(true)} className="hover:text-amber-400 cursor-pointer">
              Supabase 雲端備份與同步
            </button>
            <button onClick={() => setIsCategoryManagerOpen(true)} className="hover:text-amber-400 cursor-pointer">
              管理分類細項
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <QuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        categories={categories}
        themeColor={fireConfig.themeColor}
        onAddTransaction={handleAddTransaction}
        onOpenCategoryManager={() => {
          setIsQuickAddOpen(false);
          setIsCategoryManagerOpen(true);
        }}
      />

      <CloudSyncModal
        isOpen={isCloudSyncOpen}
        onClose={() => setIsCloudSyncOpen(false)}
        syncCode={syncCode}
        themeColor={fireConfig.themeColor}
        onDataRestored={handleDataRestored}
      />

      <CategoryManagerModal
        isOpen={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
        categories={categories}
        themeColor={fireConfig.themeColor}
        onUpdateCategories={handleUpdateCategories}
      />

      <SystemSettingsModal
        isOpen={isSystemSettingsOpen}
        onClose={() => setIsSystemSettingsOpen(false)}
        config={fireConfig}
        onSaveConfig={handleUpdateFIREConfig}
      />
    </div>
  );
}
