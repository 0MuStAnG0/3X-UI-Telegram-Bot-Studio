export interface InboundConfig {
  id: number;
  remark: string;
  flow: string;
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

export interface BotConfig {
  botToken: string;
  adminIds: string;
  support: string;
  requiredChannelId: string;
  requiredChannelInvite: string;
  panelUrl: string;
  panelPath: string;
  panelApiToken: string;
  subBaseUrl: string;
  inbounds: InboundConfig[];
  proxyEnabled: boolean;
  proxyHost: string;
  proxyPort: string;
  proxyUser: string;
  proxyPass: string;
  cards: PaymentCard[];
  logChannelId: string;
  reminderEnabled: boolean;
  reminderGbThreshold: number;
  reminderDaysThreshold: number;
  webPanelEnabled: boolean;
  webPanelPort: number;
  webPanelPass: string;
  dbPath: string;
  botDir: string;
}

export const DEFAULT_BOT_CONFIG: BotConfig = {
  botToken: '7120491823:AAH_demo_token_for_3xui_bot',
  adminIds: '100100100',
  support: '@vpn_support',
  requiredChannelId: '0',
  requiredChannelInvite: '',
  panelUrl: 'https://de1.example.com:2053',
  panelPath: '/xui-secret',
  panelApiToken: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.3xui_api_token_demo',
  subBaseUrl: 'https://sub.example.com:2096/sub',
  inbounds: [
    { id: 1, remark: 'Germany · VLESS Reality', flow: 'xtls-rprx-vision' },
    { id: 2, remark: 'Finland · VLESS WS', flow: '' },
  ],
  proxyEnabled: true,
  proxyHost: '127.0.0.1',
  proxyPort: '10808',
  proxyUser: '',
  proxyPass: '',
  cards: [{ number: '6037-9911-4422-8810', name: 'علی رضایی' }],
  logChannelId: '-1001999888777',
  reminderEnabled: true,
  reminderGbThreshold: 3,
  reminderDaysThreshold: 3,
  webPanelEnabled: true,
  webPanelPort: 8080,
  webPanelPass: 'admin1234',
  dbPath: 'vpn_bot.db',
  botDir: '/opt/3xui-vpn-bot',
};

export const DEFAULT_PRICING: PricingTiers = {
  low: 8000,
  mid: 7500,
  high: 7000,
  tier1Max: 20,
  tier2Max: 60,
};

export function formatInboundsEnv(inbounds: InboundConfig[]): string {
  return inbounds
    .filter((i) => String(i.id).trim() !== '')
    .map((i) => `${i.id}:${i.remark.trim() || `inbound-${i.id}`}:${i.flow.trim()}`)
    .join(',');
}

export function formatCardsEnv(cards: PaymentCard[]): string {
  return cards
    .filter((c) => c.number.trim() !== '')
    .map((c) => `${c.number.trim()}:${c.name.trim()}`)
    .join(',');
}

export function generateEnvFile(config: BotConfig): string {
  const inboundId = config.inbounds[0]?.id ?? 1;
  const lines = [
    `BOT_TOKEN=${config.botToken.trim()}`,
    `ADMIN_IDS=${config.adminIds.trim()}`,
    `SUPPORT=${config.support.trim()}`,
    `REQUIRED_CHANNEL_ID=${config.requiredChannelId.trim() || '0'}`,
    `REQUIRED_CHANNEL_INVITE=${config.requiredChannelInvite.trim()}`,
    `PANEL_URL=${config.panelUrl.trim().replace(/\/+$/, '')}`,
    `PANEL_PATH=${config.panelPath.trim().replace(/\/+$/, '')}`,
    `PANEL_API_TOKEN=${config.panelApiToken.trim()}`,
    `INBOUND_ID=${inboundId}`,
    `INBOUNDS=${formatInboundsEnv(config.inbounds)}`,
    `SUB_BASE_URL=${config.subBaseUrl.trim().replace(/\/+$/, '')}`,
    `PROXY_HOST=${config.proxyEnabled ? config.proxyHost.trim() : ''}`,
    `PROXY_PORT=${config.proxyEnabled ? config.proxyPort.trim() : ''}`,
    `PROXY_USER=${config.proxyEnabled ? config.proxyUser.trim() : ''}`,
    `PROXY_PASS=${config.proxyEnabled ? config.proxyPass.trim() : ''}`,
    `CARDS=${formatCardsEnv(config.cards)}`,
    `LOG_CHANNEL_ID=${config.logChannelId.trim() || '0'}`,
    `REMINDER_ENABLED=${config.reminderEnabled ? 'y' : 'n'}`,
    `REMINDER_GB_THRESHOLD=${config.reminderGbThreshold}`,
    `REMINDER_DAYS_THRESHOLD=${config.reminderDaysThreshold}`,
    `WEB_PANEL_ENABLED=${config.webPanelEnabled ? 'y' : 'n'}`,
    `WEB_PANEL_HOST=0.0.0.0`,
    `WEB_PANEL_PORT=${config.webPanelPort}`,
    `WEB_PANEL_PASS=${config.webPanelPass.trim()}`,
    `DB_PATH=${config.dbPath.trim() || 'vpn_bot.db'}`,
  ];
  return lines.join('\n') + '\n';
}

export function generateSystemdUnit(botDir: string): string {
  const cleanDir = (botDir || '/opt/3xui-vpn-bot').trim().replace(/\/+$/, '');
  return `[Unit]
Description=3X-UI VPN Telegram Bot (aiogram 3.x)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=${cleanDir}
ExecStart=${cleanDir}/.venv/bin/python3 main.py
Restart=always
RestartSec=5
KillSignal=SIGINT
TimeoutStopSec=15
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
`;
}

export function calculateTieredPrice(gb: number, pricing: PricingTiers = DEFAULT_PRICING): {
  perGb: number;
  total: number;
} {
  let perGb = pricing.high;
  if (gb < pricing.tier1Max) {
    perGb = pricing.low;
  } else if (gb <= pricing.tier2Max) {
    perGb = pricing.mid;
  }
  return { perGb, total: gb * perGb };
}

export function applyDiscountAmount(total: number, percent: number): number {
  if (percent <= 0) return total;
  return Math.max(1000, Math.round((total * (100 - percent)) / 100));
}

export function isValidServiceName(name: string): boolean {
  return /^[a-z0-9._%+\-@]{3,30}$/.test(name.trim().toLowerCase());
}

export interface SimInlineButton {
  label: string;
  action: string;
}

export interface SimMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
  buttons?: SimInlineButton[];
  qrPayload?: string;
}

