import React, { useState } from 'react';
import { Settings, Plus, Trash2, X, Tag, Sparkles, Check } from 'lucide-react';
import { CategoryItem } from '../types';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryItem[];
  onUpdateCategories: (newCategories: CategoryItem[]) => void;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  categories,
  onUpdateCategories,
}) => {
  if (!isOpen) return null;

  const [selectedCatId, setSelectedCatId] = useState<string>(categories[0]?.id || '');
  const [newSubCatName, setNewSubCatName] = useState('');
  const [newMainCatName, setNewMainCatName] = useState('');
  const [newMainCatType, setNewMainCatType] = useState<'expense' | 'income' | 'investment' | 'tax'>('expense');

  const selectedCat = categories.find((c) => c.id === selectedCatId) || categories[0];

  const handleAddSubCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubCatName.trim() || !selectedCat) return;

    const trimmed = newSubCatName.trim();
    if (selectedCat.subCategories.includes(trimmed)) return;

    const updated = categories.map((c) => {
      if (c.id === selectedCat.id) {
        return {
          ...c,
          subCategories: [...c.subCategories, trimmed],
        };
      }
      return c;
    });

    onUpdateCategories(updated);
    setNewSubCatName('');
  };

  const handleDeleteSubCategory = (subName: string) => {
    if (!selectedCat) return;
    const updated = categories.map((c) => {
      if (c.id === selectedCat.id) {
        return {
          ...c,
          subCategories: c.subCategories.filter((s) => s !== subName),
        };
      }
      return c;
    });
    onUpdateCategories(updated);
  };

  const handleAddMainCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMainCatName.trim()) return;

    const newCat: CategoryItem = {
      id: `cat-custom-${Date.now()}`,
      name: newMainCatName.trim(),
      type: newMainCatType,
      icon: 'Tag',
      color: 'amber',
      subCategories: ['一般與自訂細項'],
    };

    onUpdateCategories([...categories, newCat]);
    setSelectedCatId(newCat.id);
    setNewMainCatName('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-100">管理財務大類與細分小項目</h3>
              <p className="text-xs text-zinc-400">自訂飲食 (早餐/午餐/晚餐/宵夜/點心)、娛樂、居住等細類</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-100 rounded-xl hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Main Category List */}
          <div className="md:col-span-5 space-y-3 border-r border-zinc-800/80 pr-4">
            <label className="block text-xs font-bold text-zinc-400">選擇大類 (Main Categories)</label>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCatId(c.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition ${
                    selectedCatId === c.id
                      ? 'bg-amber-500 text-zinc-950 font-bold shadow'
                      : 'bg-zinc-950 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <span>{c.name}</span>
                  <span className="text-[10px] opacity-75 font-mono">({c.subCategories.length} 細項)</span>
                </button>
              ))}
            </div>

            {/* Add Custom Main Category Form */}
            <form onSubmit={handleAddMainCategory} className="pt-3 border-t border-zinc-800 space-y-2">
              <span className="text-xs font-bold text-zinc-400 block">+ 新增主要大類</span>
              <input
                type="text"
                placeholder="例如: 寵物照顧, 健身訂閱"
                value={newMainCatName}
                onChange={(e) => setNewMainCatName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
              />
              <div className="flex gap-2">
                <select
                  value={newMainCatType}
                  onChange={(e: any) => setNewMainCatType(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-2 py-1 text-xs text-zinc-200"
                >
                  <option value="expense">支出</option>
                  <option value="income">收入</option>
                  <option value="investment">投資</option>
                  <option value="tax">稅金</option>
                </select>
                <button
                  type="submit"
                  disabled={!newMainCatName}
                  className="flex-1 bg-amber-500 text-zinc-950 font-bold text-xs rounded-xl py-1 hover:bg-amber-400 disabled:opacity-40 transition"
                >
                  新增大類
                </button>
              </div>
            </form>
          </div>

          {/* Subcategories Editor */}
          <div className="md:col-span-7 space-y-4">
            {selectedCat && (
              <>
                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
                  <span className="text-xs text-zinc-400 block">目前正在編輯的大類：</span>
                  <h4 className="text-base font-bold text-amber-300">{selectedCat.name}</h4>
                </div>

                {/* Subcategory List */}
                <div>
                  <label className="block text-xs font-bold text-zinc-400 mb-2">
                    現有細分小項目 (Subcategories)
                  </label>
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 bg-zinc-950 rounded-2xl border border-zinc-800">
                    {selectedCat.subCategories.map((sub) => (
                      <span
                        key={sub}
                        className="px-3 py-1 bg-zinc-900 text-zinc-200 text-xs rounded-xl border border-zinc-800 flex items-center gap-2 group"
                      >
                        <span>{sub}</span>
                        <button
                          onClick={() => handleDeleteSubCategory(sub)}
                          className="text-zinc-500 hover:text-rose-400 transition"
                          title="刪除此細項"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Add Subcategory Form */}
                <form onSubmit={handleAddSubCategory} className="space-y-2">
                  <label className="block text-xs font-bold text-zinc-400">
                    + 為 [{selectedCat.name}] 新增細分項目
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="例如: 宵夜串燒, 早餐蛋餅, 蛋白飲, 咖啡"
                      value={newSubCatName}
                      onChange={(e) => setNewSubCatName(e.target.value)}
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!newSubCatName}
                      className="px-4 py-2 bg-emerald-500 text-zinc-950 font-bold text-xs rounded-xl hover:bg-emerald-400 disabled:opacity-40 transition"
                    >
                      新增細項
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-zinc-800 text-right">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-zinc-950 font-bold text-xs rounded-xl hover:from-amber-400 hover:to-orange-400 transition"
          >
            儲存與套用
          </button>
        </div>
      </div>
    </div>
  );
};
