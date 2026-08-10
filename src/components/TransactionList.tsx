import React, { useState } from 'react';
import { Search, Filter, Trash2, Edit2, Download, Plus, ReceiptText, Tag, Calendar, Check, RotateCcw } from 'lucide-react';
import { CategoryItem, FIREConfig, Transaction, TransactionType } from '../types';
import { getThemePreset } from '../utils/theme';

interface TransactionListProps {
  transactions: Transaction[];
  categories: CategoryItem[];
  fireConfig: FIREConfig;
  onDeleteTransaction: (id: string) => void;
  onOpenQuickAdd: () => void;
  onResetDefaultData: () => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  categories,
  fireConfig,
  onDeleteTransaction,
  onOpenQuickAdd,
  onResetDefaultData,
}) => {
  const currentTheme = getThemePreset(fireConfig.themeColor);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const sym = fireConfig.currencySymbol || 'NT$';
  const formatNum = (num: number) => new Intl.NumberFormat('zh-TW').format(num);

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
      {/* Top Filter Controls */}
      <div className="bg-[#0c0c0c] border border-white/5 p-5 rounded-3xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <ReceiptText className="w-5 h-5" style={{ color: currentTheme.primaryHex }} /> 收支與投資明細總帳
            </h2>
            <p className="text-xs text-gray-400">完整記錄每筆飲食細項、娛樂、居住、稅金與投資</p>
          </div>

          <div className="flex items-center gap-2">
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
                <th className="p-4">日期</th>
                <th className="p-4">類型大類</th>
                <th className="p-4">細分小項目 (細類)</th>
                <th className="p-4">備註說明</th>
                <th className="p-4 text-right">金額 (NT$)</th>
                <th className="p-4 text-center">操作</th>
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
                  let badgeStyle = 'bg-orange-500/10 text-orange-400 border-orange-500/20';
                  if (t.type === 'income') badgeStyle = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                  if (t.type === 'investment') badgeStyle = 'bg-purple-500/10 text-purple-300 border-purple-500/20';
                  if (t.type === 'tax') badgeStyle = 'bg-purple-500/10 text-purple-400 border-purple-500/20';

                  return (
                    <tr key={t.id} className="hover:bg-white/5 transition group">
                      <td className="p-4 font-mono font-medium text-gray-300">{t.date}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-xl border ${badgeStyle}`}>
                          {t.mainCategory}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-white flex items-center gap-2">
                        <span>{t.subCategory}</span>
                        {t.isQuickPreset && (
                          <span
                            className="text-[10px] px-1.5 py-0.2 rounded border font-mono font-bold"
                            style={{
                              backgroundColor: `rgba(${currentTheme.bgGlowRgb}, 0.15)`,
                              color: currentTheme.primaryHex,
                              borderColor: `rgba(${currentTheme.bgGlowRgb}, 0.3)`,
                            }}
                          >
                            1秒速記
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-gray-400 max-w-xs truncate">
                        {t.note || '-'}
                      </td>
                      <td className={`p-4 text-right font-mono font-extrabold text-sm sm:text-base ${t.type === 'income' ? 'text-emerald-400' : t.type === 'expense' ? 'text-orange-400' : t.type === 'investment' ? 'text-purple-300' : 'text-purple-400'}`}>
                        {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''} {sym} {formatNum(t.amount)}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => onDeleteTransaction(t.id)}
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
    </div>
  );
};
