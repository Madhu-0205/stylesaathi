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

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
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
      const closeBtn = document.querySelector('button[aria-label="Close sheet"]') || document.querySelector('button[aria-label="Close dialog"]');
      if (closeBtn) closeBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 400));

    // 5. Open Add Item Sheet
    console.log('Opening AddItemSheet...');
    await cdp.eval(`(() => {
      const addBtn = document.querySelector('button[aria-label="Add clothing item"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add Piece') || b.textContent.includes('Add'));
      if (addBtn) addBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 500));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'flow_07_add_item_sheet.png'));

    // Close Add Item Sheet
    await cdp.eval(`(() => {
      const closeBtn = document.querySelector('button[aria-label="Close sheet"]') || document.querySelector('button[aria-label="Close dialog"]');
      if (closeBtn) closeBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 400));


    // 6. Dress Me Screen
    console.log('Navigating to Dress Screen...');
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('nav button')).find(b => b.textContent.includes('DRESS') || b.textContent.includes('Dress'));
      if (btn) btn.click();
    })()`);
    await new Promise(r => setTimeout(r, 600));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'flow_08_dress_me_screen.png'));

    // Wear Today interaction
    console.log('Testing "Wear Today" interaction...');
    await cdp.eval(`(() => {
      const wearBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Wear Today') || b.textContent.includes('Wore This'));
      if (wearBtn) wearBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 500));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'flow_08b_worn_today.png'));

    // Shuffle interaction
    console.log('Testing Shuffle button...');
    await cdp.eval(`(() => {
      const shuffleBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Shuffle'));
      if (shuffleBtn) shuffleBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 600));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'flow_08c_shuffled.png'));

    // Switch Occasion to "puja" or "wedding guest"
    console.log('Switching occasion to Puja...');
    await cdp.eval(`(() => {
      const pujaChip = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().toLowerCase() === 'puja');
      if (pujaChip) pujaChip.click();
    })()`);
    await new Promise(r => setTimeout(r, 600));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'flow_08d_puja_look.png'));

    // Switch back to "college"
    await cdp.eval(`(() => {
      const collegeChip = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().toLowerCase() === 'college');
      if (collegeChip) collegeChip.click();
    })()`);
    await new Promise(r => setTimeout(r, 400));

    // Open Accessory Drawer in Dress Me
    console.log('Opening Finish The Look Drawer in Dress...');
    await cdp.eval(`(() => {
      const accBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Finish') || b.textContent.includes('Accessory'));
      if (accBtn) accBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 500));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'flow_09_accessory_drawer.png'));

    // Close Accessory Drawer
    await cdp.eval(`(() => {
      const closeBtn = document.querySelector('button[aria-label="Close sheet"]') || document.querySelector('button[aria-label="Close dialog"]');
      if (closeBtn) closeBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 400));

    // 7. Insight Screen
    console.log('Navigating to Insight Screen...');
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('nav button')).find(b => b.textContent.includes('INSIGHT') || b.textContent.includes('Insight') || b.textContent.includes('Gaps'));
      if (btn) btn.click();
    })()`);
    await new Promise(r => setTimeout(r, 600));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'flow_10_gaps_screen.png'));

    // Open Combinations Modal
    console.log('Opening Combinations Modal on Smart Buy card...');
    await cdp.eval(`(() => {
      const comboBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('See') && b.textContent.includes('Look'));
      if (comboBtn) comboBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 500));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'flow_11_combinations_modal.png'));

    // Close Combinations Modal
    await cdp.eval(`(() => {
      const closeBtn = document.querySelector('button[aria-label="Close sheet"]') || document.querySelector('button[aria-label="Close dialog"]');
      if (closeBtn) closeBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 400));

    // 8. You / Profile Screen & Dark Mode
    console.log('Navigating to You Screen...');
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('nav button')).find(b => b.textContent.includes('YOU') || b.textContent.includes('You') || b.textContent.includes('Profile'));
      if (btn) btn.click();
    })()`);
    await new Promise(r => setTimeout(r, 600));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'flow_12_profile_light.png'));

    // Toggle Dark Mode
    console.log('Toggling Dark Mode...');
    await cdp.eval(`(() => {
      const darkBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Dark'));
      if (darkBtn) darkBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 400));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'flow_13_profile_dark.png'));

    // Switch back to Wardrobe in Dark Mode
    console.log('Verifying Wardrobe Screen in Dark Mode...');
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('nav button')).find(b => b.textContent.includes('WARDROBE') || b.textContent.includes('Wardrobe'));
      if (btn) btn.click();
    })()`);
    await new Promise(r => setTimeout(r, 500));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'flow_14_wardrobe_dark.png'));

    // Switch back to Light Mode for default clean state
    await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('nav button')).find(b => b.textContent.includes('YOU') || b.textContent.includes('You'));
      if (btn) btn.click();
    })()`);
    await new Promise(r => setTimeout(r, 400));
    await cdp.eval(`(() => {
      const lightBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Light'));
      if (lightBtn) lightBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 300));

    // Responsive Viewports Verification
    console.log('Verifying Responsive Viewports...');
    // 375 x 812 (iPhone Mini / X)
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
    await new Promise(r => setTimeout(r, 300));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'viewport_375x812_wardrobe.png'));

    // 430 x 932 (iPhone 14/15 Pro Max)
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 2, mobile: true });
    await new Promise(r => setTimeout(r, 300));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'viewport_430x932_wardrobe.png'));

    // 768 x 1024 (Tablet)
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 768, height: 1024, deviceScaleFactor: 2, mobile: false });
    await new Promise(r => setTimeout(r, 300));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'viewport_768x1024_wardrobe.png'));

    // 1440 x 900 (Desktop Centered Compact App Shell)
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
    await new Promise(r => setTimeout(r, 300));
    await cdp.captureScreenshot(path.join(ARTIFACTS_DIR, 'viewport_1440x900_desktop.png'));

    // Restore to primary mobile 390x844
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await new Promise(r => setTimeout(r, 300));

    console.log('All QA flows and viewports executed and captured successfully!');
    cdp.close();
  } finally {
    chrome.kill();
  }
}

run().catch(console.error);