export interface SimOrder {
  id: number;
  clientEmail: string;
  inboundId: number;
  inboundRemark: string;
  gb: number;
  usedGb: number;
  daysLeft: number;
  subId: string;
  amountPaid: number;
  active: boolean;
}

export interface SimPendingPayment {
  id: number;
  telegramId: number;
  amount: number;
  purpose: 'wallet' | 'purchase' | 'renew';
  status: 'pending' | 'approved' | 'rejected';
  meta: {
    gb?: number;
    serviceName?: string;
    inboundId?: number;
    inboundRemark?: string;
    clientEmail?: string;
  };
}

export interface SimDiscountCode {
  code: string;
  percent: number;
  maxUses: number;
  usedCount: number;
}

export interface ApiTraceEntry {
  id: string;
  method: 'GET' | 'POST';
  endpoint: string;
  viaProxy: string;
  status: number;
  summary: string;
}

export type SimStep =
  | 'idle'
  | 'buy_server'
  | 'buy_gb'
  | 'buy_name'
  | 'buy_confirm'
  | 'buy_discount'
  | 'buy_receipt'
  | 'wallet_amount'
  | 'wallet_receipt'
  | 'renew_gb'
  | 'renew_confirm'
  | 'renew_receipt';

export interface BotSimState {
  step: SimStep;
  walletBalance: number;
  trialUsed: boolean;
  trialEnabled: boolean;
  referralEnabled: boolean;
  referralCount: number;
  pricing: PricingTiers;
  orders: SimOrder[];
  pendingPayments: SimPendingPayment[];
  discountCodes: SimDiscountCode[];
  usedDiscounts: string[];
  messages: SimMessage[];
  apiTraces: ApiTraceEntry[];
  draft: {
    inboundId?: number;
    inboundRemark?: string;
    gb?: number;
    serviceName?: string;
    total?: number;
    discountPercent?: number;
    discountCode?: string;
    shortfall?: number;
    topupAmount?: number;
    renewEmail?: string;
  };
  nextOrderId: number;
  nextPaymentId: number;
}

function nowTime(): string {
  return '14:38';
}

function randomHex(len = 16): string {
  const chars = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[(i * 7 + 5) % chars.length];
  }
  return out;
}

export function createInitialSimState(config: BotConfig = DEFAULT_BOT_CONFIG): BotSimState {
  return {
    step: 'idle',
    walletBalance: 150000,
    trialUsed: false,
    trialEnabled: true,
    referralEnabled: true,
    referralCount: 2,
    pricing: { ...DEFAULT_PRICING },
    orders: [
      {
        id: 1,
        clientEmail: 'sara.phone',
        inboundId: config.inbounds[0]?.id ?? 1,
        inboundRemark: config.inbounds[0]?.remark ?? 'Germany · VLESS Reality',
        gb: 40,
        usedGb: 12.4,
        daysLeft: 22,
        subId: '8a94f1c2e3b04712',
        amountPaid: 300000,
        active: true,
      },
    ],
    pendingPayments: [],
    discountCodes: [
      { code: 'SALE20', percent: 20, maxUses: 100, usedCount: 4 },
      { code: 'VIP10', percent: 10, maxUses: 50, usedCount: 1 },
    ],
    usedDiscounts: [],
    apiTraces: [
      {
        id: 't-init',
        method: 'GET',
        endpoint: `${config.panelPath}/panel/api/inbounds/list`,
        viaProxy: config.proxyEnabled ? `SOCKS5 ${config.proxyHost}:${config.proxyPort}` : 'Direct',
        status: 200,
        summary: `Bearer Token احراز هویت شد (${config.inbounds.length} اینباند فعال)`,
      },
    ],
    messages: [
      {
        id: 'm-1',
        sender: 'bot',
        timestamp: nowTime(),
        text: 'سلام کاربر عزیز! 👋\nبه ربات فروش و مدیریت 3X-UI خوش آمدید.\nاز منوی ساده زیر گزینه مورد نظر خود را انتخاب کنید:',
      },
    ],
    draft: {},
    nextOrderId: 2,
    nextPaymentId: 101,
  };
}

function pushMsg(
  state: BotSimState,
  sender: 'bot' | 'user',
  text: string,
  buttons?: SimInlineButton[],
  qrPayload?: string
): BotMessageListUpdate {
  return {
    messages: [
      ...state.messages,
      {
        id: `m-${state.messages.length + 1}-${sender}`,
        sender,
        text,
        timestamp: nowTime(),
        buttons,
        qrPayload,
      },
    ],
  };
}

type BotMessageListUpdate = { messages: SimMessage[] };

