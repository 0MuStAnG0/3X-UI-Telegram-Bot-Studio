export interface InboundItem {
  id: number;
  remark: string;
  protocol: string;
  port: number;
  flow: string;
  enabled: boolean;
  clientCount?: number;
}

export interface PaymentCard {
  number: string;
  name: string;
}

export interface PricingTiers {
  low: number;
  mid: number;
  high: number;
  tier1Max: number;
  tier2Max: number;
}

export interface SalesPlan {
  id: string;
  name: string;
  gb: number;
  days: number;
  price: number;
  inboundId: number;
  active: boolean;
}

export interface PanelUser {
  telegramId: number;
  username: string;
  fullName: string;
  balance: number;
  joinedAt: string;
  referralCount: number;
  inviterId?: number;
  referralBonusPaid?: boolean;
  blocked: boolean;
}

export interface VpnConfigOrder {
  id: number;
  telegramId: number;
  clientEmail: string;
  inboundId: number;
  inboundRemark: string;
  gb: number;
  usedGb: number;
  daysLeft: number;
  subId: string;
  amountPaid: number;
  orderType: 'new' | 'renew' | 'trial';
  active: boolean;
  createdAt: string;
}

export interface PendingReceipt {
  id: number;
  telegramId: number;
  amount: number;
  purpose: 'wallet' | 'purchase' | 'renew';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  meta: {
    gb?: number;
    serviceName?: string;
    inboundId?: number;
    inboundRemark?: string;
    clientEmail?: string;
  };
}

export interface DiscountCodeItem {
  code: string;
  percent: number;
  maxUses: number;
  usedCount: number;
}

export interface TransactionLog {
  id: number;
  telegramId: number;
  amount: number;
  description: string;
  createdAt: string;
}

export interface BroadcastEntry {
  id: number;
  message: string;
  audience: 'all' | 'active_buyers';
  sentCount: number;
  failedCount: number;
  createdAt: string;
}

export interface BotConnectionConfig {
  botToken: string;
  botUsername: string;
  adminIds: string;
  support: string;
  requiredChannelId: string;
  requiredChannelInvite: string;
  logChannelId: string;
  webPanelEnabled: boolean;
  webPanelPort: number;
  webPanelPass: string;
}

export interface PanelConnectionConfig {
  panelUrl: string;
  panelPath: string;
  panelApiToken: string;
  subBaseUrl: string;
  proxyEnabled: boolean;
  proxyHost: string;
  proxyPort: string;
  proxyUser: string;
  proxyPass: string;
}

export interface BotFeaturesConfig {
  trialEnabled: boolean;
  trialGb: number;
  trialDays: number;
  referralEnabled: boolean;
  referralPercent: number;
  reminderEnabled: boolean;
  reminderGbThreshold: number;
  reminderDaysThreshold: number;
  tutorials: {
    android: string;
    ios: string;
    windows: string;
  };
}

export interface WebPanelState {
  bot: BotConnectionConfig;
  panel: PanelConnectionConfig;
  inbounds: InboundItem[];
  pricing: PricingTiers;
  salesPlans: SalesPlan[];
  cards: PaymentCard[];
  discountCodes: DiscountCodeItem[];
  users: PanelUser[];
  orders: VpnConfigOrder[];
  pendingReceipts: PendingReceipt[];
  transactions: TransactionLog[];
  broadcastLogs: BroadcastEntry[];
  features: BotFeaturesConfig;
  nextOrderId: number;
  nextTxId: number;
  nextBroadcastId: number;
}

