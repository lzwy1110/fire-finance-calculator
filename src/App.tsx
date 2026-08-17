import React, { useState, useEffect } from 'react';
import { FIREProvider, useFIRE } from './context/FIREContext';
import { Header } from './components/Header';
import { DashboardOverview } from './components/DashboardOverview';
import { MonthlyYearlySummary } from './components/MonthlyYearlySummary';
import { AnalyticsCharts } from './components/AnalyticsCharts';
import { TransactionList } from './components/TransactionList';
import { PortfolioView } from './components/PortfolioView';
import { QuickAddModal } from './components/QuickAddModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { CategoryManagerModal } from './components/CategoryManagerModal';
import { SystemSettingsModal } from './components/SystemSettingsModal';
import { CurrencyExchangeModal } from './components/CurrencyExchangeModal';
import { AppLoadingSplash } from './components/AppLoadingSplash';
import { WidgetBridge } from './services/widgetBridge';
import { resetAllDataToDefault } from './utils/storage';
import { Capacitor } from '@capacitor/core';

function FIREAppContent() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'monthly' | 'yearly' | 'ledger' | 'analytics' | 'portfolio'>('dashboard');

  // Modal states
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isCloudSyncOpen, setIsCloudSyncOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isSystemSettingsOpen, setIsSystemSettingsOpen] = useState(false);
  const [isCurrencyExchangeOpen, setIsCurrencyExchangeOpen] = useState(false);

  // Consume from centralized single-source-of-truth FIREContext
  const {
    transactions,
    categories,
    quickPresets,
    portfolioStocks,
    fireConfig,
    usdRate,
    cashSavingsTWD,
    cashSavingsUSD,
    liveStockMarketValue,
    totalNetWorth,
    fireResult,
    storageMode,
    syncCode,
    isAppLoading,
    updateFIREConfig,
    adjustCashSavings,
    exchangeCurrency,
    addTransaction,
    deleteTransaction,
    updateCategories,
    updatePortfolioStocks,
    saveSingleStock,
    deleteSingleStock,
    toggleStorageMode,
    restoreAllData,
    clearAllLocalData,
    loadDemoSampleData,
  } = useFIRE();

  // 1. Android Widget Bridge: Push live today's expense, transactions & Supabase config to Native Widget
  useEffect(() => {
    if (Capacitor.isNativePlatform() && transactions) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const todayTotal = transactions
        .filter((t) => t.date === todayStr && t.type !== 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const rawUrl = localStorage.getItem('fire_supabase_url') || '';
      const rawKey = localStorage.getItem('fire_supabase_anon_key') || '';

      WidgetBridge.saveWidgetAppData({
        transactions: transactions as any,
        todayExpense: todayTotal,
        categoriesJson: JSON.stringify(categories || []),
        supabaseUrl: rawUrl,
        supabaseAnonKey: rawKey,
        syncCode: syncCode,
        storageMode: storageMode,
      }).catch(() => {});
    }
  }, [transactions, categories, syncCode, storageMode]);

  // 2. Android Widget Bridge: Sync Categories & Config to Native Widget
  useEffect(() => {
    if (Capacitor.isNativePlatform() && categories && categories.length > 0) {
      try {
        const subsMap: Record<string, string[]> = {};
        categories.forEach((c) => {
          if (c.subCategories && c.subCategories.length > 0) {
            subsMap[c.name] = c.subCategories;
          }
        });
        const rawUrl = localStorage.getItem('fire_supabase_url') || '';
        const rawKey = localStorage.getItem('fire_supabase_anon_key') || '';

        WidgetBridge.saveWidgetCustomConfig({
          categoriesJson: JSON.stringify(categories),
          subs: JSON.stringify(subsMap),
          supabaseUrl: rawUrl,
          supabaseAnonKey: rawKey,
          syncCode: syncCode,
          storageMode: storageMode,
        }).catch(() => {});
      } catch (e) {}
    }
  }, [categories, syncCode, storageMode]);

  // 3. Android Widget Intent & Quick Add Launch Handling
  useEffect(() => {
    const handleWidgetUrl = (url: string) => {
      try {
        const urlStr = url.toString();
        if (urlStr.includes('quick-add')) {
          const urlObj = new URL(urlStr);
          const type = urlObj.searchParams.get('type') as any;
          const amount = urlObj.searchParams.get('amount');
          const mainCategory = urlObj.searchParams.get('mainCategory');
          const subCategory = urlObj.searchParams.get('subCategory');

          if (amount && mainCategory && type) {
            addTransaction({
              type,
              amount: parseFloat(amount),
              mainCategory,
              subCategory: subCategory || '',
              date: new Date().toISOString().slice(0, 10),
              note: '來自 Android Widget 快記',
              tags: ['Widget'],
            });
            return;
          }

          if (mainCategory && subCategory) {
            const preset = quickPresets.find(
              (p) => p.mainCategory === mainCategory && p.subCategory === subCategory
            );
            if (preset) {
              addTransaction({
                type: 'expense',
                amount: preset.amount,
                mainCategory: preset.mainCategory,
                subCategory: preset.subCategory,
                date: new Date().toISOString().slice(0, 10),
                note: `來自 Widget 快記 (${preset.label})`,
                tags: ['Widget'],
                isQuickPreset: true,
              });
            }
          }
          setIsQuickAddOpen(true);
        }
      } catch (e) {
        if (url.includes('quick-add')) {
          setIsQuickAddOpen(true);
        }
      }
    };

    if (Capacitor.isNativePlatform()) {
      handleWidgetUrl(window.location.href);

      import('@capacitor/app').then(({ App: CapApp }) => {
        CapApp.addListener('appUrlOpen', (data) => {
          handleWidgetUrl(data.url);
        });
      }).catch(() => {});
    }
  }, [quickPresets, addTransaction]);

  const handleResetDefaultData = () => {
    if (window.confirm('確定要將財務資料重設為預設範例資料嗎？')) {
      resetAllDataToDefault();
      restoreAllData();
    }
  };

  if (isAppLoading) {
    return <AppLoadingSplash themeColor={fireConfig.themeColor} statusMessage="正在連線雲端資料庫並同步資產..." />;
  }

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
        storageMode={storageMode}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {/* Tab 1: Dashboard Overview */}
        {activeTab === 'dashboard' && (
          <DashboardOverview
            transactions={transactions}
            categories={categories}
            quickPresets={quickPresets}
            fireConfig={{
              ...fireConfig,
              currentNetWorth: totalNetWorth,
            }}
            fireResult={fireResult}
            stockMarketValue={liveStockMarketValue}
            onUpdateFIREConfig={updateFIREConfig}
            onAddTransaction={addTransaction}
            onOpenQuickAdd={() => setIsQuickAddOpen(true)}
            onOpenCategoryManager={() => setIsCategoryManagerOpen(true)}
            onOpenCloudSync={() => setIsCloudSyncOpen(true)}
            setActiveTab={setActiveTab}
          />
        )}

        {/* Tab 2: Unified Investment Portfolio & Analytics */}
        {(activeTab === 'portfolio' || activeTab === 'analytics') && (
          <div className="space-y-8 animate-fadeIn">
            <PortfolioView
              stocks={portfolioStocks}
              fireConfig={{
                ...fireConfig,
                currentNetWorth: totalNetWorth,
              }}
              cashSavingsTWD={cashSavingsTWD}
              cashSavingsUSD={cashSavingsUSD}
              usdRate={usdRate}
              onUpdateStocks={updatePortfolioStocks}
              onSaveSingleStock={saveSingleStock}
              onDeleteSingleStock={deleteSingleStock}
              onSyncNetWorthToFIRE={() => {}}
              onAdjustCashSavings={adjustCashSavings}
              onOpenCurrencyExchange={() => setIsCurrencyExchangeOpen(true)}
            />

            {/* Integrated Investment Analytics & Category Distribution Section */}
            <div className="border-t border-white/10 pt-8">
              <h2 className="text-xl font-black text-white mb-4 flex items-center gap-2">
                <span>📊 財務統計分析與類別圖表</span>
              </h2>
              <AnalyticsCharts
                transactions={transactions}
                fireConfig={{
                  ...fireConfig,
                  currentNetWorth: totalNetWorth,
                }}
              />
            </div>
          </div>
        )}

        {/* Tab 3: Integrated Monthly & Yearly Financial Summary */}
        {(activeTab === 'monthly' || activeTab === 'yearly') && (
          <MonthlyYearlySummary
            transactions={transactions}
            fireConfig={{
              ...fireConfig,
              currentNetWorth: totalNetWorth,
            }}
            initialMode={activeTab === 'yearly' ? 'yearly' : 'monthly'}
          />
        )}

        {/* Tab 4: Ledger Transactions */}
        {activeTab === 'ledger' && (
          <TransactionList
            transactions={transactions}
            categories={categories}
            fireConfig={{
              ...fireConfig,
              currentNetWorth: totalNetWorth,
            }}
            onDeleteTransaction={deleteTransaction}
            onOpenQuickAdd={() => setIsQuickAddOpen(true)}
            onResetDefaultData={loadDemoSampleData}
            onClearAllData={() => clearAllLocalData({ syncCleanToCloud: storageMode === 'cloud' })}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950 py-6 text-center text-xs text-zinc-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-300">FIRE Planner</span>
            <span>• 整合美股與台股庫存、收支細類、稅金、投資與 FIRE 退休估算</span>
          </div>
          <div className="flex items-center gap-4 text-zinc-400">
            <button onClick={() => setIsSystemSettingsOpen(true)} className="hover:text-amber-400 cursor-pointer">
              系統偏好與存儲設定
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
        onAddTransaction={addTransaction}
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
        onDataRestored={restoreAllData}
      />

      <CategoryManagerModal
        isOpen={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
        categories={categories}
        themeColor={fireConfig.themeColor}
        onUpdateCategories={updateCategories}
      />

      <SystemSettingsModal
        isOpen={isSystemSettingsOpen}
        onClose={() => setIsSystemSettingsOpen(false)}
        config={fireConfig}
        stockMarketValue={liveStockMarketValue}
        onSaveConfig={updateFIREConfig}
        syncCode={syncCode}
        storageMode={storageMode}
        onToggleStorageMode={toggleStorageMode}
        onOpenCloudSync={() => setIsCloudSyncOpen(true)}
        onOpenCategoryManager={() => {
          setIsSystemSettingsOpen(false);
          setIsCategoryManagerOpen(true);
        }}
        onClearAllLocalData={() => clearAllLocalData({ syncCleanToCloud: storageMode === 'cloud' })}
        onLoadDemoData={loadDemoSampleData}
      />

      <CurrencyExchangeModal
        isOpen={isCurrencyExchangeOpen}
        onClose={() => setIsCurrencyExchangeOpen(false)}
        cashSavingsTWD={cashSavingsTWD}
        cashSavingsUSD={cashSavingsUSD}
        systemUsdRate={usdRate}
        themeColor={fireConfig.themeColor}
        onExchange={exchangeCurrency}
      />
    </div>
  );
}

export default function App() {
  return (
    <FIREProvider>
      <FIREAppContent />
    </FIREProvider>
  );
}