function makeTrace(
  config: BotConfig,
  method: 'GET' | 'POST',
  path: string,
  summary: string
): ApiTraceEntry {
  return {
    id: `t-${Math.random().toString(36).slice(2, 8)}`,
    method,
    endpoint: `${config.panelPath}${path}`,
    viaProxy: config.proxyEnabled ? `SOCKS5 ${config.proxyHost}:${config.proxyPort}` : 'Direct',
    status: 200,
    summary,
  };
}

export function handleBotAction(
  state: BotSimState,
  action: string,
  config: BotConfig = DEFAULT_BOT_CONFIG
): BotSimState {
  if (action === 'menu:buy' || action === '🛒 خرید سرویس') {
    const withUser = { ...state, ...pushMsg(state, 'user', '🛒 خرید سرویس'), draft: {} };
    if (config.inbounds.length > 1) {
      return {
        ...withUser,
        step: 'buy_server',
        ...pushMsg(
          withUser,
          'bot',
          '🌍 سرور (Inbound) مورد نظر خود را انتخاب کنید:',
          config.inbounds.map((ib) => ({
            label: `🌍 ${ib.remark}`,
            action: `pick_inbound:${ib.id}`,
          }))
        ),
      };
    }
    const defaultIb = config.inbounds[0] ?? { id: 1, remark: 'Default', flow: '' };
    return {
      ...withUser,
      step: 'buy_gb',
      draft: { inboundId: defaultIb.id, inboundRemark: defaultIb.remark },
      ...pushMsg(
        withUser,
        'bot',
        '📦 چند گیگابایت سرویس می‌خواهید؟\nمدت تمام سرویس‌ها ۳۰ روز است. عدد حجم را وارد کنید (مثلاً 30):',
        [{ label: '🔙 بازگشت', action: 'back_main' }]
      ),
    };
  }

  if (action.startsWith('pick_inbound:')) {
    const ibId = Number(action.split(':')[1]);
    const ib = config.inbounds.find((x) => x.id === ibId) ?? config.inbounds[0];
    const withUser = { ...state, ...pushMsg(state, 'user', `🌍 ${ib.remark}`) };
    return {
      ...withUser,
      step: 'buy_gb',
      draft: { inboundId: ib.id, inboundRemark: ib.remark },
      ...pushMsg(
        withUser,
        'bot',
        `سرور «${ib.remark}» انتخاب شد.\n\n📦 چند گیگابایت سرویس می‌خواهید؟ (مثلاً 30):`,
        [{ label: '🔙 بازگشت', action: 'back_main' }]
      ),
    };
  }

  if (action === 'enter_discount') {
    return {
      ...state,
      step: 'buy_discount',
      ...pushMsg(state, 'bot', '🏷 کد تخفیف خود را وارد کنید (کد نمونه: SALE20):', [
        { label: '🔙 بازگشت', action: 'back_main' },
      ]),
    };
  }

  if (action === 'buy_confirm') {
    const total = state.draft.total ?? 0;
    const gb = state.draft.gb ?? 0;
    const name = state.draft.serviceName ?? 'user.vpn';
    const inboundId = state.draft.inboundId ?? 1;
    const inboundRemark = state.draft.inboundRemark ?? 'Default';

    if (state.walletBalance >= total) {
      const subId = randomHex(16);
      const subUrl = `${config.subBaseUrl.replace(/\/+$/, '')}/${subId}`;
      const newOrder: SimOrder = {
        id: state.nextOrderId,
        clientEmail: name,
        inboundId,
        inboundRemark,
        gb,
        usedGb: 0,
        daysLeft: 30,
        subId,
        amountPaid: total,
        active: true,
      };
      const trace = makeTrace(
        config,
        'POST',
        '/panel/api/clients/add',
        `کلاینت ${name} (${gb}GB) در اینباند ${inboundId} با Bearer Token ساخته شد`
      );
      return {
        ...state,
        step: 'idle',
        walletBalance: state.walletBalance - total,
        orders: [newOrder, ...state.orders],
        nextOrderId: state.nextOrderId + 1,
        draft: {},
        apiTraces: [trace, ...state.apiTraces].slice(0, 12),
        ...pushMsg(
          state,
          'bot',
          `🎉 سرویس شما آماده است!\n\n📝 نام سرویس: ${name}\n🌍 سرور: ${inboundRemark}\n📦 حجم: ${gb} گیگابایت\n📅 مدت: ۳۰ روز\n\n🔗 لینک اشتراک:\n${subUrl}`,
          [{ label: '📋 مشاهده در سرویس‌های من', action: `view:${name}` }],
          subUrl
        ),
      };
    }

    const shortfall = total - state.walletBalance;
    const cardsText = config.cards.map((c) => `${c.number} (${c.name})`).join('\n');
    return {
      ...state,
      step: 'buy_receipt',
      draft: { ...state.draft, shortfall },
      ...pushMsg(
        state,
        'bot',
        `💳 موجودی کیف پول (${state.walletBalance.toLocaleString('fa-IR')} تومان) کافی نیست.\nمبلغ کسری: ${shortfall.toLocaleString('fa-IR')} تومان\n\nبه کارت زیر واریز و دکمه ارسال رسید را بزنید:\n${cardsText}`,
        [
          { label: '📷 ارسال رسید نمونه', action: 'send_sample_receipt:purchase' },
          { label: '❌ انصراف', action: 'back_main' },
        ]
      ),
    };
  }

  if (action.startsWith('send_sample_receipt:')) {
    const purpose = action.split(':')[1] as 'wallet' | 'purchase' | 'renew';
    const pid = state.nextPaymentId;
    let amount = 100000;
    const meta: SimPendingPayment['meta'] = {};
    if (purpose === 'wallet') {
      amount = state.draft.topupAmount ?? 100000;
    } else if (purpose === 'purchase') {
      amount = state.draft.shortfall ?? state.draft.total ?? 100000;
      meta.gb = state.draft.gb;
      meta.serviceName = state.draft.serviceName;
      meta.inboundId = state.draft.inboundId;
      meta.inboundRemark = state.draft.inboundRemark;
    } else if (purpose === 'renew') {
      amount = state.draft.shortfall ?? state.draft.total ?? 100000;
      meta.gb = state.draft.gb;
      meta.clientEmail = state.draft.renewEmail;
    }

    const pending: SimPendingPayment = {
      id: pid,
      telegramId: 900100,
      amount,
      purpose,
      status: 'pending',
      meta,
    };
    const withUser = { ...state, ...pushMsg(state, 'user', '📷 [تصویر رسید واریز ارسال شد]') };
    return {
      ...withUser,
      step: 'idle',
      draft: {},
      pendingPayments: [pending, ...withUser.pendingPayments],
      nextPaymentId: pid + 1,
      ...pushMsg(
        withUser,
        'bot',
        `✅ رسید با شناسه #${pid} ثبت و برای ادمین ارسال شد.\nاز تب «حالت ادمین» می‌توانید تایید یا رد آن را تست کنید.`
      ),
    };
  }

  if (action === 'menu:services' || action === '📋 سرویس های من') {
    const withUser = { ...state, step: 'idle' as SimStep, ...pushMsg(state, 'user', '📋 سرویس های من') };
    if (withUser.orders.length === 0) {
      return {
        ...withUser,
        ...pushMsg(withUser, 'bot', '📭 شما هنوز سرویسی ندارید. از بخش خرید سرویس اقدام کنید.'),
      };
    }
    return {
      ...withUser,
      ...pushMsg(
        withUser,
        'bot',
        '📋 لیست سرویس‌های فعال شما:',
        withUser.orders.map((o) => ({
          label: `🔑 ${o.clientEmail} (${o.gb}GB)`,
          action: `view:${o.clientEmail}`,
        }))
      ),
    };
  }

  if (action.startsWith('view:')) {
    const email = action.split(':')[1];
    const order = state.orders.find((o) => o.clientEmail === email);
    if (!order) return state;
    const remGb = Math.max(0, Number((order.gb - order.usedGb).toFixed(2)));
    const subUrl = `${config.subBaseUrl.replace(/\/+$/, '')}/${order.subId}`;
    const trace = makeTrace(config, 'GET', `/panel/api/clients/get/${email}`, `وضعیت و ترافیک ${email} دریافت شد`);
    return {
      ...state,
      apiTraces: [trace, ...state.apiTraces].slice(0, 12),
      ...pushMsg(
        state,
        'bot',
        `🔑 جزئیات سرویس ${email}\n\n🌍 سرور: ${order.inboundRemark}\n📊 وضعیت: ${order.active ? '✅ فعال' : '⛔️ غیرفعال'}\n📦 حجم کل: ${order.gb} GB\n📈 مصرف شده: ${order.usedGb} GB\n💾 باقی‌مانده: ${remGb} GB\n⏳ زمان باقی‌مانده: ${order.daysLeft} روز\n\n🔗 لینک اشتراک:\n${subUrl}`,
        [
          { label: '🔄 تغییر لینک اتصال', action: `chlink:${email}` },
          { label: '🔁 تمدید سرویس', action: `renew:${email}` },
          { label: '🔙 بازگشت به لیست', action: 'menu:services' },
        ],
        subUrl
      ),
    };
  }

  if (action.startsWith('chlink:')) {
    const email = action.split(':')[1];
    const newSub = randomHex(16);
    const updatedOrders = state.orders.map((o) => (o.clientEmail === email ? { ...o, subId: newSub } : o));
    const subUrl = `${config.subBaseUrl.replace(/\/+$/, '')}/${newSub}`;
    const trace = makeTrace(
      config,
      'POST',
      `/panel/api/clients/update/${email}`,
      `UUID و subId سرویس ${email} با موفقیت چرخش یافت`
    );
    return {
      ...state,
      orders: updatedOrders,
      apiTraces: [trace, ...state.apiTraces].slice(0, 12),
      ...pushMsg(state, 'bot', `✅ لینک اتصال ${email} تغییر کرد!\n\n🔗 لینک جدید:\n${subUrl}`, undefined, subUrl),
    };
  }

  if (action.startsWith('renew:')) {
    const email = action.split(':')[1];
    return {
      ...state,
      step: 'renew_gb',
      draft: { renewEmail: email },
      ...pushMsg(state, 'bot', `🔁 تمدید سرویس ${email}\nچند گیگابایت اضافه شود؟ (مثلاً 20):`, [
        { label: '🔙 انصراف', action: 'back_main' },
      ]),
    };
  }

  if (action === 'renew_confirm') {
    const email = state.draft.renewEmail ?? '';
    const gb = state.draft.gb ?? 0;
    const total = state.draft.total ?? 0;
    if (state.walletBalance >= total) {
      const updatedOrders = state.orders.map((o) =>
        o.clientEmail === email ? { ...o, gb: o.gb + gb, daysLeft: 30 } : o
      );
      const trace = makeTrace(config, 'POST', `/panel/api/clients/update/${email}`, `افزودن ${gb}GB و +۳۰ روز اعتبار`);
      return {
        ...state,
        step: 'idle',
        walletBalance: state.walletBalance - total,
        orders: updatedOrders,
        draft: {},
        apiTraces: [trace, ...state.apiTraces].slice(0, 12),
        ...pushMsg(state, 'bot', `✅ سرویس ${email} تمدید شد!\n📦 +${gb} GB اضافه شد\n📅 ۳۰ روز تمدید شد`),
      };
    }
    const shortfall = total - state.walletBalance;
    return {
      ...state,
      step: 'renew_receipt',
      draft: { ...state.draft, shortfall },
      ...pushMsg(
        state,
        'bot',
        `💳 موجودی کافی نیست. کمبود: ${shortfall.toLocaleString('fa-IR')} تومان.`,
        [
          { label: '📷 ارسال رسید نمونه', action: 'send_sample_receipt:renew' },
          { label: '❌ انصراف', action: 'back_main' },
        ]
      ),
    };
  }

  if (action === 'menu:wallet' || action === '💳 کیف پول') {
    const withUser = { ...state, step: 'idle' as SimStep, ...pushMsg(state, 'user', '💳 کیف پول') };
    return {
      ...withUser,
      ...pushMsg(
        withUser,
        'bot',
        `💳 کیف پول شما\n\nموجودی فعلی: ${withUser.walletBalance.toLocaleString('fa-IR')} تومان`,
        [{ label: '➕ شارژ کیف پول', action: 'wallet_topup' }]
      ),
    };
  }

  if (action === 'wallet_topup') {
    return {
      ...state,
      step: 'wallet_amount',
      ...pushMsg(state, 'bot', '💰 مبلغ شارژ را به تومان وارد کنید (مثلاً 200000):', [
        { label: '🔙 انصراف', action: 'back_main' },
      ]),
    };
  }

  if (action === 'menu:trial' || action === '🎁 تست رایگان') {
    const withUser = { ...state, step: 'idle' as SimStep, ...pushMsg(state, 'user', '🎁 تست رایگان') };
    if (!withUser.trialEnabled) {
      return { ...withUser, ...pushMsg(withUser, 'bot', '❌ تست رایگان در حال حاضر توسط ادمین غیرفعال شده است.') };
    }
    if (withUser.trialUsed) {
      return {
        ...withUser,
        ...pushMsg(withUser, 'bot', '⚠️ شما قبلاً از تست رایگان استفاده کرده‌اید (محدود به ۱ بار برای هر کاربر).'),
      };
    }
    const email = `trial.${randomHex(6)}`;
    const subId = randomHex(16);
    const subUrl = `${config.subBaseUrl.replace(/\/+$/, '')}/${subId}`;
    const trialOrder: SimOrder = {
      id: withUser.nextOrderId,
      clientEmail: email,
      inboundId: config.inbounds[0]?.id ?? 1,
      inboundRemark: config.inbounds[0]?.remark ?? 'Default',
      gb: 0.5,
      usedGb: 0,
      daysLeft: 1,
      subId,
      amountPaid: 0,
      active: true,
    };
    const trace = makeTrace(config, 'POST', '/panel/api/clients/add', `سرویس تست رایگان 0.5GB ساخته شد`);
    return {
      ...withUser,
      trialUsed: true,
      orders: [trialOrder, ...withUser.orders],
      nextOrderId: withUser.nextOrderId + 1,
      apiTraces: [trace, ...withUser.apiTraces].slice(0, 12),
      ...pushMsg(
        withUser,
        'bot',
        `🎁 سرویس تست رایگان آماده است!\n\n📦 حجم: 0.5 گیگابایت\n📅 مدت: ۱ روز\n\n🔗 لینک اشتراک:\n${subUrl}`,
        undefined,
        subUrl
      ),
    };
  }

  if (action === 'menu:tutorials' || action === '📚 آموزش اتصال') {
    const withUser = { ...state, step: 'idle' as SimStep, ...pushMsg(state, 'user', '📚 آموزش اتصال') };
    return {
      ...withUser,
      ...pushMsg(withUser, 'bot', '📚 سیستم‌عامل خود را برای مشاهده راهنمای اتصال انتخاب کنید:', [
        { label: '🤖 اندروید (V2rayNG / Hiddify)', action: 'tut:android' },
        { label: '🍎 iOS (Streisand / V2Box)', action: 'tut:ios' },
        { label: '🪟 ویندوز (Hiddify / V2rayN)', action: 'tut:windows' },
      ]),
    };
  }

  if (action.startsWith('tut:')) {
    const os = action.split(':')[1];
    const map: Record<string, string> = {
      android: '🤖 آموزش اندروید:\n۱. اپلیکیشن V2rayNG یا Hiddify را نصب کنید\n۲. لینک اشتراک را از بخش سرویس‌ها کپی کنید\n۳. با گزینه Import from clipboard وارد کرده و متصل شوید ✅',
      ios: '🍎 آموزش آیفون (iOS):\n۱. اپ Streisand یا Hiddify را از App Store نصب کنید\n۲. لینک اشتراک را کپی و در برنامه Add/Import کنید\n۳. دکمه اتصال را بزنید ✅',
      windows: '🪟 آموزش ویندوز:\n۱. برنامه Hiddify یا V2rayN را اجرا کنید\n۲. لینک اشتراک را در بخش Subscription وارد و Update بزنید\n۳. اتصال را فعال کنید ✅',
    };
    return {
      ...state,
      ...pushMsg(state, 'bot', map[os] ?? map.android),
    };
  }

  if (action === 'menu:referral' || action === '🔗 دعوت دوستان') {
    const withUser = { ...state, step: 'idle' as SimStep, ...pushMsg(state, 'user', '🔗 دعوت دوستان') };
    return {
      ...withUser,
      ...pushMsg(
        withUser,
        'bot',
        `🔗 لینک دعوت اختصاصی شما:\nhttps://t.me/my_3xui_bot?start=ref900100\n\n👥 تعداد دعوت‌شدگان: ${withUser.referralCount} نفر\n💡 با اولین شارژ هر دعوت‌شده، ۵٪ پاداش به کیف پول شما اضافه می‌شود.`
      ),
    };
  }

  if (action === 'menu:support' || action === '💬 پشتیبانی') {
    const withUser = { ...state, step: 'idle' as SimStep, ...pushMsg(state, 'user', '💬 پشتیبانی') };
    return {
      ...withUser,
      ...pushMsg(withUser, 'bot', `💬 برای ارتباط مستقیم با پشتیبانی به ${config.support} پیام دهید.`),
    };
  }

  if (action === 'back_main') {
    return {
      ...state,
      step: 'idle',
      draft: {},
      ...pushMsg(state, 'bot', 'بازگشت به منوی اصلی. گزینه مورد نظر را انتخاب کنید:'),
    };
  }

  return state;
}