export function createDefaultPanelState(): WebPanelState {
  return {
    bot: {
      botToken: '',
      botUsername: '',
      adminIds: '100100100',
      support: '@vpn_support',
      requiredChannelId: '0',
      requiredChannelInvite: '',
      logChannelId: '0',
      webPanelEnabled: true,
      webPanelPort: 8080,
      webPanelPass: 'admin1234',
    },
    panel: {
      panelUrl: 'https://panel.example.com:2053',
      panelPath: '/xui',
      panelApiToken: '',
      subBaseUrl: 'https://sub.example.com:2096/sub',
      proxyEnabled: false,
      proxyHost: '127.0.0.1',
      proxyPort: '10808',
      proxyUser: '',
      proxyPass: '',
    },
    inbounds: [
      {
        id: 1,
        remark: 'Germany · VLESS Reality',
        protocol: 'vless',
        port: 443,
        flow: 'xtls-rprx-vision',
        enabled: true,
        clientCount: 2,
      },
      {
        id: 2,
        remark: 'Finland · VLESS WS',
        protocol: 'vless',
        port: 2096,
        flow: '',
        enabled: true,
        clientCount: 1,
      },
    ],
    pricing: {
      low: 8000,
      mid: 7500,
      high: 7000,
      tier1Max: 20,
      tier2Max: 60,
    },
    salesPlans: [
      { id: 'plan-20g', name: 'اقتصادی ۲۰ گیگ', gb: 20, days: 30, price: 150000, inboundId: 1, active: true },
      { id: 'plan-50g', name: 'استاندارد ۵۰ گیگ', gb: 50, days: 30, price: 375000, inboundId: 1, active: true },
      { id: 'plan-100g', name: 'حرفه‌ای ۱۰۰ گیگ', gb: 100, days: 30, price: 700000, inboundId: 1, active: true },
    ],
    cards: [{ number: '6037-9911-4422-8810', name: 'مدیریت سرویس' }],
    discountCodes: [
      { code: 'SALE20', percent: 20, maxUses: 100, usedCount: 4 },
      { code: 'VIP10', percent: 10, maxUses: 50, usedCount: 1 },
    ],
    users: [
      {
        telegramId: 9001001,
        username: 'sara_m',
        fullName: 'سارا محمدی',
        balance: 150000,
        joinedAt: '1405/08/20',
        referralCount: 2,
        blocked: false,
      },
      {
        telegramId: 9001002,
        username: 'ali_k',
        fullName: 'علی کریمی',
        balance: 45000,
        joinedAt: '1405/08/22',
        referralCount: 0,
        inviterId: 9001001,
        referralBonusPaid: false,
        blocked: false,
      },
    ],
    orders: [
      {
        id: 1,
        telegramId: 9001001,
        clientEmail: 'sara.phone',
        inboundId: 1,
        inboundRemark: 'Germany · VLESS Reality',
        gb: 40,
        usedGb: 12.4,
        daysLeft: 22,
        subId: '8a94f1c2e3b04712',
        amountPaid: 300000,
        orderType: 'new',
        active: true,
        createdAt: '1405/08/20',
      },
      {
        id: 2,
        telegramId: 9001002,
        clientEmail: 'ali.laptop',
        inboundId: 2,
        inboundRemark: 'Finland · VLESS WS',
        gb: 50,
        usedGb: 18.2,
        daysLeft: 14,
        subId: '3d19a7f49c01e5b2',
        amountPaid: 375000,
        orderType: 'new',
        active: true,
        createdAt: '1405/08/22',
      },
    ],
    pendingReceipts: [
      {
        id: 101,
        telegramId: 9001002,
        amount: 200000,
        purpose: 'wallet',
        status: 'pending',
        createdAt: '1405/08/24 14:12',
        meta: {},
      },
    ],
    transactions: [
      {
        id: 1,
        telegramId: 9001001,
        amount: 450000,
        description: 'شارژ کیف پول (تایید رسید)',
        createdAt: '1405/08/20',
      },
      {
        id: 2,
        telegramId: 9001001,
        amount: -300000,
        description: 'خرید سرویس sara.phone (40GB)',
        createdAt: '1405/08/20',
      },
    ],
    broadcastLogs: [],
    features: {
      trialEnabled: true,
      trialGb: 0.5,
      trialDays: 1,
      referralEnabled: true,
      referralPercent: 5,
      reminderEnabled: true,
      reminderGbThreshold: 3,
      reminderDaysThreshold: 3,
      tutorials: {
        android: '۱. اپلیکیشن V2rayNG یا Hiddify را نصب کنید\n۲. لینک اشتراک را کپی کرده و Import from clipboard بزنید\n۳. اتصال را فعال کنید',
        ios: '۱. اپلیکیشن Streisand یا Hiddify را از App Store نصب کنید\n۲. لینک اشتراک را وارد و Update کنید',
        windows: '۱. نرم‌افزار Hiddify یا V2rayN را اجرا کنید\n۲. لینک اشتراک را در بخش Subscription ثبت کنید',
      },
    },
    nextOrderId: 3,
    nextTxId: 3,
    nextBroadcastId: 1,
  };
}

