import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_BOT_CONFIG,
  applyDiscountAmount,
  approvePendingPayment,
  calculateTieredPrice,
  createInitialSimState,
  generateEnvFile,
  generateSystemdUnit,
  handleAdminCommand,
  handleBotAction,
  handleBotTextInput,
  isValidServiceName,
  rejectPendingPayment,
  simulateCliCommand,
} from './botEngine';

test('tiered pricing and discount calculation work accurately', () => {
  assert.deepEqual(calculateTieredPrice(10), { perGb: 8000, total: 80000 });
  assert.deepEqual(calculateTieredPrice(30), { perGb: 7500, total: 225000 });
  assert.deepEqual(calculateTieredPrice(80), { perGb: 7000, total: 560000 });
  assert.equal(applyDiscountAmount(225000, 20), 180000);
});

test('service name validation matches panel rules', () => {
  assert.equal(isValidServiceName('ali.reza'), true);
  assert.equal(isValidServiceName('user-123'), true);
  assert.equal(isValidServiceName('ab'), false);
  assert.equal(isValidServiceName('invalid space'), false);
});

test('generateEnvFile and generateSystemdUnit reflect API token and SOCKS5 proxy', () => {
  const env = generateEnvFile({
    ...DEFAULT_BOT_CONFIG,
    panelApiToken: 'tok_live_xyz',
    proxyEnabled: true,
    proxyHost: '127.0.0.1',
    proxyPort: '9050',
    webPanelPort: 9090,
    webPanelPass: 'pass9090',
  });
  assert.match(env, /PANEL_API_TOKEN=tok_live_xyz/);
  assert.match(env, /PROXY_HOST=127\.0\.0\.1/);
  assert.match(env, /PROXY_PORT=9050/);
  assert.match(env, /WEB_PANEL_PORT=9090/);
  assert.match(env, /WEB_PANEL_PASS=pass9090/);

  const unit = generateSystemdUnit('/srv/vpnbot');
  assert.match(unit, /WorkingDirectory=\/srv\/vpnbot/);
  assert.match(unit, /Restart=always/);
});

test('full purchase journey with discount code deducts wallet and creates order', () => {
  let sim = createInitialSimState(DEFAULT_BOT_CONFIG);
  sim = { ...sim, walletBalance: 300000 };

  sim = handleBotAction(sim, '🛒 خرید سرویس', DEFAULT_BOT_CONFIG);
  assert.equal(sim.step, 'buy_server');

  sim = handleBotAction(sim, 'pick_inbound:1', DEFAULT_BOT_CONFIG);
  assert.equal(sim.step, 'buy_gb');

  sim = handleBotTextInput(sim, '30', DEFAULT_BOT_CONFIG);
  assert.equal(sim.step, 'buy_name');
  assert.equal(sim.draft.total, 225000);

  sim = handleBotTextInput(sim, 'ali.test', DEFAULT_BOT_CONFIG);
  assert.equal(sim.step, 'buy_confirm');

  sim = handleBotAction(sim, 'enter_discount', DEFAULT_BOT_CONFIG);
  sim = handleBotTextInput(sim, 'SALE20', DEFAULT_BOT_CONFIG);
  assert.equal(sim.draft.total, 180000);

  sim = handleBotAction(sim, 'buy_confirm', DEFAULT_BOT_CONFIG);
  assert.equal(sim.step, 'idle');
  assert.equal(sim.walletBalance, 120000);
  assert.equal(sim.orders[0].clientEmail, 'ali.test');
});

test('wallet receipt approval and rejection update state', () => {
  let sim = createInitialSimState(DEFAULT_BOT_CONFIG);
  sim = handleBotAction(sim, 'wallet_topup', DEFAULT_BOT_CONFIG);
  sim = handleBotTextInput(sim, '100000', DEFAULT_BOT_CONFIG);
  sim = handleBotAction(sim, 'send_sample_receipt:wallet', DEFAULT_BOT_CONFIG);
  assert.equal(sim.pendingPayments.length, 1);

  const pid = sim.pendingPayments[0].id;
  sim = approvePendingPayment(sim, pid, DEFAULT_BOT_CONFIG);
  assert.equal(sim.walletBalance, 250000);
  assert.equal(sim.pendingPayments[0].status, 'approved');

  sim = handleBotAction(sim, 'wallet_topup', DEFAULT_BOT_CONFIG);
  sim = handleBotTextInput(sim, '50000', DEFAULT_BOT_CONFIG);
  sim = handleBotAction(sim, 'send_sample_receipt:wallet', DEFAULT_BOT_CONFIG);
  const pid2 = sim.pendingPayments[0].id;
  sim = rejectPendingPayment(sim, pid2);
  assert.equal(sim.walletBalance, 250000);
  assert.equal(sim.pendingPayments[0].status, 'rejected');
});

test('admin commands and CLI simulator produce expected outputs', () => {
  let sim = createInitialSimState(DEFAULT_BOT_CONFIG);
  sim = handleAdminCommand(sim, '/addcode TEST15 15 20', DEFAULT_BOT_CONFIG);
  assert.equal(sim.discountCodes[0].code, 'TEST15');

  const healthOut = simulateCliCommand('health', DEFAULT_BOT_CONFIG);
  assert.match(healthOut, /SOCKS5 proxy:\s+reachable \(127\.0\.0\.1:10808\)/);
  assert.match(healthOut, /3X-UI panel API token:\s+valid/);
});
