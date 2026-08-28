import puppeteer from 'puppeteer-core';
const OUT = '../docs/screenshots', BASE = 'http://localhost:5173';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-sandbox', '--hide-scrollbars']
});
const page = await browser.newPage();
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const phone = () => page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
const desktop = () => page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

async function settled() {
  await page.waitForFunction(() => document.querySelectorAll('.skeleton').length === 0, { timeout: 25000 }).catch(()=>{});
  await wait(700);
}
async function shot(n) { await settled(); await page.screenshot({ path: `${OUT}/${n}.png` }); console.log('  ✓ '+n); }

await desktop();
await page.goto(BASE, { waitUntil: 'networkidle2' }); await wait(1200);
await page.screenshot({ path: `${OUT}/01-login-desktop.png` }); console.log('  ✓ 01-login-desktop');
await page.click('button[type="submit"]');
await page.waitForSelector('.balance-card', { timeout: 30000 }).catch(()=>{});
await shot('02-home-desktop');
await page.goto(`${BASE}/activity`, { waitUntil: 'networkidle2' });
await page.waitForSelector('.day-head', { timeout: 30000 }).catch(()=>{});
await shot('03-activity-desktop');

await phone();
for (const [path, sel, name] of [
  ['/', '.balance-card', '04-home-mobile'],
  ['/activity', '.day-head', '05-activity-mobile'],
  ['/cards', '.card-face', '06-cards-mobile'],
  ['/pay', '.avatar', '07-pay-mobile'],
  ['/accounts', '.total-strip', '08-accounts-mobile']
]) {
  await page.goto(BASE + path, { waitUntil: 'networkidle2' });
  await page.waitForSelector(sel, { timeout: 30000 }).catch(()=>{});
  await shot(name);
}

await page.goto(`${BASE}/pay`, { waitUntil: 'networkidle2' });
await page.waitForSelector('.avatar', { timeout: 30000 }).catch(()=>{});
await settled();
const rows = await page.$$('button.row');
if (rows.length > 2) {
  await rows[2].click();
  await page.waitForSelector('.keypad', { timeout: 20000 }).catch(()=>{});
  const keys = await page.$$('button.key');
  for (const i of [0, 1, 10]) { if (keys[i]) { await keys[i].click(); await wait(160); } }
  await wait(1500);
  await page.screenshot({ path: `${OUT}/09-send-mobile.png` }); console.log('  ✓ 09-send-mobile');
}
await browser.close(); console.log('\n  done');