export function calculateTieredPrice(gb: number, pricing: PricingTiers): {
  perGb: number;
  total: number;
} {
  let perGb = pricing.high;
  if (gb < pricing.tier1Max) {
    perGb = pricing.low;
  } else if (gb <= pricing.tier2Max) {
    perGb = pricing.mid;
  }
  return { perGb, total: Math.round(gb * perGb) };
}

export function applyDiscount(total: number, percent: number): number {
  if (percent <= 0) return total;
  if (percent >= 100) return 0;
  return Math.max(1000, Math.round((total * (100 - percent)) / 100));
}

export function isValidServiceName(name: string): boolean {
  return /^[a-z0-9._%+\-@]{3,30}$/.test(name.trim().toLowerCase());
}

export function makeRandomSubId(seed?: number): string {
  const chars = '0123456789abcdef';
  if (typeof seed === 'number') {
    let out = '';
    for (let i = 0; i < 16; i++) {
      out += chars[(seed * 13 + i * 7 + 3) % chars.length];
    }
    return out;
  }
  let out = '';
  for (let i = 0; i < 16; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function buildSubUrl(subBaseUrl: string, subId: string): string {
  const clean = (subBaseUrl || 'https://sub.example.com/sub').trim().replace(/\/+$/, '');
  return `${clean}/${subId}`;
}

export function buildEnvFile(state: WebPanelState): string {
  const activeInbounds = state.inbounds.filter((ib) => ib.enabled);
  const effectiveInbounds = activeInbounds.length > 0 ? activeInbounds : state.inbounds;
  const primaryId = effectiveInbounds[0]?.id ?? 1;
  const inboundsStr = effectiveInbounds
    .map((ib) => `${ib.id}:${ib.remark.trim() || `inbound-${ib.id}`}:${ib.flow.trim()}`)
    .join(',');
  const cardsStr = state.cards
    .filter((c) => c.number.trim() !== '')
    .map((c) => `${c.number.trim()}:${c.name.trim()}`)
    .join(',');

  return [
    `BOT_TOKEN=${state.bot.botToken.trim()}`,
    `ADMIN_IDS=${state.bot.adminIds.trim()}`,
    `SUPPORT=${state.bot.support.trim()}`,
    `REQUIRED_CHANNEL_ID=${state.bot.requiredChannelId.trim() || '0'}`,
    `REQUIRED_CHANNEL_INVITE=${state.bot.requiredChannelInvite.trim()}`,
    `PANEL_URL=${state.panel.panelUrl.trim().replace(/\/+$/, '')}`,
    `PANEL_PATH=${state.panel.panelPath.trim().replace(/\/+$/, '')}`,
    `PANEL_API_TOKEN=${state.panel.panelApiToken.trim()}`,
    `INBOUND_ID=${primaryId}`,
    `INBOUNDS=${inboundsStr}`,
    `SUB_BASE_URL=${state.panel.subBaseUrl.trim().replace(/\/+$/, '')}`,
    `PROXY_HOST=${state.panel.proxyEnabled ? state.panel.proxyHost.trim() : ''}`,
    `PROXY_PORT=${state.panel.proxyEnabled ? state.panel.proxyPort.trim() : ''}`,
    `PROXY_USER=${state.panel.proxyEnabled ? state.panel.proxyUser.trim() : ''}`,
    `PROXY_PASS=${state.panel.proxyEnabled ? state.panel.proxyPass.trim() : ''}`,
    `CARDS=${cardsStr}`,
    `LOG_CHANNEL_ID=${state.bot.logChannelId.trim() || '0'}`,
    `REMINDER_ENABLED=${state.features.reminderEnabled ? 'y' : 'n'}`,
    `REMINDER_GB_THRESHOLD=${state.features.reminderGbThreshold}`,
    `REMINDER_DAYS_THRESHOLD=${state.features.reminderDaysThreshold}`,
    `WEB_PANEL_ENABLED=${state.bot.webPanelEnabled ? 'y' : 'n'}`,
    `WEB_PANEL_HOST=0.0.0.0`,
    `WEB_PANEL_PORT=${state.bot.webPanelPort}`,
    `WEB_PANEL_PASS=${state.bot.webPanelPass.trim()}`,
    `DB_PATH=vpn_bot.db`,
  ].join('\n') + '\n';
}

export function syncInboundsFromPanel(
  existing: InboundItem[],
  fetched: Array<{ id: number; remark: string; protocol: string; port: number; clientCount?: number }>
): InboundItem[] {
  const existingById = new Map(existing.map((item) => [item.id, item]));
  return fetched.map((ib) => {
    const prev = existingById.get(ib.id);
    return {
      id: ib.id,
      remark: ib.remark || prev?.remark || `inbound-${ib.id}`,
      protocol: ib.protocol || prev?.protocol || 'vless',
      port: ib.port || prev?.port || 443,
      flow: prev ? prev.flow : ib.protocol === 'vless' ? 'xtls-rprx-vision' : '',
      enabled: prev ? prev.enabled : true,
      clientCount: ib.clientCount ?? prev?.clientCount ?? 0,
    };
  });
}

export function adjustUserBalance(
  state: WebPanelState,
  telegramId: number,
  delta: number,
  description: string
): WebPanelState {
  if (!Number.isFinite(delta) || delta === 0) return state;
  const nowLabel = new Date().toLocaleDateString('fa-IR');
  const nextUsers = state.users.map((u) =>
    u.telegramId === telegramId ? { ...u, balance: Math.max(0, u.balance + Math.round(delta)) } : u
  );
  const tx: TransactionLog = {
    id: state.nextTxId,
    telegramId,
    amount: Math.round(delta),
    description: description.trim() || (delta > 0 ? 'افزایش موجودی توسط ادمین' : 'کسر موجودی توسط ادمین'),
    createdAt: nowLabel,
  };
  return {
    ...state,
    users: nextUsers,
    transactions: [tx, ...state.transactions].slice(0, 100),
    nextTxId: state.nextTxId + 1,
  };
}

export function toggleUserBlocked(state: WebPanelState, telegramId: number): WebPanelState {
  return {
    ...state,
    users: state.users.map((u) =>
      u.telegramId === telegramId ? { ...u, blocked: !u.blocked } : u
    ),
  };
}

export function createVpnConfig(
  state: WebPanelState,
  input: {
    telegramId: number;
    clientEmail: string;
    inboundId: number;
    gb: number;
    days: number;
    amountPaid?: number;
    deductWallet?: boolean;
    orderType?: 'new' | 'trial';
    subId?: string;
  }
): { ok: true; state: WebPanelState; order: VpnConfigOrder } | { ok: false; error: string } {
  const email = input.clientEmail.trim().toLowerCase();
  if (!isValidServiceName(email)) {
    return {
      ok: false,
      error: 'نام کانفیگ نامعتبر است (فقط حروف کوچک انگلیسی، اعداد و . - _ + @ بین ۳ تا ۳۰ کاراکتر).',
    };
  }
  if (state.orders.some((o) => o.clientEmail.toLowerCase() === email)) {
    return { ok: false, error: `سرویس با نام ${email} قبلاً ثبت شده است.` };
  }
  if (!Number.isFinite(input.gb) || input.gb <= 0) {
    return { ok: false, error: 'حجم سرویس باید بیشتر از صفر باشد.' };
  }
  const inbound = state.inbounds.find((ib) => ib.id === input.inboundId) ?? state.inbounds[0];
  if (!inbound) {
    return { ok: false, error: 'هیچ اینباندی تعریف نشده است.' };
  }

  const computedPrice =
    typeof input.amountPaid === 'number'
      ? Math.max(0, Math.round(input.amountPaid))
      : input.orderType === 'trial'
      ? 0
      : calculateTieredPrice(input.gb, state.pricing).total;

  if (input.deductWallet && computedPrice > 0) {
    const user = state.users.find((u) => u.telegramId === input.telegramId);
    if (!user) {
      return { ok: false, error: 'کاربر مورد نظر یافت نشد.' };
    }
    if (user.balance < computedPrice) {
      return { ok: false, error: 'موجودی کیف پول کاربر کافی نیست.' };
    }
  }

  const nowLabel = new Date().toLocaleDateString('fa-IR');
  const order: VpnConfigOrder = {
    id: state.nextOrderId,
    telegramId: input.telegramId,
    clientEmail: email,
    inboundId: inbound.id,
    inboundRemark: inbound.remark,
    gb: input.gb,
    usedGb: 0,
    daysLeft: Math.max(1, Math.round(input.days || 30)),
    subId: input.subId || makeRandomSubId(state.nextOrderId),
    amountPaid: computedPrice,
    orderType: input.orderType ?? 'new',
    active: true,
    createdAt: nowLabel,
  };

  let nextState: WebPanelState = {
    ...state,
    orders: [order, ...state.orders],
    nextOrderId: state.nextOrderId + 1,
  };

  if (input.deductWallet && computedPrice > 0) {
    nextState = adjustUserBalance(
      nextState,
      input.telegramId,
      -computedPrice,
      `ایجاد کانفیگ ${email} (${input.gb}GB)`
    );
  }

  return { ok: true, state: nextState, order };
}

export function renewVpnConfig(
  state: WebPanelState,
  clientEmail: string,
  addGb: number,
  addDays = 30
): WebPanelState {
  return {
    ...state,
    orders: state.orders.map((o) =>
      o.clientEmail === clientEmail
        ? { ...o, gb: o.gb + addGb, daysLeft: o.daysLeft + addDays, active: true }
        : o
    ),
  };
}

export function rotateVpnConfigLink(
  state: WebPanelState,
  clientEmail: string,
  newSubId?: string
): WebPanelState {
  const nextSub = newSubId || makeRandomSubId(Date.now());
  return {
    ...state,
    orders: state.orders.map((o) =>
      o.clientEmail === clientEmail ? { ...o, subId: nextSub } : o
    ),
  };
}

export function deleteVpnConfig(state: WebPanelState, clientEmail: string): WebPanelState {
  return {
    ...state,
    orders: state.orders.filter((o) => o.clientEmail !== clientEmail),
  };
}

export function approveReceipt(state: WebPanelState, receiptId: number): WebPanelState {
  const receipt = state.pendingReceipts.find((r) => r.id === receiptId);
  if (!receipt || receipt.status !== 'pending') return state;

  let nextState: WebPanelState = {
    ...state,
    pendingReceipts: state.pendingReceipts.map((r) =>
      r.id === receiptId ? { ...r, status: 'approved' as const } : r
    ),
  };

  if (receipt.purpose === 'wallet') {
    nextState = adjustUserBalance(
      nextState,
      receipt.telegramId,
      receipt.amount,
      `شارژ کیف پول (تایید رسید #${receiptId})`
    );
    const invitee = nextState.users.find((u) => u.telegramId === receipt.telegramId);
    if (
      nextState.features.referralEnabled &&
      invitee?.inviterId &&
      !invitee.referralBonusPaid
    ) {
      const bonus = Math.round((receipt.amount * nextState.features.referralPercent) / 100);
      if (bonus > 0) {
        nextState = adjustUserBalance(
          nextState,
          invitee.inviterId,
          bonus,
          `پاداش دعوت از کاربر ${receipt.telegramId}`
        );
        nextState = {
          ...nextState,
          users: nextState.users.map((u) =>
            u.telegramId === receipt.telegramId ? { ...u, referralBonusPaid: true } : u
          ),
        };
      }
    }
    return nextState;
  }

  if (receipt.purpose === 'purchase') {
    const gb = receipt.meta.gb ?? 30;
    const inboundId = receipt.meta.inboundId ?? nextState.inbounds[0]?.id ?? 1;
    const serviceName = receipt.meta.serviceName || `u${receipt.id}`;
    const created = createVpnConfig(nextState, {
      telegramId: receipt.telegramId,
      clientEmail: serviceName,
      inboundId,
      gb,
      days: 30,
      amountPaid: receipt.amount,
      deductWallet: false,
      orderType: 'new',
    });
    return created.ok ? created.state : nextState;
  }

  const email = receipt.meta.clientEmail ?? '';
  const gb = receipt.meta.gb ?? 20;
  return renewVpnConfig(nextState, email, gb, 30);
}

export function rejectReceipt(state: WebPanelState, receiptId: number): WebPanelState {
  const receipt = state.pendingReceipts.find((r) => r.id === receiptId);
  if (!receipt || receipt.status !== 'pending') return state;
  return {
    ...state,
    pendingReceipts: state.pendingReceipts.map((r) =>
      r.id === receiptId ? { ...r, status: 'rejected' as const } : r
    ),
  };
}

export function getBroadcastRecipients(
  state: WebPanelState,
  audience: 'all' | 'active_buyers'
): PanelUser[] {
  const unblocked = state.users.filter((u) => !u.blocked);
  if (audience === 'all') return unblocked;
  const activeOwners = new Set(state.orders.filter((o) => o.active).map((o) => o.telegramId));
  return unblocked.filter((u) => activeOwners.has(u.telegramId));
}