export function handleBotTextInput(
  state: BotSimState,
  rawText: string,
  config: BotConfig = DEFAULT_BOT_CONFIG
): BotSimState {
  const text = rawText.trim();
  if (!text) return state;

  if (text.startsWith('/')) {
    return handleAdminCommand(state, text, config);
  }

  if (
    [
      '🛒 خرید سرویس',
      '📋 سرویس های من',
      '💳 کیف پول',
      '🎁 تست رایگان',
      '📚 آموزش اتصال',
      '🔗 دعوت دوستان',
      '💬 پشتیبانی',
    ].includes(text)
  ) {
    return handleBotAction(state, text, config);
  }

  const withUser = { ...state, ...pushMsg(state, 'user', text) };

  if (state.step === 'buy_gb') {
    const gb = Number(text);
    if (!Number.isInteger(gb) || gb <= 0) {
      return {
        ...withUser,
        ...pushMsg(withUser, 'bot', '❌ لطفاً فقط عدد صحیح مثبت وارد کنید (مثلاً 30).'),
      };
    }
    const { total } = calculateTieredPrice(gb, state.pricing);
    return {
      ...withUser,
      step: 'buy_name',
      draft: { ...withUser.draft, gb, total, discountPercent: 0 },
      ...pushMsg(
        withUser,
        'bot',
        '✏️ یک نام برای سرویس انتخاب کنید (حروف کوچک انگلیسی، اعداد و . - _ ، ۳ تا ۳۰ کاراکتر؛ مثال: ali.reza):'
      ),
    };
  }

  if (state.step === 'buy_name') {
    const normalized = text.toLowerCase();
    if (!isValidServiceName(normalized)) {
      return {
        ...withUser,
        ...pushMsg(
          withUser,
          'bot',
          '❌ نام نامعتبر است. فقط حروف کوچک انگلیسی، اعداد و . - _ + @ مجاز است (۳ تا ۳۰ کاراکتر).'
        ),
      };
    }
    if (state.orders.some((o) => o.clientEmail === normalized)) {
      return {
        ...withUser,
        ...pushMsg(withUser, 'bot', `❌ نام ${normalized} قبلاً ثبت شده است. نام دیگری وارد کنید.`),
      };
    }
    const gb = state.draft.gb ?? 30;
    const { perGb, total } = calculateTieredPrice(gb, state.pricing);
    return {
      ...withUser,
      step: 'buy_confirm',
      draft: { ...withUser.draft, serviceName: normalized, total },
      ...pushMsg(
        withUser,
        'bot',
        `🛒 جزئیات سفارش\n\n📝 نام سرویس: ${normalized}\n🌍 سرور: ${state.draft.inboundRemark ?? 'Default'}\n📦 حجم: ${gb} گیگابایت\n💰 قیمت هر گیگ: ${perGb.toLocaleString('fa-IR')} تومان\n🧾 مبلغ کل: ${total.toLocaleString('fa-IR')} تومان\n📅 مدت: ۳۰ روز`,
        [
          { label: '🏷 دارم کد تخفیف', action: 'enter_discount' },
          { label: '✅ تایید و پرداخت', action: 'buy_confirm' },
          { label: '❌ انصراف', action: 'back_main' },
        ]
      ),
    };
  }

  if (state.step === 'buy_discount') {
    const code = text.toUpperCase();
    const found = state.discountCodes.find((c) => c.code === code && c.usedCount < c.maxUses);
    if (!found) {
      return {
        ...withUser,
        ...pushMsg(withUser, 'bot', '❌ کد تخفیف نامعتبر یا منقضی است. کد دیگری بزنید یا تایید کنید:', [
          { label: '✅ ادامه بدون تخفیف', action: 'buy_confirm' },
          { label: '❌ انصراف', action: 'back_main' },
        ]),
      };
    }
    if (state.usedDiscounts.includes(code)) {
      return {
        ...withUser,
        ...pushMsg(withUser, 'bot', '❌ شما قبلاً از این کد تخفیف استفاده کرده‌اید.'),
      };
    }
    const orig = state.draft.total ?? 0;
    const discounted = applyDiscountAmount(orig, found.percent);
    return {
      ...withUser,
      step: 'buy_confirm',
      usedDiscounts: [...state.usedDiscounts, code],
      discountCodes: state.discountCodes.map((c) =>
        c.code === code ? { ...c, usedCount: c.usedCount + 1 } : c
      ),
      draft: {
        ...withUser.draft,
        total: discounted,
        discountPercent: found.percent,
        discountCode: code,
      },
      ...pushMsg(
        withUser,
        'bot',
        `✅ کد تخفیف ${code} (${found.percent}٪) اعمال شد!\n💳 مبلغ نهایی: ${discounted.toLocaleString('fa-IR')} تومان`,
        [
          { label: '✅ تایید و پرداخت', action: 'buy_confirm' },
          { label: '❌ انصراف', action: 'back_main' },
        ]
      ),
    };
  }

  if (state.step === 'wallet_amount') {
    const amount = Number(text);
    if (!Number.isInteger(amount) || amount <= 0) {
      return {
        ...withUser,
        ...pushMsg(withUser, 'bot', '❌ لطفاً مبلغ را به صورت عدد صحیح مثبت وارد کنید.'),
      };
    }
    const cardsText = config.cards.map((c) => `${c.number} (${c.name})`).join('\n');
    return {
      ...withUser,
      step: 'wallet_receipt',
      draft: { topupAmount: amount },
      ...pushMsg(
        withUser,
        'bot',
        `💳 لطفاً ${amount.toLocaleString('fa-IR')} تومان به کارت زیر واریز و رسید ارسال کنید:\n${cardsText}`,
        [
          { label: '📷 ارسال رسید نمونه', action: 'send_sample_receipt:wallet' },
          { label: '❌ انصراف', action: 'back_main' },
        ]
      ),
    };
  }

  if (state.step === 'renew_gb') {
    const gb = Number(text);
    if (!Number.isInteger(gb) || gb <= 0) {
      return {
        ...withUser,
        ...pushMsg(withUser, 'bot', '❌ لطفاً عدد صحیح مثبت وارد کنید.'),
      };
    }
    const { total } = calculateTieredPrice(gb, state.pricing);
    return {
      ...withUser,
      step: 'renew_confirm',
      draft: { ...withUser.draft, gb, total },
      ...pushMsg(
        withUser,
        'bot',
        `🔁 تمدید سرویس ${state.draft.renewEmail}\n📦 حجم اضافه: ${gb} گیگابایت\n🧾 مبلغ: ${total.toLocaleString('fa-IR')} تومان\n\nتایید می‌کنید؟`,
        [
          { label: '✅ تایید تمدید', action: 'renew_confirm' },
          { label: '❌ انصراف', action: 'back_main' },
        ]
      ),
    };
  }

  return {
    ...withUser,
    ...pushMsg(withUser, 'bot', 'لطفاً از دکمه‌های منوی پایین برای کار با ربات استفاده کنید.'),
  };
}

