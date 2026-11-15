import React, { useState } from 'react';
import { Ban, Check, Plus, Search, ShieldCheck, Trash2, Wallet, X } from 'lucide-react';
import {
  WebPanelState,
  adjustUserBalance,
  approveReceipt,
  rejectReceipt,
  toggleUserBlocked,
} from '../utils/webPanelEngine';

interface UsersFinanceViewProps {
  state: WebPanelState;
  onUpdateState: (updater: (prev: WebPanelState) => WebPanelState) => void;
  onSaveState: (next?: WebPanelState) => Promise<void>;
}

export function UsersFinanceView({ state, onUpdateState, onSaveState }: UsersFinanceViewProps) {
  const [search, setSearch] = useState('');
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [deltaAmount, setDeltaAmount] = useState('100000');
  const [deltaNote, setDeltaNote] = useState('شارژ دستی توسط ادمین');

  const [newUser, setNewUser] = useState({ telegramId: '', username: '', fullName: '', balance: '0' });
  const [newCard, setNewCard] = useState({ number: '', name: '' });

  const filteredUsers = state.users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      String(u.telegramId).includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.fullName.toLowerCase().includes(q)
    );
  });

  const totalWallet = state.users.reduce((sum, u) => sum + u.balance, 0);
  const pendingCount = state.pendingReceipts.filter((r) => r.status === 'pending').length;
  const totalRevenue = state.orders.reduce((sum, o) => sum + o.amountPaid, 0);

  const commitState = (next: WebPanelState) => {
    onUpdateState(() => next);
    void onSaveState(next);
  };

  const handleApplyBalance = (telegramId: number, sign: 1 | -1) => {
    const num = Number(deltaAmount);
    if (!Number.isFinite(num) || num <= 0) return;
    const next = adjustUserBalance(state, telegramId, sign * num, deltaNote);
    commitState(next);
    setEditingUserId(null);
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    const tgId = Number(newUser.telegramId.trim());
    if (!Number.isInteger(tgId) || tgId <= 0) return;
    if (state.users.some((u) => u.telegramId === tgId)) return;
    const next: WebPanelState = {
      ...state,
      users: [
        {
          telegramId: tgId,
          username: newUser.username.trim().replace(/^@/, ''),
          fullName: newUser.fullName.trim() || `کاربر ${tgId}`,
          balance: Math.max(0, Number(newUser.balance) || 0),
          joinedAt: new Date().toLocaleDateString('fa-IR'),
          referralCount: 0,
          blocked: false,
        },
        ...state.users,
      ],
    };
    commitState(next);
    setNewUser({ telegramId: '', username: '', fullName: '', balance: '0' });
  };

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCard.number.trim()) return;
    const next: WebPanelState = {
      ...state,
      cards: [...state.cards, { number: newCard.number.trim(), name: newCard.name.trim() }],
    };
    commitState(next);
    setNewCard({ number: '', name: '' });
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold text-slate-900">مدیریت کاربران، کیف پول و پرداخت‌ها</h1>
        <p className="mt-1 text-sm text-slate-600">
          مشاهده لیست کاربران، تغییر موجودی کیف پول، مسدودسازی، تایید رسیدهای واریز (با محاسبه خودکار پاداش دعوت) و مدیریت کارت‌های بانکی.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">کل کاربران</div>
          <div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
            {state.users.length.toLocaleString('fa-IR')}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">مجموع کیف پول‌ها</div>
          <div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
            {totalWallet.toLocaleString('fa-IR')} <span className="text-xs font-normal text-slate-500">تومان</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">رسیدهای در انتظار</div>
          <div className="mt-1 text-2xl font-bold text-amber-700 tabular-nums">
            {pendingCount.toLocaleString('fa-IR')}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">درآمد کل ثبت‌شده</div>
          <div className="mt-1 text-2xl font-bold text-teal-700 tabular-nums">
            {totalRevenue.toLocaleString('fa-IR')} <span className="text-xs font-normal text-slate-500">تومان</span>
          </div>
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">کاربران ربات ({filteredUsers.length})</h2>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجو با آیدی عددی، نام یا یوزرنیم..."
              className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <th className="px-4 py-3 text-right font-medium">شناسه تلگرام</th>
                <th className="px-4 py-3 text-right font-medium">نام و یوزرنیم</th>
                <th className="px-4 py-3 text-right font-medium">موجودی کیف پول</th>
                <th className="px-4 py-3 text-right font-medium">سرویس‌ها</th>
                <th className="px-4 py-3 text-right font-medium">دعوت‌ها</th>
                <th className="px-4 py-3 text-right font-medium">وضعیت</th>
                <th className="px-4 py-3 text-left font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user) => {
                const svcCount = state.orders.filter((o) => o.telegramId === user.telegramId).length;
                const isEditing = editingUserId === user.telegramId;
                return (
                  <React.Fragment key={user.telegramId}>
                    <tr className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono text-slate-800 tabular-nums" dir="ltr">
                        {user.telegramId}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{user.fullName}</div>
                        <div className="text-xs font-mono text-slate-500" dir="ltr">
                          {user.username ? `@${user.username}` : '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900 tabular-nums">
                        {user.balance.toLocaleString('fa-IR')} تومان
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-700">{svcCount}</td>
                      <td className="px-4 py-3 tabular-nums text-slate-700">{user.referralCount}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium ${
                            user.blocked ? 'text-rose-700' : 'text-emerald-700'
                          }`}
                        >
                          {user.blocked ? 'مسدود' : 'فعال'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingUserId(isEditing ? null : user.telegramId)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md"
                          >
                            <Wallet className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>تغییر موجودی</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => commitState(toggleUserBlocked(state, user.telegramId))}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md ${
                              user.blocked
                                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                                : 'bg-rose-50 hover:bg-rose-100 text-rose-800'
                            }`}
                          >
                            {user.blocked ? (
                              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                            ) : (
                              <Ban className="w-3.5 h-3.5" aria-hidden="true" />
                            )}
                            <span>{user.blocked ? 'رفع مسدودیت' : 'مسدود'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isEditing && (
                      <tr className="bg-teal-50/40">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="number"
                              min={1000}
                              dir="ltr"
                              value={deltaAmount}
                              onChange={(e) => setDeltaAmount(e.target.value)}
                              className="w-36 px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-md tabular-nums"
                              placeholder="مبلغ (تومان)"
                            />
                            <input
                              type="text"
                              value={deltaNote}
                              onChange={(e) => setDeltaNote(e.target.value)}
                              className="flex-1 min-w-[180px] px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
                              placeholder="توضیح تراکنش"
                            />
                            <button
                              type="button"
                              onClick={() => handleApplyBalance(user.telegramId, 1)}
                              className="px-3 py-1.5 text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-md"
                            >
                              + افزایش موجودی
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyBalance(user.telegramId, -1)}
                              className="px-3 py-1.5 text-xs font-medium bg-rose-700 hover:bg-rose-800 text-white rounded-md"
                            >
                              - کسر موجودی
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <form onSubmit={handleAddUser} className="p-4 border-t border-slate-200 bg-slate-50 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
          <div className="sm:col-span-3">
            <label htmlFor="nu-tgid" className="block text-[11px] font-medium text-slate-600 mb-1">
              آیدی عددی تلگرام
            </label>
            <input
              id="nu-tgid"
              type="number"
              required
              dir="ltr"
              placeholder="9001003"
              value={newUser.telegramId}
              onChange={(e) => setNewUser((p) => ({ ...p, telegramId: e.target.value }))}
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-md"
            />
          </div>
          <div className="sm:col-span-3">
            <label htmlFor="nu-name" className="block text-[11px] font-medium text-slate-600 mb-1">
              نام کاربر
            </label>
            <input
              id="nu-name"
              type="text"
              placeholder="نام کامل"
              value={newUser.fullName}
              onChange={(e) => setNewUser((p) => ({ ...p, fullName: e.target.value }))}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="nu-user" className="block text-[11px] font-medium text-slate-600 mb-1">
              یوزرنیم
            </label>
            <input
              id="nu-user"
              type="text"
              dir="ltr"
              placeholder="@user"
              value={newUser.username}
              onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))}
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-md"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="nu-bal" className="block text-[11px] font-medium text-slate-600 mb-1">
              موجودی اولیه
            </label>
            <input
              id="nu-bal"
              type="number"
              min={0}
              dir="ltr"
              value={newUser.balance}
              onChange={(e) => setNewUser((p) => ({ ...p, balance: e.target.value }))}
              className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-md tabular-nums"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-md"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>افزودن کاربر</span>
            </button>
          </div>
        </form>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">رسیدهای پرداخت و تایید ادمین</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {state.pendingReceipts.length === 0 ? (
              <div className="p-6 text-xs text-slate-500">هیچ رسیدی ثبت نشده است.</div>
            ) : (
              state.pendingReceipts.map((r) => (
                <div key={r.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-sm font-semibold text-slate-900 tabular-nums">
                      رسید #{r.id} — {r.amount.toLocaleString('fa-IR')} تومان
                    </div>
                    <div className="text-xs text-slate-500">
                      کاربر <span className="font-mono">{r.telegramId}</span> ·{' '}
                      {r.purpose === 'wallet'
                        ? 'شارژ کیف پول'
                        : r.purpose === 'purchase'
                        ? `خرید ${r.meta.serviceName || ''} (${r.meta.gb || 0}GB)`
                        : `تمدید ${r.meta.clientEmail || ''} (${r.meta.gb || 0}GB)`}
                    </div>
                  </div>

                  {r.status === 'pending' ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => commitState(approveReceipt(state, r.id))}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-md"
                      >
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>تایید و اعمال</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => commitState(rejectReceipt(state, r.id))}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-md"
                      >
                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>رد</span>
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`text-xs font-semibold ${
                        r.status === 'approved' ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {r.status === 'approved' ? 'تایید شده' : 'رد شده'}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">کارت‌های بانکی واریز (CARDS)</h2>
          <div className="space-y-2">
            {state.cards.map((card, idx) => (
              <div
                key={`${card.number}-${idx}`}
                className="flex items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg"
              >
                <div>
                  <div className="text-xs font-mono font-semibold text-slate-900 tabular-nums" dir="ltr">
                    {card.number}
                  </div>
                  <div className="text-xs text-slate-500">{card.name || 'بدون نام'}</div>
                </div>
                <button
                  type="button"
                  disabled={state.cards.length <= 1}
                  onClick={() =>
                    commitState({
                      ...state,
                      cards: state.cards.filter((_, i) => i !== idx),
                    })
                  }
                  className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddCard} className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t border-slate-100">
            <input
              type="text"
              dir="ltr"
              required
              placeholder="6037-9911-..."
              value={newCard.number}
              onChange={(e) => setNewCard((p) => ({ ...p, number: e.target.value }))}
              className="sm:col-span-6 px-2.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg"
            />
            <input
              type="text"
              placeholder="نام صاحب کارت"
              value={newCard.name}
              onChange={(e) => setNewCard((p) => ({ ...p, name: e.target.value }))}
              className="sm:col-span-4 px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
            />
            <button
              type="submit"
              className="sm:col-span-2 px-3 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg"
            >
              افزودن
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
