import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const SHOTS = '../docs/screenshots';
const img = (name) =>
  'data:image/png;base64,' +
  readFileSync(new URL(`${SHOTS}/${name}.png`, import.meta.url)).toString('base64');

/* Finto's own palette, so the carousel matches the product. */
const css = `
  @page { size: 1080px 1080px; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Manrope, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  .slide {
    width: 1080px; height: 1080px;
    page-break-after: always;
    position: relative; overflow: hidden;
    background: #F6F7F4;
    display: flex; flex-direction: column;
  }
  .slide:last-child { page-break-after: auto; }

  .dark { background: #14301A; color: #fff; }

  .pad { padding: 72px 76px; }

  .eyebrow {
    font-size: 21px; font-weight: 700; letter-spacing: .16em;
    text-transform: uppercase; color: #A9EE68;
  }
  .eyebrow.ink { color: #6B726C; }

  h1 { font-size: 92px; font-weight: 800; letter-spacing: -.05em; line-height: .98; }
  h2 { font-size: 58px; font-weight: 800; letter-spacing: -.045em; line-height: 1.02; }
  h3 { font-size: 40px; font-weight: 800; letter-spacing: -.035em; }

  p.lede { font-size: 31px; font-weight: 500; line-height: 1.45; color: rgba(255,255,255,.72); }
  p.body { font-size: 27px; font-weight: 500; line-height: 1.5; color: #3F453F; }

  .mark {
    width: 96px; height: 96px; border-radius: 30px;
    background: #A9EE68; color: #14301A;
    display: grid; place-items: center;
    font-size: 50px; font-weight: 800; letter-spacing: -.04em;
  }

  .phones { display: flex; gap: 30px; align-items: center; justify-content: center; flex: 1; }
  .phones img {
    height: 690px; border-radius: 30px;
    border: 1px solid #E4E7E1;
    box-shadow: 0 30px 70px -32px rgba(11,12,11,.45);
  }

  .wide { display: grid; place-items: center; flex: 1; padding: 0 60px; }
  .wide img {
    width: 100%; border-radius: 20px;
    border: 1px solid #E4E7E1;
    box-shadow: 0 30px 70px -32px rgba(11,12,11,.4);
  }

  .caption { padding: 0 76px 66px; }
  .caption h3 { margin-bottom: 12px; }
  .caption p { font-size: 25px; font-weight: 500; color: #6B726C; line-height: 1.45; }

  .chips { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 44px; }
  .chip {
    padding: 15px 26px; border-radius: 999px;
    background: rgba(169,238,104,.12);
    border: 1px solid rgba(169,238,104,.34);
    font-size: 24px; font-weight: 700; color: #A9EE68;
  }
  .chip.ink { background: #fff; border-color: #E4E7E1; color: #0B0C0B; }

  .points { display: flex; flex-direction: column; gap: 40px; margin-top: 52px; }
  .point { display: flex; gap: 26px; }
  .num {
    flex: none; width: 60px; height: 60px; border-radius: 20px;
    background: #A9EE68; color: #14301A;
    display: grid; place-items: center;
    font-size: 27px; font-weight: 800;
  }
  .point h3 { font-size: 33px; margin-bottom: 7px; }
  .point p { font-size: 24px; font-weight: 500; line-height: 1.42; color: rgba(255,255,255,.68); }

  .foot {
    position: absolute; left: 76px; bottom: 54px;
    font-size: 22px; font-weight: 700; color: #9AA09A;
  }
  .glow {
    position: absolute; right: -170px; top: -170px;
    width: 620px; height: 620px; border-radius: 50%;
    background: rgba(169,238,104,.11);
  }
`;