export function handleAdminCommand(
  state: BotSimState,
  rawCmd: string,
  _config: BotConfig = DEFAULT_BOT_CONFIG
): BotSimState {
  const parts = rawCmd.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const withUser = { ...state, ...pushMsg(state, 'user', rawCmd.trim()) };

  if (cmd === '/start') {
    return {
      ...withUser,
      step: 'idle',
      draft: {},
      ...pushMsg(withUser, 'bot', 'سلام! 👋 به ربات مدیریت و فروش 3X-UI خوش آمدید.'),
    };
  }

  if (cmd === '/stats') {
    const totalRevenue = withUser.orders.reduce((acc, o) => acc + o.amountPaid, 0);
    const pendingCount = withUser.pendingPayments.filter((p) => p.status === 'pending').length;
    return {
      ...withUser,
      ...pushMsg(
        withUser,
        'bot',
        `📊 آمار لحظه‌ای ربات\n\n🛒 کل سفارشات: ${withUser.orders.length}\n💰 درآمد کل: ${totalRevenue.toLocaleString('fa-IR')} تومان\n💳 موجودی کیف پول: ${withUser.walletBalance.toLocaleString('fa-IR')} تومان\n⏳ پرداخت معلق: ${pendingCount}\n🎁 تست رایگان: ${withUser.trialEnabled ? 'فعال' : 'غیرفعال'} | 🔗 دعوت: ${withUser.referralEnabled ? 'فعال' : 'غیرفعال'}`
      ),
    };
  }

  if (cmd === '/trial') {
    const next = !withUser.trialEnabled;
    return {
      ...withUser,
      trialEnabled: next,
      ...pushMsg(withUser, 'bot', `🎁 سیستم تست رایگان ${next ? '✅ فعال' : '❌ غیرفعال'} شد.`),
    };
  }

  if (cmd === '/referral') {
    const next = !withUser.referralEnabled;
    return {
      ...withUser,
      referralEnabled: next,
      ...pushMsg(withUser, 'bot', `🔗 سیستم دعوت دوستان ${next ? '✅ فعال' : '❌ غیرفعال'} شد.`),
    };
  }

  if (cmd === '/codes') {
    const text = withUser.discountCodes
      .map((c) => `🏷 ${c.code} — ${c.percent}% (${c.usedCount}/${c.maxUses})`)
      .join('\n');
    return {
      ...withUser,
      ...pushMsg(withUser, 'bot', `📋 کدهای تخفیف:\n${text || 'خالی'}`),
    };
  }

  if (cmd === '/addcode' && parts.length === 4) {
    const code = parts[1].toUpperCase();
    const percent = Number(parts[2]);
    const maxUses = Number(parts[3]);
    if (!Number.isInteger(percent) || !Number.isInteger(maxUses)) {
      return { ...withUser, ...pushMsg(withUser, 'bot', '❌ درصد و تعداد باید عدد صحیح باشد.') };
    }
    return {
      ...withUser,
      discountCodes: [{ code, percent, maxUses, usedCount: 0 }, ...withUser.discountCodes],
      ...pushMsg(withUser, 'bot', `✅ کد تخفیف ${code} با ${percent}% تخفیف ساخته شد.`),
    };
  }

  return {
    ...withUser,
    ...pushMsg(
      withUser,
      'bot',
      'دستورات ادمین: /stats · /codes · /addcode CODE 20 100 · /trial · /referral'
    ),
  };
}

