import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const DIST_DIR = path.resolve('dist');
const USER_DATA_DIR = '/tmp/stylesaathi-inspect-chrome';
const PORT = 5176;
const CDP_PORT = 9226;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

// 1. Static file server for dist/
function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      if (reqPath === '/') reqPath = '/index.html';
      const filePath = path.join(DIST_DIR, reqPath);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        res.writeHead(200, {
          'Content-Type': mimeTypes[ext] || 'application/octet-stream',
          'Access-Control-Allow-Origin': '*',
        });
        fs.createReadStream(filePath).pipe(res);
      } else {
        // SPA fallback
        res.writeHead(200, { 'Content-Type': 'text/html' });
        fs.createReadStream(path.join(DIST_DIR, 'index.html')).pipe(res);
      }
    });

    server.listen(PORT, '127.0.0.1', () => {
      console.log(`[Server] Serving dist/ on http://127.0.0.1:${PORT}`);
      resolve(server);
    });
  });
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
    this.networkRequests = [];

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      } else if (msg.method === 'Network.responseReceived') {
        this.networkRequests.push(msg.params.response);
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
    console.log(`[Screenshot] Saved ${outputPath} (${fs.statSync(outputPath).size} bytes)`);
  }

  close() {
    this.ws.close();
  }
}

async function main() {
  const server = await startServer();

  if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  }

  console.log('[Chrome] Launching Headless Chrome on port', CDP_PORT);
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--force-device-scale-factor=2',
    '--window-size=390,844',
    'about:blank',
  ]);

  try {
    let targets = null;
    for (let i = 0; i < 25; i++) {
      await new Promise(r => setTimeout(r, 200));
      try {
        targets = await fetchJson(`http://127.0.0.1:${CDP_PORT}/json`);
        if (targets && targets.length > 0) break;
      } catch (e) {}
    }

    if (!targets) throw new Error('Could not connect to Chrome CDP');
    const pageTarget = targets.find(t => t.type === 'page') || targets[0];
    const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.waitOpen();

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');

    // Emulate iPhone 14/15 mobile device
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });

    // 1. Initial navigation to seed session
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
    await new Promise(r => setTimeout(r, 1200));

    // Seed localStorage for onboarded guest session
    await cdp.eval(`(() => {
      localStorage.setItem('stylesaathi-settings-v1', JSON.stringify({
        theme: 'light',
        onboarded: true,
        styleVibes: ['Minimal', 'Contemporary'],
        setupCompleted: true
      }));
      localStorage.setItem('stylesaathi-guest-session-v1', JSON.stringify({
        id: 'guest_1',
        email: 'guest@stylesaathi.local',
        name: 'Guest Stylist',
        isGuest: true,
        createdAt: Date.now()
      }));
    })()`);

    // Reload page to apply session state
    console.log('[App] Reloading with active guest profile & onboarded status...');
    await cdp.send('Page.reload');
    await new Promise(r => setTimeout(r, 1500));

    // Check if wardrobe has pieces or needs sample load
    const itemCount = await cdp.eval(`(() => {
      const cards = document.querySelectorAll('article');
      return cards.length;
    })()`);
    console.log('[Wardrobe] Initial visible cards count:', itemCount);

    // If zero pieces, click "Load Sample Wardrobe" button if available
    const loadResult = await cdp.eval(`(() => {
      const loadBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Load Sample Wardrobe'));
      if (loadBtn) {
        loadBtn.click();
        return 'Clicked Load Sample Wardrobe';
      }
      return 'No sample button found';
    })()`);
    console.log('[Wardrobe Sample Action]:', loadResult);

    // Wait for wardrobe items to render
    for (let i = 0; i < 25; i++) {
      const count = await cdp.eval(`document.querySelectorAll('article').length`);
      if (count > 0) {
        console.log(`[Wardrobe] ${count} wardrobe items rendered!`);
        break;
      }
      await new Promise(r => setTimeout(r, 200));
    }

    // Wait a brief moment for images and styles to paint
    await new Promise(r => setTimeout(r, 1000));

    // Inspect Spatial Rail 3D Transforms before interaction
    const railInitialMetrics = await cdp.eval(`(() => {
      const railSection = document.querySelector('section[aria-label="Interactive 3D Spatial Garment Rail"]');
      const stage = railSection ? railSection.querySelector('div[role="region"]') : null;
      const cards = railSection ? Array.from(railSection.querySelectorAll('article[aria-roledescription="slide"]')) : [];
      const activeCard = cards.find(c => c.getAttribute('data-active') === 'true');
      const inactiveCards = cards.filter(c => c.getAttribute('data-active') === 'false');
      const materialBadges = railSection ? Array.from(railSection.querySelectorAll('.rounded-full')).map(el => el.textContent?.trim()).filter(Boolean) : [];

      return {
        hasRailSection: Boolean(railSection),
        stagePerspective: stage ? window.getComputedStyle(stage).perspective : null,
        stageTransformStyle: stage ? window.getComputedStyle(stage).transformStyle : null,
        totalRailCards: cards.length,
        activeCardTransform: activeCard ? activeCard.style.transform : null,
        inactiveCardTransform: inactiveCards.length > 0 ? inactiveCards[0].style.transform : null,
        activeCardName: activeCard ? activeCard.querySelector('h4')?.textContent : null,
        materialBadges,
      };
    })()`);
    console.log('\n--- SPATIAL RAIL INITIAL 3D & MATERIAL METRICS ---');
    console.log(railInitialMetrics);

    // Capture Wardrobe Mobile Screenshot with Spatial Rail (390px)
    console.log('[Screenshot] Capturing Wardrobe Mobile (390px)...');
    await cdp.captureScreenshot(path.join(DIST_DIR, 'screenshot-wardrobe-390.png'));
    await cdp.captureScreenshot(path.join(DIST_DIR, 'screenshot-wardrobe-rail-390.png'));

    // Interact with Spatial Rail: Advance to next garment
    console.log('[Spatial Rail] Clicking Next garment in rail...');
    const advanceResult = await cdp.eval(`(() => {
      const nextBtn = document.querySelector('button[aria-label="Next garment in rail"]');
      if (nextBtn) {
        nextBtn.click();
        return 'Clicked Next button';
      }
      return 'Next button not found';
    })()`);
    console.log('[Spatial Rail Result]:', advanceResult);

    // Wait for smooth 3D spring transition
    await new Promise(r => setTimeout(r, 600));

    // Milestone B: Test Tactical Micro-interactions on active piece
    console.log('[Tactical Micro-interactions] Testing Quick Wear and Favorite on active piece...');
    const microInteractionsResult = await cdp.eval(`(() => {
      // 1. Click Quick Wear button
      const wearBtn = document.querySelector('button[aria-label^="Log wearing"]');
      let wearClicked = false;
      if (wearBtn) {
        wearBtn.click();
        wearClicked = true;
      }

      // 2. Click Favorite button on active card
      const activeCard = document.querySelector('article[data-active="true"]');
      const favBtn = activeCard ? activeCard.querySelector('button[aria-label*="favorites"]') : null;
      let favClicked = false;
      if (favBtn) {
        favBtn.click();
        favClicked = true;
      }

      return { wearClicked, favClicked };
    })()`);
    console.log('[Micro-interactions Result]:', microInteractionsResult);

    // Wait 400ms for tactile feedback animation
    await new Promise(r => setTimeout(r, 400));

    // Inspect Spatial Rail 3D Transforms and Tactical Feedback
    const railAfterMetrics = await cdp.eval(`(() => {
      const railSection = document.querySelector('section[aria-label="Interactive 3D Spatial Garment Rail"]');
      const cards = railSection ? Array.from(railSection.querySelectorAll('article[aria-roledescription="slide"]')) : [];
      const activeCard = cards.find(c => c.getAttribute('data-active') === 'true');
      const wearFeedbackBtn = railSection ? railSection.querySelector('button[aria-label^="Log wearing"]') : null;

      return {
        activeCardTransform: activeCard ? activeCard.style.transform : null,
        activeCardName: activeCard ? activeCard.querySelector('h4')?.textContent : null,
        wearFeedbackText: wearFeedbackBtn ? wearFeedbackBtn.textContent?.trim() : null,
        activeHeartFilled: activeCard ? Boolean(activeCard.querySelector('svg.fill-accent')) : false,
      };
    })()`);
    console.log('\n--- SPATIAL RAIL AFTER INTERACTION & FEEDBACK METRICS ---');
    console.log(railAfterMetrics);

    // Capture Wardrobe Mobile Screenshot with Newly Selected Focal Garment & Feedback
    console.log('[Screenshot] Capturing Wardrobe Rail Selected Mobile (390px)...');
    await cdp.captureScreenshot(path.join(DIST_DIR, 'screenshot-wardrobe-rail-selected-390.png'));

    // Switch to Desktop viewport to capture Wardrobe Desktop (1280px)
    console.log('[Viewport] Switching to Desktop 1280x900...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await new Promise(r => setTimeout(r, 1000));
    console.log('[Screenshot] Capturing Wardrobe Desktop (1280px)...');
    await cdp.captureScreenshot(path.join(DIST_DIR, 'screenshot-wardrobe-desktop.png'));
    await cdp.captureScreenshot(path.join(DIST_DIR, 'screenshot-wardrobe-rail-desktop.png'));

    // Inspect Wardrobe Desktop elements & images
    const wardrobeInspection = await cdp.eval(`(() => {
      const h1 = document.querySelector('h1.editorial-hero');
      const signatureSection = document.querySelector('section[aria-label="Curated Key Pieces"]');
      const allImages = Array.from(document.querySelectorAll('img')).map(img => ({
        src: img.src.split('/').pop(),
        alt: img.alt,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        complete: img.complete,
      }));
      const fallbackPlates = Array.from(document.querySelectorAll('.font-mono')).filter(el => el.textContent.includes('ATELIER ARCHIVE'));

      return {
        h1FontFamily: h1 ? window.getComputedStyle(h1).fontFamily : 'not found',
        h1FontSize: h1 ? window.getComputedStyle(h1).fontSize : 'not found',
        hasSignatureSection: Boolean(signatureSection),
        loadedImagesCount: allImages.filter(img => img.naturalWidth > 0).length,
        loadedImages: allImages.filter(img => img.naturalWidth > 0),
        archivalPlatesCount: fallbackPlates.length,
      };
    })()`);
    console.log('\n--- WARDROBE INSPECTION ---');
    console.log(wardrobeInspection);

    // Switch back to mobile viewport for Dress Me verification
    console.log('[Viewport] Switching back to Mobile 390x844...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await new Promise(r => setTimeout(r, 600));

    // Switch to DRESS tab
    console.log('[Navigation] Clicking DRESS tab...');
    const switchTabResult = await cdp.eval(`(() => {
      const navButtons = Array.from(document.querySelectorAll('nav button'));
      const dressBtn = navButtons.find(b => b.getAttribute('aria-label') === 'DRESS' || b.textContent.includes('DRESS'));
      if (dressBtn) {
        dressBtn.click();
        return 'Clicked DRESS tab';
      }
      return 'DRESS tab button not found';
    })()`);
    console.log('[Navigation] Result:', switchTabResult);

    // Wait for recommendation outfit cards or content to render
    for (let i = 0; i < 25; i++) {
      const outfitCards = await cdp.eval(`document.querySelectorAll('article').length`);
      if (outfitCards > 0) {
        console.log(`[Dress Me] ${outfitCards} outfit cards rendered!`);
        break;
      }
      await new Promise(r => setTimeout(r, 200));
    }

    // VERIFY FONTS & COMPUTED STYLES
    console.log('\n--- 2. FONT VERIFICATION IN RUNNING BROWSER ---');

    const fontChecks = await cdp.eval(`(() => {
      const allFonts = Array.from(document.fonts).map(f => ({
        family: f.family,
        weight: f.weight,
        style: f.style,
        status: f.status,
      }));
      return {
        cormorantRegular: document.fonts.check('400 32px "Cormorant Garamond"'),
        cormorantItalic: document.fonts.check('italic 400 16px "Cormorant Garamond"'),
        interCheck: document.fonts.check('14px "Inter"'),
        inter400Check: document.fonts.check('400 14px "Inter"'),
        allFontsLoaded: document.fonts.status,
        fontsList: allFonts,
      };
    })()`);
    console.log('[document.fonts.check]:', fontChecks);

    // Check font network requests
    console.log('\n--- 3. NETWORK FONT REQUESTS STATUS ---');
    const fontRequests = cdp.networkRequests.filter(r => r.url && r.url.includes('/fonts/'));
    console.log(`Captured ${fontRequests.length} local font network requests:`);
    fontRequests.forEach(r => {
      console.log(` - ${r.url}: Status ${r.status} (${r.mimeType})`);
    });

    // Inspect body and paragraph computed font family
    const bodyInspection = await cdp.eval(`(() => {
      const body = document.body;
      const p = document.querySelector('p');
      const bodyComp = window.getComputedStyle(body);
      const pComp = p ? window.getComputedStyle(p) : null;
      return {
        bodyFontFamily: bodyComp.fontFamily,
        pFontFamily: pComp ? pComp.fontFamily : 'no p tag',
      };
    })()`);
    console.log('[Body & Paragraph Inspection]:', bodyInspection);

    // Call document.fonts.load for Inter
    const interLoadResult = await cdp.eval(`(async () => {
      try {
        const loaded = await document.fonts.load('14px "Inter"');
        return {
          loadedCount: loaded.length,
          interCheckedAfterLoad: document.fonts.check('14px "Inter"'),
        };
      } catch (e) {
        return { error: e.toString() };
      }
    })()`);
    console.log('[Inter Explicit Load Test]:', interLoadResult);
    console.log('\n--- 4. DOM HEADING ELEMENT & COMPUTED STYLES ---');
    const headingInspection = await cdp.eval(`(() => {
      const h1 = document.querySelector('h1.editorial-hero') || document.querySelector('h1');
      if (!h1) return { error: 'No h1 element found' };

      const computed = window.getComputedStyle(h1);
      return {
        tagName: h1.tagName,
        className: h1.className,
        textContent: h1.textContent.trim(),
        computedFontFamily: computed.fontFamily,
        computedFontSize: computed.fontSize,
        computedLineHeight: computed.lineHeight,
        computedLetterSpacing: computed.letterSpacing,
        computedColor: computed.color,
      };
    })()`);
    console.log('[Heading Inspection]:', headingInspection);

    // Inspect look title heading in OutfitCard
    const lookTitleInspection = await cdp.eval(`(() => {
      const h3 = document.querySelector('h3.editorial-headline') || document.querySelector('article h3');
      if (!h3) return { warning: 'No outfit card h3 found (might need sample wardrobe)' };

      const computed = window.getComputedStyle(h3);
      return {
        tagName: h3.tagName,
        className: h3.className,
        textContent: h3.textContent.trim(),
        computedFontFamily: computed.fontFamily,
        computedFontSize: computed.fontSize,
      };
    })()`);
    console.log('[Look Title Inspection]:', lookTitleInspection);

    // Capture Dress Me Screen Screenshot
    await cdp.captureScreenshot(path.join(DIST_DIR, 'screenshot-dressme-390.png'));
    await cdp.captureScreenshot(path.join(DIST_DIR, 'screenshot-cinematic-spotlight-390.png'));

    // MILESTONE D: Inspect Cinematic Spotlight & Storytelling Elements
    console.log('\n--- 4.5. MILESTONE D: CINEMATIC DRESS ME EXPERIENCE ---');
    const cinematicMetrics = await cdp.eval(`(() => {
      const banner = document.querySelector('.editorial-kicker');
      const spotlightBar = Array.from(document.querySelectorAll('span')).find(s => s.textContent?.includes('CINEMATIC SPOTLIGHT') || s.textContent?.includes('DAILY CURATION'));
      const storytelling = Array.from(document.querySelectorAll('strong')).map(s => s.textContent?.trim());
      const atelierBtn = document.querySelector('button[aria-label="Open in 3D Atelier"]');
      const nextLookBtn = document.querySelector('button[aria-label="Next revealed look"]');
      const feedLayoutBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'All Looks');
      const parallelPills = Array.from(document.querySelectorAll('button')).filter(b => b.getAttribute('aria-label')?.includes('Switch to Look'));

      return {
        hasSpotlightBar: Boolean(spotlightBar),
        spotlightText: spotlightBar ? spotlightBar.textContent?.trim() : null,
        storytellingTags: storytelling,
        hasAtelierButtonOnCard: Boolean(atelierBtn),
        hasNextLookButton: Boolean(nextLookBtn),
        hasFeedLayoutButton: Boolean(feedLayoutBtn),
        parallelPillsCount: parallelPills.length,
      };
    })()`);
    console.log('[Cinematic Daily Edit Metrics]:', cinematicMetrics);

    // Switch to Desktop 1280x900 for Cinematic Spotlight Desktop
    console.log('[Viewport] Switching to Desktop 1280x900 for Cinematic Spotlight...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await new Promise(r => setTimeout(r, 800));
    console.log('[Screenshot] Capturing Cinematic Spotlight Desktop (1280px)...');
    await cdp.captureScreenshot(path.join(DIST_DIR, 'screenshot-cinematic-spotlight-desktop.png'));

    // Switch back to mobile viewport
    console.log('[Viewport] Switching back to Mobile 390x844...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await new Promise(r => setTimeout(r, 600));

    // Test Cinematic Look Paging (Next Look)
    console.log('[Cinematic Reveal] Clicking Next revealed look...');
    const pageNextResult = await cdp.eval(`(() => {
      const nextBtn = document.querySelector('button[aria-label="Next revealed look"]');
      if (nextBtn) {
        nextBtn.click();
        return 'Clicked Next revealed look button';
      }
      return 'Next revealed look button not found';
    })()`);
    console.log('[Cinematic Paging Result]:', pageNextResult);
    await new Promise(r => setTimeout(r, 800));
    console.log('[Screenshot] Capturing Look 02 Cinematic Reveal (390px)...');
    await cdp.captureScreenshot(path.join(DIST_DIR, 'screenshot-cinematic-revealed-look2-390.png'));

    // Test Layout Switch to "All Looks" Feed
    console.log('[Layout Switch] Switching to All Looks feed...');
    const switchFeedResult = await cdp.eval(`(() => {
      const feedBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'All Looks');
      if (feedBtn) {
        feedBtn.click();
        return 'Clicked All Looks layout button';
      }
      return 'All Looks button not found';
    })()`);
    console.log('[Layout Switch Result]:', switchFeedResult);
    await new Promise(r => setTimeout(r, 800));
    console.log('[Screenshot] Capturing All Looks Feed layout (390px)...');
    await cdp.captureScreenshot(path.join(DIST_DIR, 'screenshot-cinematic-feed-390.png'));

    // Switch back to Spotlight layout
    await cdp.eval(`(() => {
      const spotBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Spotlight');
      if (spotBtn) spotBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 500));

    // Test Garment Inspection from OutfitCard
    console.log('[Garment Inspection] Clicking hero piece image in OutfitCard...');
    const inspectHeroResult = await cdp.eval(`(() => {
      const heroFrame = document.querySelector('div[title^="Inspect "]');
      if (heroFrame) {
        const title = heroFrame.getAttribute('title');
        heroFrame.click();
        return 'Clicked hero frame: ' + title;
      }
      return 'Inspectable hero frame not found';
    })()`);
    console.log('[Garment Inspection Action]:', inspectHeroResult);
    await new Promise(r => setTimeout(r, 800));
    console.log('[Screenshot] Capturing Garment Inspection Sheet (390px)...');
    await cdp.captureScreenshot(path.join(DIST_DIR, 'screenshot-garment-inspection-390.png'));

    // Close ItemDetailSheet
    await cdp.eval(`(() => {
      const closeBtn = document.querySelector('button[aria-label="Close dialog"]') || document.querySelector('button[aria-label="Close"]');
      if (closeBtn) closeBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 400));

    // Test Saved Looks Modal
    console.log('\n--- 5. SAVED LOOKS MODAL INTERACTION ---');
    const openSavedResult = await cdp.eval(`(() => {
      const btn = document.querySelector('button[aria-label="Open saved looks"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Saved'));
      if (btn) {
        btn.click();
        return 'Clicked Saved Looks button';
      }
      return 'Saved Looks button not found';
    })()`);
    console.log('[Saved Looks Action]:', openSavedResult);
    await new Promise(r => setTimeout(r, 600));
    await cdp.captureScreenshot(path.join(DIST_DIR, 'screenshot-saved-looks-390.png'));

    // Close Saved Looks Modal
    await cdp.eval(`(() => {
      const closeBtn = document.querySelector('button[aria-label="Close dialog"]') || document.querySelector('button[aria-label="Close"]');
      if (closeBtn) closeBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 400));

    // Test Anchor Item Modal
    console.log('\n--- 6. ANCHOR PIECE STUDIO INTERACTION ---');
    const openAnchorResult = await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Style Around Piece'));
      if (btn) {
        btn.click();
        return 'Clicked Style Around Piece button';
      }
      return 'Style Around Piece button not found';
    })()`);
    console.log('[Anchor Action]:', openAnchorResult);
    await new Promise(r => setTimeout(r, 600));
    await cdp.captureScreenshot(path.join(DIST_DIR, 'screenshot-anchor-studio-390.png'));

    // MILESTONE C: Select Anchor Garment & Enter 3D Outfit Atelier
    console.log('\n--- 7. MILESTONE C: LOCK ANCHOR & 3D ATELIER STAGE ---');
    const selectAnchorResult = await cdp.eval(`(() => {
      const modal = document.querySelector('[role="dialog"]') || document.body;
      const itemButtons = Array.from(modal.querySelectorAll('button')).filter(b => b.querySelector('h5'));
      if (itemButtons.length > 0) {
        // Select an iconic hero garment: kurta, kurti, shirt, or bundi
        const targetBtn = itemButtons.find(b => {
          const text = b.textContent?.toLowerCase() || '';
          return text.includes('kurta') || text.includes('kurti') || text.includes('shirt') || text.includes('jeans');
        }) || itemButtons[0];

        const name = targetBtn.querySelector('h5')?.textContent?.trim();
        targetBtn.click();
        return 'Selected anchor: ' + name;
      }
      return 'No anchor item buttons found in modal';
    })()`);
    console.log('[Anchor Selection Result]:', selectAnchorResult);
    await new Promise(r => setTimeout(r, 1000));

    // Inspect 3D Outfit Atelier Stage Metrics
    const atelierMetrics = await cdp.eval(`(() => {
      const stage = document.querySelector('section[aria-label^="Outfit Atelier Stage"]');
      if (!stage) return { error: 'OutfitAtelierStage not mounted' };

      const anchorSlot = stage.querySelector('[data-anchor="true"]');
      const allSlots = Array.from(stage.querySelectorAll('[data-testid^="atelier-slot-"]'));
      const headerTitle = stage.querySelector('h3')?.textContent?.trim();
      const compatibilityBadge = stage.querySelector('span[class*="emerald"]')?.textContent?.trim();
      const whyReasons = Array.from(stage.querySelectorAll('span')).filter(s => s.textContent?.includes('✦')).map(s => s.textContent.trim());

      return {
        hasStage: true,
        headerTitle,
        compatibilityBadge,
        whyReasonsCount: whyReasons.length,
        whyReasons,
        slotsCount: allSlots.length,
        anchorName: anchorSlot ? anchorSlot.querySelector('h5')?.textContent?.trim() : null,
        anchorTransform: anchorSlot ? anchorSlot.style.transform : null,
        anchorZIndex: anchorSlot ? anchorSlot.style.zIndex : null,
        coordinatingTransforms: allSlots.filter(s => s !== anchorSlot).map(s => ({
          testId: s.getAttribute('data-testid'),
          name: s.querySelector('h5')?.textContent?.trim(),
          transform: s.style.transform,
          zIndex: s.style.zIndex,
        })),
      };
    })()`);
    console.log('\n--- OUTFIT ATELIER 3D STAGE METRICS ---');
    console.log(JSON.stringify(atelierMetrics, null, 2));

    // Capture Atelier Mobile (390px)
    console.log('[Screenshot] Capturing Outfit Atelier Stage Mobile (390px)...');
    await cdp.captureScreenshot(path.join(DIST_DIR, 'screenshot-atelier-stage-390.png'));

    // Switch to Desktop for Atelier Stage Desktop (1280px)
    console.log('[Viewport] Switching to Desktop 1280x900 for Atelier Stage...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await new Promise(r => setTimeout(r, 1000));
    console.log('[Screenshot] Capturing Outfit Atelier Stage Desktop (1280px)...');
    await cdp.captureScreenshot(path.join(DIST_DIR, 'screenshot-atelier-stage-desktop.png'));

    // Switch back to Mobile
    console.log('[Viewport] Switching back to Mobile 390x844...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await new Promise(r => setTimeout(r, 600));

    // Test Alternative Candidate Slot Cycling
    console.log('\n--- 8. ATELIER SLOT CYCLING & INTERACTIVE COMPOSITION ---');
    const cycleResult = await cdp.eval(`(() => {
      const nextBtn = document.querySelector('button[aria-label^="Next "]');
      if (nextBtn) {
        const label = nextBtn.getAttribute('aria-label');
        nextBtn.click();
        return 'Clicked slot cycle: ' + label;
      }
      return 'No slot cycling button found (single candidate in slots)';
    })()`);
    console.log('[Slot Alternative Cycling]:', cycleResult);
    await new Promise(r => setTimeout(r, 600));

    // Capture Composed Variant Screenshot
    console.log('[Screenshot] Capturing Outfit Atelier Composed Mobile (390px)...');
    await cdp.captureScreenshot(path.join(DIST_DIR, 'screenshot-atelier-composed-390.png'));

    // Test Save to Lookbook
    console.log('\n--- 9. SAVE TO LOOKBOOK ACTION ---');
    const saveLookResult = await cdp.eval(`(() => {
      const saveBtn = document.querySelector('button[aria-label="Save this outfit to your lookbook"]');
      if (saveBtn) {
        saveBtn.click();
        return 'Clicked Save Look button';
      }
      return 'Save button not found';
    })()`);
    console.log('[Save Look]:', saveLookResult);
    await new Promise(r => setTimeout(r, 600));

    const saveFeedback = await cdp.eval(`(() => {
      const btn = document.querySelector('button[aria-label="Save this outfit to your lookbook"]');
      return btn ? btn.textContent?.trim() : null;
    })()`);
    console.log('[Save Look Feedback Text]:', saveFeedback);

    // Test Log Wear Today
    console.log('\n--- 10. LOG WEAR TODAY ACTION ---');
    const wearResult = await cdp.eval(`(() => {
      const wearBtn = document.querySelector('button[aria-label="Log that you wore this ensemble today"]');
      if (wearBtn) {
        wearBtn.click();
        return 'Clicked Log Wear button';
      }
      return 'Wear button not found';
    })()`);
    console.log('[Wear Look]:', wearResult);
    await new Promise(r => setTimeout(r, 600));

    const wearFeedback = await cdp.eval(`(() => {
      const btn = document.querySelector('button[aria-label="Log that you wore this ensemble today"]');
      return btn ? btn.textContent?.trim() : null;
    })()`);
    console.log('[Wear Look Feedback Text]:', wearFeedback);

    // --- 11. SPATIAL LOOKBOOK INSPECTION ---
    console.log('\n--- 11. SPATIAL LOOKBOOK INSPECTION ---');
    // Open Lookbook Modal
    const openLookbook = await cdp.eval(`(() => {
      // First switch back to daily view so we see the saved lookbook button
      const dailyBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Daily Edit'));
      if (dailyBtn) dailyBtn.click();
      const savedBtn = document.querySelector('button[aria-label="Open saved looks"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Saved'));
      if (savedBtn) {
        savedBtn.click();
        return 'Opened Lookbook Modal';
      }
      return 'Saved looks button not found';
    })()`);
    console.log('[Lookbook Open]:', openLookbook);
    await new Promise(r => setTimeout(r, 800));

    console.log('[Screenshot] Capturing Spatial Lookbook Mobile (390px)...');
    await cdp.captureScreenshot(path.join(DIST_DIR, 'screenshot-lookbook-spatial-390.png'));

    // Close Lookbook Modal
    await cdp.eval(`(() => {
      const closeBtn = document.querySelector('button[aria-label="Close sheet"]');
      if (closeBtn) closeBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 500));

    // --- 12. OUTFIT CALENDAR INSPECTION ---
    console.log('\n--- 12. OUTFIT CALENDAR INSPECTION ---');
    const navCalendar = await cdp.eval(`(() => {
      const calTab = document.querySelector('button[aria-label="CALENDAR"]');
      if (calTab) {
        calTab.click();
        return 'Navigated to Calendar';
      }
      return 'Calendar tab not found';
    })()`);
    console.log('[Calendar Nav]:', navCalendar);
    await new Promise(r => setTimeout(r, 800));

    console.log('[Screenshot] Capturing Outfit Calendar Editorial Mobile (390px)...');
    await cdp.captureScreenshot(path.join(DIST_DIR, 'screenshot-calendar-editorial-390.png'));

    // Switch to Desktop for Calendar
    console.log('[Viewport] Switching to Desktop 1280x900 for Calendar...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await new Promise(r => setTimeout(r, 800));
    console.log('[Screenshot] Capturing Outfit Calendar Desktop (1280px)...');
    await cdp.captureScreenshot(path.join(DIST_DIR, 'screenshot-calendar-desktop.png'));

    // Switch back to Mobile
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await new Promise(r => setTimeout(r, 600));

    // --- 13. WARDROBE INTELLIGENCE EXHIBITION INSPECTION ---
    console.log('\n--- 13. WARDROBE INTELLIGENCE EXHIBITION INSPECTION ---');
    const navInsight = await cdp.eval(`(() => {
      const insightTab = document.querySelector('button[aria-label="INSIGHT"]');
      if (insightTab) {
        insightTab.click();
        return 'Navigated to Insights';
      }
      return 'Insight tab not found';
    })()`);
    console.log('[Insights Nav]:', navInsight);
    await new Promise(r => setTimeout(r, 800));

    // Switch to "Wear & Style Analytics" tab
    const switchAnalytics = await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Wear & Style Analytics') || b.textContent?.includes('Analytics'));
      if (btn) {
        btn.click();
        return 'Switched to Wear & Style Analytics';
      }
      return 'Analytics tab not found';
    })()`);
    console.log('[Analytics Tab]:', switchAnalytics);
    await new Promise(r => setTimeout(r, 800));

    console.log('[Screenshot] Capturing Wardrobe Intelligence Exhibition Mobile (390px)...');
    await cdp.captureScreenshot(path.join(DIST_DIR, 'screenshot-intelligence-exhibition-390.png'));

    // Switch to Desktop for Intelligence Exhibition
    console.log('[Viewport] Switching to Desktop 1280x900 for Wardrobe Intelligence...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await new Promise(r => setTimeout(r, 800));
    console.log('[Screenshot] Capturing Wardrobe Intelligence Exhibition Desktop (1280px)...');
    await cdp.captureScreenshot(path.join(DIST_DIR, 'screenshot-intelligence-desktop.png'));

    // Switch back to Mobile
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await new Promise(r => setTimeout(r, 600));

    // --- 14. AI STYLIST SALON INSPECTION ---
    console.log('\n--- 14. AI STYLIST SALON INSPECTION ---');
    const openStylist = await cdp.eval(`(() => {
      const aiBtn = document.querySelector('button[aria-label="Open AI Saathi conversation"]') || document.querySelector('aside[aria-label="AI Companions"] button');
      if (aiBtn) {
        aiBtn.click();
        return 'Opened AI Saathi Stylist Salon';
      }
      return 'AI Saathi button not found';
    })()`);
    console.log('[AI Stylist Open]:', openStylist);
    await new Promise(r => setTimeout(r, 800));

    console.log('[Screenshot] Capturing AI Stylist Salon Mobile (390px)...');
    await cdp.captureScreenshot(path.join(DIST_DIR, 'screenshot-ai-stylist-390.png'));

    // Close AI Stylist
    await cdp.eval(`(() => {
      const closeBtn = document.querySelector('button[aria-label="Close chat"]');
      if (closeBtn) closeBtn.click();
    })()`);
    await new Promise(r => setTimeout(r, 500));

    // --- 15. PROFILE & FASHION IDENTITY INSPECTION ---
    console.log('\n--- 15. PROFILE & FASHION IDENTITY INSPECTION ---');
    const navProfile = await cdp.eval(`(() => {
      const youTab = document.querySelector('button[aria-label="YOU"]');
      if (youTab) {
        youTab.click();
        return 'Navigated to You (Profile)';
      }
      return 'You tab not found';
    })()`);
    console.log('[Profile Nav]:', navProfile);
    await new Promise(r => setTimeout(r, 800));

    console.log('[Screenshot] Capturing Profile & Fashion Identity Mobile (390px)...');
    await cdp.captureScreenshot(path.join(DIST_DIR, 'screenshot-profile-identity-390.png'));

    cdp.close();
  } finally {
    chrome.kill();
    server.close();
  }
}

main().catch(err => {
  console.error('[Error in main]:', err);
  process.exit(1);
});
