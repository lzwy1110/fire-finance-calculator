import React, { useState } from 'react';
import { Search, Trash2, Download, Plus, ReceiptText, RefreshCw, RotateCcw, Cloud } from 'lucide-react';
import { CategoryItem, FIREConfig, Transaction } from '../types';
import { getThemePreset } from '../utils/theme';
import { ConfirmModal } from './ConfirmModal';

interface TransactionListProps {
  transactions: Transaction[];
  categories: CategoryItem[];
  fireConfig: FIREConfig;
  onDeleteTransaction: (id: string) => void;
  onOpenQuickAdd: () => void;
  onResetDefaultData: () => void;
  onRefreshData?: () => void;
  syncCode?: string;
  onOpenCloudSync?: () => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  categories,
  fireConfig,
  onDeleteTransaction,
  onOpenQuickAdd,
  onResetDefaultData,
  onRefreshData,
  syncCode,
  onOpenCloudSync,
}) => {
  const currentTheme = getThemePreset(fireConfig.themeColor);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Deletion Confirm Modal state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; amount: number } | null>(null);

  const sym = fireConfig.currencySymbol || 'NT$';
  const formatNum = (num: number) => new Intl.NumberFormat('zh-TW').format(num);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (onRefreshData) {
      await onRefreshData();
    }
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Filtering
  const filtered = transactions.filter((t) => {
    if (selectedType !== 'all' && t.type !== selectedType) return false;
    if (selectedCategory !== 'all' && t.mainCategory !== selectedCategory) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchCat = t.mainCategory.toLowerCase().includes(q);
      const matchSub = t.subCategory.toLowerCase().includes(q);
      const matchNote = t.note?.toLowerCase().includes(q) || false;
      const matchAmt = t.amount.toString().includes(q);
      if (!matchCat && !matchSub && !matchNote && !matchAmt) return false;
    }
    return true;
  });

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['ID', '日期', '類型', '大類', '細類細項', '金額', '備註說明'];
    const rows = filtered.map((t) => [
      t.id,
      t.date,
      t.type,
      t.mainCategory,
      t.subCategory,
      t.amount,
      `"${t.note || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `FIRE_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Cloud Sync Status Banner Bar */}
      <div className="bg-[#0e0e0e] border border-emerald-500/20 rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-2 flex-wrap">
              <span>Supabase 雲端備份與裝置同步</span>
              <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {syncCode ? `同步碼: ${syncCode}` : '已連線'}
              </span>
            </div>
            <p className="text-[11px] text-gray-400">跨平臺、Android 桌面小工具與所有裝置即時對齊數據</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-extrabold rounded-xl transition cursor-pointer active:scale-95 shadow-md"
            title="手動刷新 Supabase 雲端與 Widget 最新資料"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            即時雲端同步
          </button>

          {onOpenCloudSync && (
            <button
              onClick={onOpenCloudSync}
              className="px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              管理同步碼
            </button>
          )}
        </div>
      </div>

      {/* Top Filter Controls */}
      <div className="bg-[#0c0c0c] border border-white/5 p-5 rounded-3xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ReceiptText className="w-5 h-5" style={{ color: currentTheme.primaryHex }} /> 收支與投資明細總帳
            </h2>
            <p className="text-xs text-gray-400">完整記錄每筆飲食細項、娛樂、居住、稅金與投資</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-200 text-xs font-semibold rounded-xl border border-white/10 transition cursor-pointer"
              title="匯出 CSV 檔"
            >
              <Download className="w-4 h-4" style={{ color: currentTheme.primaryHex }} />
              匯出 CSV
            </button>

            <button
              onClick={onResetDefaultData}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 text-xs font-semibold rounded-xl border border-white/10 transition cursor-pointer"
              title="重設為預設數據"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              重設範例
            </button>

            <button
              onClick={onOpenQuickAdd}
              className="flex items-center gap-1.5 px-4 py-2 text-black font-bold text-xs rounded-xl transition cursor-pointer shadow-md"
              style={{
                backgroundColor: currentTheme.primaryHex,
                boxShadow: `0 0 12px rgba(${currentTheme.bgGlowRgb}, 0.3)`,
              }}
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              新增紀錄
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Keyword Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-500" />
            <input
              type="text"
              placeholder="搜尋關鍵字 (例如: 早餐, 房租, 0050)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-gray-200 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          {/* Type Selector */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-gray-200 focus:border-cyan-500 focus:outline-none cursor-pointer"
          >
            <option value="all">全部分類 (收入/支出/稅金/投資)</option>
            <option value="expense">支出 (Expense)</option>
            <option value="income">收入 (Income)</option>
            <option value="investment">投資 (Investment)</option>
            <option value="tax">稅金 (Tax)</option>
          </select>

          {/* Main Category Selector */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-gray-200 focus:border-cyan-500 focus:outline-none cursor-pointer"
          >
            <option value="all">全部大類 (飲食/娛樂/居住/交通...)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="bg-[#0c0c0c] border border-white/5 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm text-gray-300">
            <thead className="bg-black/60 text-gray-400 uppercase text-[11px] font-mono border-b border-white/10">
              <tr>
                <th className="p-3 sm:p-4 whitespace-nowrap">日期</th>
                <th className="p-3 sm:p-4 whitespace-nowrap">類型大類</th>
                <th className="p-3 sm:p-4 whitespace-nowrap">細分小項目 (細類)</th>
                <th className="p-3 sm:p-4">備註說明</th>
                <th className="p-3 sm:p-4 text-right whitespace-nowrap">金額 ({sym})</th>
                <th className="p-3 sm:p-4 text-center whitespace-nowrap">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-sans">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-500 text-sm">
                    沒有找到符合條件的明細紀錄
                  </td>
                </tr>
              ) : (
                filtered.map((t) => {
                  let badgeStyle = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                  if (t.type === 'income') badgeStyle = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                  if (t.type === 'investment') badgeStyle = 'bg-purple-500/10 text-purple-300 border-purple-500/20';
                  if (t.type === 'tax') badgeStyle = 'bg-pink-500/10 text-pink-400 border-pink-500/20';

                  return (
                    <tr key={t.id} className="hover:bg-white/5 transition group">
                      <td className="p-3 sm:p-4 font-mono font-medium text-gray-300 whitespace-nowrap">{t.date}</td>
                      <td className="p-3 sm:p-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-xl border whitespace-nowrap inline-flex items-center gap-1 ${badgeStyle}`}>
                          {t.mainCategory}
                        </span>
                      </td>
                      <td className="p-3 sm:p-4 font-bold text-white whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{t.subCategory}</span>
                          {t.isQuickPreset && (
                            <span
                              className="text-[10px] px-1.5 py-0.2 rounded border font-mono font-bold whitespace-nowrap"
                              style={{
                                backgroundColor: `rgba(${currentTheme.bgGlowRgb}, 0.15)`,
                                color: currentTheme.primaryHex,
                                borderColor: `rgba(${currentTheme.bgGlowRgb}, 0.3)`,
                              }}
                            >
                              1秒速記
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 sm:p-4 text-gray-400 max-w-xs truncate">
                        {t.note || '-'}
                      </td>
                      <td className={`p-3 sm:p-4 text-right font-mono font-extrabold text-sm sm:text-base whitespace-nowrap ${t.type === 'income' ? 'text-emerald-400' : t.type === 'expense' ? 'text-amber-400' : t.type === 'investment' ? 'text-purple-300' : 'text-pink-400'}`}>
                        {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''} {sym} {formatNum(t.amount)}
                      </td>
                      <td className="p-3 sm:p-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => setDeleteTarget({ id: t.id, name: `${t.mainCategory} (${t.subCategory})`, amount: t.amount })}
                          className="p-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                          title="刪除這筆紀錄"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Styled Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="確定要刪除這筆收支紀錄？"
        message={`確定要刪除紀錄「${deleteTarget?.name} - ${sym} ${formatNum(deleteTarget?.amount || 0)}」嗎？刪除後資料將無法復原。`}
        confirmText="確定刪除"
        cancelText="取消"
        onConfirm={() => {
          if (deleteTarget) {
            onDeleteTransaction(deleteTarget.id);
          }
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
};