export function approvePendingPayment(
  state: BotSimState,
  paymentId: number,
  config: BotConfig = DEFAULT_BOT_CONFIG
): BotSimState {
  const payment = state.pendingPayments.find((p) => p.id === paymentId);
  if (!payment || payment.status !== 'pending') return state;

  const updatedPending = state.pendingPayments.map((p) =>
    p.id === paymentId ? { ...p, status: 'approved' as const } : p
  );

  if (payment.purpose === 'wallet') {
    const newBal = state.walletBalance + payment.amount;
    return {
      ...state,
      walletBalance: newBal,
      pendingPayments: updatedPending,
      ...pushMsg(
        state,
        'bot',
        `✅ پرداخت #${paymentId} توسط ادمین تایید شد!\n💰 ${payment.amount.toLocaleString('fa-IR')} تومان به کیف پول اضافه شد.`
      ),
    };
  }

  if (payment.purpose === 'purchase') {
    const gb = payment.meta.gb ?? 30;
    const name = payment.meta.serviceName ?? `u${paymentId}`;
    const inboundId = payment.meta.inboundId ?? 1;
    const inboundRemark = payment.meta.inboundRemark ?? 'Default';
    const subId = randomHex(16);
    const subUrl = `${config.subBaseUrl.replace(/\/+$/, '')}/${subId}`;
    const newOrder: SimOrder = {
      id: state.nextOrderId,
      clientEmail: name,
      inboundId,
      inboundRemark,
      gb,
      usedGb: 0,
      daysLeft: 30,
      subId,
      amountPaid: payment.amount,
      active: true,
    };
    const trace = makeTrace(config, 'POST', '/panel/api/clients/add', `تایید رسید #${paymentId} و ساخت ${name}`);
    return {
      ...state,
      orders: [newOrder, ...state.orders],
      nextOrderId: state.nextOrderId + 1,
      pendingPayments: updatedPending,
      apiTraces: [trace, ...state.apiTraces].slice(0, 12),
      ...pushMsg(
        state,
        'bot',
        `✅ پرداخت #${paymentId} تایید شد!\n🎉 سرویس ${name} (${gb}GB) آماده است:\n${subUrl}`,
        undefined,
        subUrl
      ),
    };
  }

  const email = payment.meta.clientEmail ?? '';
  const gb = payment.meta.gb ?? 10;
  const updatedOrders = state.orders.map((o) =>
    o.clientEmail === email ? { ...o, gb: o.gb + gb, daysLeft: 30 } : o
  );
  const trace = makeTrace(config, 'POST', `/panel/api/clients/update/${email}`, `تمدید پس از تایید #${paymentId}`);
  return {
    ...state,
    orders: updatedOrders,
    pendingPayments: updatedPending,
    apiTraces: [trace, ...state.apiTraces].slice(0, 12),
    ...pushMsg(state, 'bot', `✅ پرداخت #${paymentId} تایید شد و سرویس ${email} تمدید گردید.`),
  };
}

