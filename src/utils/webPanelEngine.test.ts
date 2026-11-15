import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adjustUserBalance,
  applyDiscount,
  approveReceipt,
  buildEnvFile,
  calculateTieredPrice,
  createDefaultPanelState,
  createVpnConfig,
  deleteVpnConfig,
  getBroadcastRecipients,
  isValidServiceName,
  rejectReceipt,
  renewVpnConfig,
  rotateVpnConfigLink,
  syncInboundsFromPanel,
  toggleUserBlocked,
} from './webPanelEngine';

test('tiered pricing and discount rules match bot configuration', () => {
  const state = createDefaultPanelState();
  assert.deepEqual(calculateTieredPrice(10, state.pricing), { perGb: 8000, total: 80000 });
  assert.deepEqual(calculateTieredPrice(40, state.pricing), { perGb: 7500, total: 300000 });
  assert.deepEqual(calculateTieredPrice(100, state.pricing), { perGb: 7000, total: 700000 });

  assert.equal(applyDiscount(300000, 20), 240000);
  assert.equal(applyDiscount(1500, 90), 1000);
  assert.equal(isValidServiceName('ali.phone'), true);
  assert.equal(isValidServiceName('ab'), false);
});

test('syncInboundsFromPanel merges fetched 3X-UI inbounds preserving existing flow', () => {
  const state = createDefaultPanelState();
  const synced = syncInboundsFromPanel(state.inbounds, [
    { id: 1, remark: 'DE-Reality-Updated', protocol: 'vless', port: 443, clientCount: 15 },
    { id: 5, remark: 'NL-Trojan', protocol: 'trojan', port: 8443, clientCount: 3 },
  ]);
  assert.equal(synced.length, 2);
  assert.equal(synced[0].flow, 'xtls-rprx-vision');
  assert.equal(synced[0].remark, 'DE-Reality-Updated');
  assert.equal(synced[1].flow, '');
  assert.equal(synced[1].enabled, true);
});

test('wallet receipt approval credits user and awards 5% referral bonus once', () => {
  let state = createDefaultPanelState();
  const inviterBefore = state.users.find((u) => u.telegramId === 9001001)!.balance;
  const inviteeBefore = state.users.find((u) => u.telegramId === 9001002)!.balance;

  state = approveReceipt(state, 101);
  const inviterAfter = state.users.find((u) => u.telegramId === 9001001)!;
  const inviteeAfter = state.users.find((u) => u.telegramId === 9001002)!;

  assert.equal(inviteeAfter.balance, inviteeBefore + 200000);
  assert.equal(inviterAfter.balance, inviterBefore + 10000);
  assert.equal(inviteeAfter.referralBonusPaid, true);
  assert.equal(state.pendingReceipts[0].status, 'approved');
});

test('creating, renewing, rotating, and deleting VPN configs updates state & wallet accurately', () => {
  let state = createDefaultPanelState();
  const created = createVpnConfig(state, {
    telegramId: 9001001,
    clientEmail: 'test.user',
    inboundId: 1,
    gb: 10,
    days: 30,
    deductWallet: true,
    subId: '1111222233334444',
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  state = created.state;
  assert.equal(state.users.find((u) => u.telegramId === 9001001)!.balance, 70000);

  state = renewVpnConfig(state, 'test.user', 25, 30);
  assert.equal(state.orders.find((o) => o.clientEmail === 'test.user')!.gb, 35);

  state = rotateVpnConfigLink(state, 'test.user', 'aaaabbbbccccdddd');
  assert.equal(state.orders.find((o) => o.clientEmail === 'test.user')!.subId, 'aaaabbbbccccdddd');

  state = deleteVpnConfig(state, 'test.user');
  assert.equal(state.orders.some((o) => o.clientEmail === 'test.user'), false);
});

test('rejectReceipt, adjustUserBalance, toggleUserBlocked, and broadcast targeting work cleanly', () => {
  let state = createDefaultPanelState();
  state = rejectReceipt(state, 101);
  assert.equal(state.pendingReceipts[0].status, 'rejected');

  state = adjustUserBalance(state, 9001002, 55000, 'اصلاح دستی');
  assert.equal(state.users.find((u) => u.telegramId === 9001002)!.balance, 100000);

  state = toggleUserBlocked(state, 9001002);
  assert.equal(state.users.find((u) => u.telegramId === 9001002)!.blocked, true);

  const recipients = getBroadcastRecipients(state, 'all');
  assert.equal(recipients.length, 1);
  assert.equal(recipients[0].telegramId, 9001001);
});

test('buildEnvFile emits Bearer token config, enabled inbounds, and SOCKS5 proxy settings', () => {
  let state = createDefaultPanelState();
  state.panel.panelApiToken = 'bearer_token_abc';
  state.panel.proxyEnabled = true;
  const env = buildEnvFile(state);
  assert.match(env, /PANEL_API_TOKEN=bearer_token_abc/);
  assert.match(env, /PROXY_HOST=127\.0\.0\.1/);
  assert.match(env, /INBOUNDS=1:Germany · VLESS Reality:xtls-rprx-vision,2:Finland · VLESS WS:/);
});
