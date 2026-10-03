import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACTS_DIR = '/Users/madhu/.gemini/antigravity-ide/brain/218589ea-929f-44c6-9d96-963ba92ac050';
const USER_DATA_DIR = path.join(ARTIFACTS_DIR, 'chrome-profile');

if (!fs.existsSync(USER_DATA_DIR)) {
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.events = [];
    this.consoleLogs = [];

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        this.consoleLogs.push(msg.params);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        console.error('Browser Exception:', msg.params);
      }
    };
  }

  waitOpen() {
    return new Promise((resolve) => {
      if (this.ws.readyState === WebSocket.OPEN) resolve();
      else this.ws.onopen = () => resolve();
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(JSON.stringify(res.exceptionDetails));
    }
    return res.result?.value;
  }

  async captureScreenshot(outputPath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(outputPath, Buffer.from(res.data, 'base64'));
  }

  close() {
    this.ws.close();
  }
}

async function run() {
  const PORT = 9225;
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--force-device-scale-factor=1',
    '--window-size=1200,900',
    'about:blank',
  ]);

  try {
    // Wait for CDP to respond
    let targets = null;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 200));
      try {
        targets = await fetchJson(`http://127.0.0.1:${PORT}/json`);
        if (targets && targets.length > 0) break;
      } catch (e) {}
    }

    if (!targets) throw new Error('Could not connect to Chrome CDP');
    const pageTarget = targets.find(t => t.type === 'page') || targets[0];
    const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.waitOpen();

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    console.log('--- 1. Testing Viewports for Horizontal Overflow ---');
    const viewports = [
      { name: 'iphone_375x812', width: 375, height: 812 },
      { name: 'iphone_390x844', width: 390, height: 844 },
      { name: 'iphone_430x932', width: 430, height: 932 },
      { name: 'tablet_768x1024', width: 768, height: 1024 },
      { name: 'desktop_1440x900', width: 1440, height: 900 },
    ];

    await cdp.send('Page.navigate', { url: 'http://localhost:5173/' });
    await new Promise(r => setTimeout(r, 1200));

    for (const vp of viewports) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 2,
        mobile: vp.width < 768,
      });
      await new Promise(r => setTimeout(r, 300));

      const overflow = await cdp.eval(`(() => {
        const docW = document.documentElement.clientWidth;
        const scrollW = document.documentElement.scrollWidth;
        const bodyScrollW = document.body.scrollWidth;
        const overflowing = [];
        document.querySelectorAll('*').forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.right > docW + 1) {
            overflowing.push({
              tag: el.tagName,
              className: el.className ? String(el.className).slice(0, 50) : '',
              right: rect.right,
              docW
            });
          }
        });
        return { docW, scrollW, bodyScrollW, overflowing: overflowing.slice(0, 5) };
      })()`);

      console.log(`Viewport ${vp.name} (${vp.width}x${vp.height}):`, {
        scrollWidth: overflow.scrollW,
        clientWidth: overflow.docW,
        hasHorizontalOverflow: overflow.scrollW > overflow.docW,
        overflowingElements: overflow.overflowing.length
      });

      if (overflow.overflowing.length > 0) {
        console.log('Sample overflowing elements:', overflow.overflowing);
      }

      await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, `qa_${vp.name}_onboarding.png`));
    }

    console.log('--- 2. Onboarding Flow Test ---');
    // Set to 390x844
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });

    // Check step 1 slide screenshot
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'qa_onboarding_slide1.png'));

    // Click Continue to step 2
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Continue'));
      if (btn) btn.click();
    })()`);
    await new Promise(r => setTimeout(r, 400));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'qa_onboarding_slide2.png'));

    // Toggle a vibe chip in step 2
    await cdp.eval(`(() => {
      const chips = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('Indie fusion') || b.textContent.includes('Minimal'));
      if (chips[0]) chips[0].click();
    })()`);
    await new Promise(r => setTimeout(r, 200));

    // Click Continue to step 3
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Continue'));
      if (btn) btn.click();
    })()`);
    await new Promise(r => setTimeout(r, 400));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'qa_onboarding_slide3.png'));

    // Click "Load Sample Indian Wardrobe"
    console.log('Clicking "Load Sample Indian Wardrobe"...');
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Load Sample Indian Wardrobe'));
      if (btn) btn.click();
    })()`);
    await new Promise(r => setTimeout(r, 800));

    console.log('--- 3. Wardrobe Screen Test ---');
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'qa_screen_wardrobe.png'));

    const wardrobeStats = await cdp.eval(`(() => {
      const items = document.querySelectorAll('.grid > div');
      const search = document.querySelector('input[placeholder*="Search"]');
      return {
        cardCount: items.length,
        hasSearch: Boolean(search),
        headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent.trim())
      };
    })()`);
    console.log('Wardrobe screen stats:', wardrobeStats);

    // Test clicking an item to open ItemDetailSheet
    console.log('Testing ItemDetailSheet...');
    await cdp.eval(`(() => {
      const firstCard = document.querySelector('.grid > div');
      if (firstCard) firstCard.click();
    })()`);
    await new Promise(r => setTimeout(r, 500));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'qa_item_detail_sheet.png'));

    // Close detail sheet
    await cdp.eval(`(() => {
      const closeBtn = document.querySelector('button[aria-label="Close dialog"]');
      if (closeBtn) closeBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 400));

    // Navigate to Dress Me tab
    console.log('--- 4. Dress Me Screen Test ---');
    await cdp.eval(`(() => {
      const dressMeBtn = Array.from(document.querySelectorAll('nav button')).find(b => b.textContent.includes('Dress Me'));
      if (dressMeBtn) dressMeBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 600));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'qa_screen_dressme.png'));

    const dressMeStats = await cdp.eval(`(() => {
      return {
        heading: document.querySelector('h1, h2')?.textContent?.trim(),
        outfitCards: document.querySelectorAll('button:has(svg)').length,
        textContents: document.body.innerText.slice(0, 300)
      };
    })()`);
    console.log('Dress Me state:', dressMeStats);

    // Navigate to Gaps tab
    console.log('--- 5. Gaps Screen Test ---');
    await cdp.eval(`(() => {
      const gapsBtn = Array.from(document.querySelectorAll('nav button')).find(b => b.textContent.includes('Gaps'));
      if (gapsBtn) gapsBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 600));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'qa_screen_gaps.png'));

    // Click "See Combinations" on first Smart Buy card
    console.log('Testing Combinations Modal...');
    await cdp.eval(`(() => {
      const seeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('See Combinations'));
      if (seeBtn) seeBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 500));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'qa_combinations_modal.png'));

    // Close combinations modal
    await cdp.eval(`(() => {
      const closeBtn = document.querySelector('button[aria-label="Close dialog"]');
      if (closeBtn) closeBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 400));

    // Navigate to Profile tab
    console.log('--- 6. Profile Screen Test ---');
    await cdp.eval(`(() => {
      const profileBtn = Array.from(document.querySelectorAll('nav button')).find(b => b.textContent.includes('Profile'));
      if (profileBtn) profileBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 600));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'qa_screen_profile.png'));

    // Navigate back to Wardrobe and open Add Item sheet
    console.log('--- 7. Add Item Sheet Test ---');
    await cdp.eval(`(() => {
      const wardrobeBtn = Array.from(document.querySelectorAll('nav button')).find(b => b.textContent.includes('Wardrobe'));
      if (wardrobeBtn) wardrobeBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 400));

    await cdp.eval(`(() => {
      const addBtn = document.querySelector('button[aria-label="Add item"]');
      if (addBtn) addBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 500));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'qa_add_item_sheet.png'));

    // Accessibility & touch targets check
    console.log('--- 8. Accessibility & Touch Targets Audit ---');
    const a11y = await cdp.eval(`(() => {
      const issues = [];
      document.querySelectorAll('button, a, input, select').forEach(el => {
        const rect = el.getBoundingClientRect();
        // check only visible elements
        if (rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none') {
          if (rect.height < 40 && !el.closest('input[type="checkbox"]')) {
            issues.push({
              tag: el.tagName,
              text: el.textContent?.trim().slice(0, 20),
              h: Math.round(rect.height),
              w: Math.round(rect.width)
            });
          }
          if (el.tagName === 'BUTTON' && !el.textContent?.trim() && !el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')) {
            issues.push({
              tag: 'BUTTON_NO_LABEL',
              classes: el.className
            });
          }
        }
      });
      return issues;
    })()`);
    console.log('Touch target & label checks:', a11y);

    cdp.close();
  } finally {
    chrome.kill();
  }
}

run().catch(console.error);