export function rejectPendingPayment(state: BotSimState, paymentId: number): BotSimState {
  const payment = state.pendingPayments.find((p) => p.id === paymentId);
  if (!payment || payment.status !== 'pending') return state;
  return {
    ...state,
    pendingPayments: state.pendingPayments.map((p) =>
      p.id === paymentId ? { ...p, status: 'rejected' as const } : p
    ),
    ...pushMsg(state, 'bot', `❌ پرداخت #${paymentId} توسط ادمین تایید نشد.`),
  };
}

export function simulateCliCommand(command: string, config: BotConfig): string {
  const proxyLine = config.proxyEnabled
    ? `reachable (${config.proxyHost}:${config.proxyPort})`
    : 'disabled (direct connection)';

  switch (command) {
    case 'status':
      return `● vpnbot.service - 3X-UI VPN Telegram Bot (aiogram 3.x)
   Loaded: loaded (/etc/systemd/system/vpnbot.service; enabled; preset: enabled)
   Active: active (running) since Sun 2026-11-15 14:20:04 UTC
 Main PID: 18422 (python3)
    Tasks: 4 (limit: 4620)
   Memory: 46.8M
      CPU: 1.420s
   CGroup: /system.slice/vpnbot.service
           └─18422 ${config.botDir}/.venv/bin/python3 main.py`;
    case 'health':
      return `Running health checks...

Bot service:                  running
.env file:                    found (${config.botDir}/.env)
Telegram bot token:           valid
SOCKS5 proxy:                 ${proxyLine}
3X-UI panel API token:        valid (Authorization: Bearer ***)
Database file:                found (vpn_bot.db, WAL + 9 B-Tree indexes)
Web panel:                    ${config.webPanelEnabled ? `http://<SERVER_IP>:${config.webPanelPort}` : 'disabled'}
Disk space:                   18.4G free`;
    case 'stats':
      return `--- Quick database stats ---
Users             : 412
Orders            : 689
Total revenue     : 148,500,000
Pending payments  : 2`;
    case 'logs':
      return `2026-11-15 14:35:01 [INFO] database: DB ready with optimized indexes: vpn_bot.db
2026-11-15 14:35:01 [INFO] main: ${
        config.proxyEnabled
          ? `Using SOCKS5 proxy: ${config.proxyHost}:${config.proxyPort}`
          : 'Direct connection mode (no SOCKS5 proxy configured)'
      }
2026-11-15 14:35:02 [INFO] main: 3X-UI Telegram Bot started (aiogram 3.x async)
2026-11-15 14:36:18 [INFO] services.panel: POST ${config.panelPath}/panel/api/clients/add -> 200 OK`;
    case 'backup':
      return `Creating backup...
[OK] Backup saved: ${config.botDir}/backups/backup_20261115_143800.tar.gz`;
    case 'restart':
      return `Restarting vpnbot.service...
[OK] Restarted.`;
    default:
      return `Unknown command: ${command}`;
  }
}
