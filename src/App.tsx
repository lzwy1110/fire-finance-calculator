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
import { MobileWidget } from './components/MobileWidget';
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
  const [isMobileDeviceView, setIsMobileDeviceView] = useState(false);

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
        if (cTx && cTx.length > 0) {
          setTransactions(cTx);
          saveTransactions(cTx);
        }
        if (cCat && cCat.length > 0) {
          setCategories(cCat);
          saveCategories(cCat);
        }
        if (cCfg) {
          setFireConfig(cCfg);
          saveFIREConfig(cCfg);
          applyThemeToCSSVariables(cCfg.themeColor);
        }
        if (cPresets && cPresets.length > 0) {
          setQuickPresets(cPresets);
        }
      }
    });
  }, []);

  // Sync theme changes
  useEffect(() => {
    applyThemeToCSSVariables(fireConfig.themeColor);
  }, [fireConfig.themeColor]);

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
        isMobileDeviceView={isMobileDeviceView}
        setIsMobileDeviceView={setIsMobileDeviceView}
        syncCode={syncCode}
        themeColor={fireConfig.themeColor}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Mobile Device View Overlay (if toggled) */}
        {isMobileDeviceView ? (
          <div className="py-8 bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 my-4 shadow-2xl space-y-6">
            <div className="text-center max-w-md mx-auto space-y-2">
              <span className="px-3 py-1 bg-white/10 text-gray-200 border border-white/10 rounded-full text-xs font-bold">
                📱 手機桌面 1 秒小工具模式
              </span>
              <h2 className="text-2xl font-black text-zinc-100">手機桌面小工具擬真預覽</h2>
              <p className="text-xs text-zinc-400">
                三項極簡輸入（大類、細類、金額），可滾動或下拉切換，大幅縮減佔用空間！
              </p>
            </div>

            <MobileWidget
              categories={categories}
              quickPresets={quickPresets}
              currencySymbol={fireConfig.currencySymbol}
              themeColor={fireConfig.themeColor}
              onAddTransaction={handleAddTransaction}
              onOpenFullModal={() => setIsQuickAddOpen(true)}
              onOpenCategoryManager={() => setIsCategoryManagerOpen(true)}
            />

            <div className="text-center">
              <button
                onClick={() => setIsMobileDeviceView(false)}
                className="px-5 py-2 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                返回電腦全景儀表板
              </button>
            </div>
          </div>
        ) : (
          <>
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
                isMobileDeviceView={isMobileDeviceView}
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
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950 py-6 text-center text-xs text-zinc-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-300">FIRE Planner</span>
            <span>• 整合收入、支出細類、稅金、投資與 FIRE 退休天數預估（Supabase 資料庫整合版）</span>
          </div>
          <div className="flex items-center gap-4 text-zinc-400">
            <button onClick={() => setIsCloudSyncOpen(true)} className="hover:text-amber-400">
              Supabase 雲端備份與同步
            </button>
            <button onClick={() => setIsCategoryManagerOpen(true)} className="hover:text-amber-400">
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