const slides = [
  // 1 — cover
  `<div class="slide dark pad" style="justify-content:center">
     <div class="glow"></div>
     <div class="mark">F</div>
     <h1 style="margin-top:52px">Finto</h1>
     <p class="lede" style="margin-top:26px;max-width:15ch">A multi-currency banking app, built end to end.</p>
     <div class="chips">
       <span class="chip">TypeScript</span>
       <span class="chip">React</span>
       <span class="chip">React Native</span>
       <span class="chip">PostgreSQL</span>
     </div>
   </div>`,

  // 2 — from design to product
  `<div class="slide pad" style="justify-content:center">
     <span class="eyebrow ink">The project</span>
     <h2 style="margin-top:22px">From a UI concept<br>to a working product</h2>
     <p class="body" style="margin-top:30px;max-width:30ch">
       It started as an original design for a payments app. I built the whole
       thing behind it — an API with a real financial ledger, a web app, and a
       mobile app, all sharing one backend.
     </p>
     <div class="chips">
       <span class="chip ink">15 screens</span>
       <span class="chip ink">53 tests</span>
       <span class="chip ink">3 apps, one API</span>
     </div>
   </div>`,

  // 3 — home desktop
  `<div class="slide">
     <div class="pad" style="padding-bottom:34px"><span class="eyebrow ink">Web</span>
       <h3 style="margin-top:12px">Everything at a glance</h3></div>
     <div class="wide"><img src="${img('02-home-desktop')}"></div>
     <div class="caption" style="padding-top:40px">
       <p>Balances across every currency, converted into one total. Recent
          activity underneath.</p>
     </div>
   </div>`,

  // 4 — mobile trio
  `<div class="slide">
     <div class="pad" style="padding-bottom:26px"><span class="eyebrow ink">Mobile</span>
       <h3 style="margin-top:12px">The same code, at phone size</h3></div>
     <div class="phones">
       <img src="${img('04-home-mobile')}">
       <img src="${img('05-activity-mobile')}">
       <img src="${img('09-send-mobile')}">
     </div>
     <div class="caption" style="padding-top:36px">
       <p>One codebase. The side rail becomes a tab bar; nothing is rebuilt.</p>
     </div>
   </div>`,

  // 5 — cards and accounts
  `<div class="slide">
     <div class="pad" style="padding-bottom:26px"><span class="eyebrow ink">Control</span>
       <h3 style="margin-top:12px">Cards, limits, currencies</h3></div>
     <div class="phones">
       <img src="${img('06-cards-mobile')}">
       <img src="${img('08-accounts-mobile')}">
       <img src="${img('07-pay-mobile')}">
     </div>
     <div class="caption" style="padding-top:36px">
       <p>Freeze a card, set a monthly limit, open a balance in a new currency,
          pay anyone instantly.</p>
     </div>
   </div>`,

  // 6 — activity desktop
  `<div class="slide">
     <div class="pad" style="padding-bottom:34px"><span class="eyebrow ink">Activity</span>
       <h3 style="margin-top:12px">Every movement, searchable</h3></div>
     <div class="wide"><img src="${img('03-activity-desktop')}"></div>
     <div class="caption" style="padding-top:40px">
       <p>Grouped by day with running totals, filtered by income, spending or
          pending.</p>
     </div>
   </div>`,

  // 7 — under the hood
  `<div class="slide dark pad" style="justify-content:center">
     <div class="glow"></div>
     <span class="eyebrow">Under the hood</span>
     <h2 style="margin-top:20px">Built like money<br>actually matters</h2>
     <div class="points">
       <div class="point"><div class="num">1</div><div>
         <h3>No floating-point money</h3>
         <p>Amounts are whole cents, never decimals. 0.1 + 0.2 does not equal 0.3 in a computer, and on a balance that error compounds.</p>
       </div></div>
       <div class="point"><div class="num">2</div><div>
         <h3>A double-entry ledger</h3>
         <p>Every payment writes matched entries that must net to zero. A payment cannot half-happen, and two at once cannot overdraw the same balance.</p>
       </div></div>
       <div class="point"><div class="num">3</div><div>
         <h3>Retries are safe</h3>
         <p>Phones lose signal mid-payment. Retrying returns the original result instead of charging twice.</p>
       </div></div>
     </div>
   </div>`,

  // 8 — close
  `<div class="slide pad" style="justify-content:center">
     <span class="eyebrow ink">Built with</span>
     <h2 style="margin-top:22px">TypeScript · Fastify<br>PostgreSQL · React<br>React Native</h2>
     <p class="body" style="margin-top:34px;max-width:28ch">
       Designed and built by Marbella, with Claude Code.
       The code, the tests and the write-up are all on GitHub.
     </p>
     <div class="chips">
       <span class="chip ink">github.com/bellamarbellaa</span>
     </div>
     <div class="foot">Finto — a fictional product, built for real</div>
   </div>`
];

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;700;800&display=swap" rel="stylesheet">
<style>${css}</style></head><body>${slides.join('')}</body></html>`;

mkdirSync(new URL('../docs/build/', import.meta.url), { recursive: true });
writeFileSync(new URL('../docs/build/carousel.html', import.meta.url), html);

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox']
});
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 2500));   // let Manrope load

await page.pdf({
  path: new URL('../docs/Finto-Case-Study.pdf', import.meta.url).pathname,
  width: '1080px',
  height: '1080px',
  printBackground: true,
  pageRanges: `1-${slides.length}`
});

await browser.close();
console.log(`  ✓ ${slides.length} slides`);
