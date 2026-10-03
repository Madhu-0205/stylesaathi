import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACTS_DIR = '/Users/madhu/.gemini/antigravity-ide/brain/218589ea-929f-44c6-9d96-963ba92ac050';
const USER_DATA_DIR = path.join(ARTIFACTS_DIR, 'chrome-profile-qa2');

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
  const PORT = 9228;
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
    let targets = null;
    for (let i = 0; i < 25; i++) {
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
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });

    console.log('Navigating to http://localhost:5173/ ...');
    await cdp.send('Page.navigate', { url: 'http://localhost:5173/' });
    await new Promise(r => setTimeout(r, 1200));

    // Clear local storage and reload to test fresh onboarding
    console.log('Resetting storage for clean verification...');
    await cdp.eval('localStorage.clear()');
    await cdp.send('Page.reload');
    await new Promise(r => setTimeout(r, 1000));

    // 1. Onboarding Slide 1
    console.log('Verifying Onboarding Slide 1...');
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'flow_01_onboarding_s1.png'));

    // Click Continue to Slide 2
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Continue'));
      if (btn) btn.click();
    })()`);
    await new Promise(r => setTimeout(r, 350));
    console.log('Verifying Onboarding Slide 2...');
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'flow_02_onboarding_s2.png'));

    // Click Continue to Slide 3
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Continue'));
      if (btn) btn.click();
    })()`);
    await new Promise(r => setTimeout(r, 350));
    console.log('Verifying Onboarding Slide 3...');
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'flow_03_onboarding_s3.png'));

    // Click "Load Sample Indian Wardrobe"
    console.log('Loading Sample Wardrobe...');
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Load Sample'));
      if (btn) btn.click();
    })()`);
    // Wait for async IndexedDB sample data load
    await new Promise(r => setTimeout(r, 1200));

    // 2. Wardrobe Screen Verified
    console.log('Verifying Wardrobe Screen with Sample Wardrobe...');
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'flow_04_wardrobe_loaded.png'));

    // 3. Search for "Kurta"
    console.log('Verifying Search interaction for "Kurta"...');
    await cdp.eval(`(() => {
      const input = document.querySelector('input[placeholder*="Search"]');
      if (input) {
        input.value = 'kurta';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()`);
    await new Promise(r => setTimeout(r, 300));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'flow_05_wardrobe_search_kurta.png'));

    // Clear search
    await cdp.eval(`(() => {
      const clearBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Clear'));
      if (clearBtn) clearBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 300));

    // 4. Open Item Detail Sheet
    console.log('Opening ItemDetailSheet on first item...');
    await cdp.eval(`(() => {
      const firstCard = document.querySelector('.grid > div');
      if (firstCard) firstCard.click();
    })()`);
    await new Promise(r => setTimeout(r, 500));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'flow_06_item_detail_sheet.png'));

    // Close Item Detail Sheet
    await cdp.eval(`(() => {
      const closeBtn = document.querySelector('button[aria-label="Close dialog"]');
      if (closeBtn) closeBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 400));

    // 5. Open Add Item Sheet
    console.log('Opening AddItemSheet...');
    await cdp.eval(`(() => {
      const addBtn = document.querySelector('button[aria-label="Add clothing item"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add'));
      if (addBtn) addBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 500));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'flow_07_add_item_sheet.png'));

    // Close Add Item Sheet
    await cdp.eval(`(() => {
      const closeBtn = document.querySelector('button[aria-label="Close dialog"]');
      if (closeBtn) closeBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 400));

    // 6. Dress Me Screen
    console.log('Navigating to Dress Me Screen...');
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('nav button')).find(b => b.textContent.includes('Dress Me'));
      if (btn) btn.click();
    })()`);
    await new Promise(r => setTimeout(r, 600));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'flow_08_dress_me_screen.png'));

    // Open Accessory Drawer in Dress Me
    console.log('Opening Accessory Drawer in Dress Me...');
    await cdp.eval(`(() => {
      const accBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add Accessory') || b.querySelector('svg'));
      if (accBtn) accBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 500));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'flow_09_accessory_drawer.png'));

    // Close Accessory Drawer
    await cdp.eval(`(() => {
      const closeBtn = document.querySelector('button[aria-label="Close dialog"]');
      if (closeBtn) closeBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 400));

    // 7. Gaps Screen
    console.log('Navigating to Gaps Screen...');
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('nav button')).find(b => b.textContent.includes('Gaps'));
      if (btn) btn.click();
    })()`);
    await new Promise(r => setTimeout(r, 600));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'flow_10_gaps_screen.png'));

    // Open Combinations Modal
    console.log('Opening Combinations Modal on Smart Buy card...');
    await cdp.eval(`(() => {
      const comboBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('See combinations') || b.textContent.includes('See Combinations'));
      if (comboBtn) comboBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 500));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'flow_11_combinations_modal.png'));

    // Close Combinations Modal
    await cdp.eval(`(() => {
      const closeBtn = document.querySelector('button[aria-label="Close dialog"]');
      if (closeBtn) closeBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 400));

    // 8. Profile Screen & Dark Mode
    console.log('Navigating to Profile Screen...');
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('nav button')).find(b => b.textContent.includes('Profile'));
      if (btn) btn.click();
    })()`);
    await new Promise(r => setTimeout(r, 600));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'flow_12_profile_light.png'));

    // Toggle Dark Mode
    console.log('Toggling Dark Mode...');
    await cdp.eval(`(() => {
      const darkBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Dark (Charcoal)'));
      if (darkBtn) darkBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 400));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'flow_13_profile_dark.png'));

    // Switch back to Wardrobe in Dark Mode
    console.log('Verifying Wardrobe Screen in Dark Mode...');
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('nav button')).find(b => b.textContent.includes('Wardrobe'));
      if (btn) btn.click();
    })()`);
    await new Promise(r => setTimeout(r, 500));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'flow_14_wardrobe_dark.png'));

    console.log('All QA flows executed and captured successfully!');
    cdp.close();
  } finally {
    chrome.kill();
  }
}

run().catch(console.error);
