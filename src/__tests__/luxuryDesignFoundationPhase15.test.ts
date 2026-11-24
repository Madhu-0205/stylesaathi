// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const srcDir = path.resolve(process.cwd(), 'src');
const appTsx = fs.readFileSync(path.join(srcDir, 'App.tsx'), 'utf-8');
const bottomNavTsx = fs.readFileSync(path.join(srcDir, 'components/navigation/BottomNav.tsx'), 'utf-8');
const topNavTsx = fs.readFileSync(path.join(srcDir, 'components/navigation/TopNav.tsx'), 'utf-8');
const todayScreenTsx = fs.readFileSync(path.join(srcDir, 'screens/TodayScreen.tsx'), 'utf-8');
const profileScreenTsx = fs.readFileSync(path.join(srcDir, 'screens/ProfileScreen.tsx'), 'utf-8');
const indexCss = fs.readFileSync(path.join(srcDir, 'index.css'), 'utf-8');

describe('StyleSaathi Phase 1.5 — Luxury Design Foundation & App Shell Verification', () => {
  describe('1. Task 1: App Boot & Navigation Hierarchy', () => {
    it('initializes currentTab to Today for returning users', () => {
      expect(appTsx).toContain("const [currentTab, setCurrentTab] = useState<NavTab>('Today');");
      expect(appTsx).not.toContain("const [currentTab, setCurrentTab] = useState<NavTab>('Wardrobe');");
    });

    it('calibrates Android hardware back button to return to Today tab', () => {
      expect(appTsx).toMatch(/useBackButton\(\s*BackButtonPriority\.PRIMARY_TAB,\s*\(\)\s*=>\s*\{\s*setCurrentTab\('Today'\);\s*return true;\s*\},\s*currentTab !== 'Today',\s*'Return to Today Tab'\s*\);/);
    });

    it('navigates to Today when tapping brand logos in TopNav and mobile header', () => {
      expect(appTsx).toContain("onClick={() => setCurrentTab('Today')}");
      expect(topNavTsx).toContain("onClick={() => onChangeTab('Today')}");
    });

    it('preserves onboarding, auth guard, and progressive wardrobe setup in boot hierarchy', () => {
      expect(appTsx).toContain('!onboarded ?');
      expect(appTsx).toContain("status === 'unauthenticated' ?");
      expect(appTsx).toContain('!setupCompleted ?');
    });
  });

  describe('2. Task 2: Five-Tab Mobile Navigation & Route Retention', () => {
    it('streamlines mobile BottomNav to exactly 5 core tabs (Today, Wardrobe, Dress, Calendar, You)', () => {
      expect(bottomNavTsx).toContain("id: 'Today', label: 'TODAY'");
      expect(bottomNavTsx).toContain("id: 'Wardrobe', label: 'WARDROBE'");
      expect(bottomNavTsx).toContain("id: 'Dress', label: 'DRESS'");
      expect(bottomNavTsx).toContain("id: 'Calendar', label: 'CALENDAR'");
      expect(bottomNavTsx).toContain("id: 'You', label: 'YOU'");
      expect(bottomNavTsx).toContain('grid grid-cols-5');
      expect(bottomNavTsx).not.toContain('grid-cols-6');
    });

    it('guarantees >= 44px touch targets and legible >= 10px uppercase labels', () => {
      expect(bottomNavTsx).toContain('min-h-12');
      expect(bottomNavTsx).toContain('text-[10px]');
      expect(bottomNavTsx).not.toContain('text-[7.5px]');
    });

    it('preserves NavTab type definition and INSIGHT route retention', () => {
      expect(bottomNavTsx).toContain("export type NavTab = 'Today' | 'Wardrobe' | 'Dress' | 'Calendar' | 'Insight' | 'You';");
      expect(bottomNavTsx).toContain('INSIGHT');
    });

    it('exposes Wardrobe Intelligence, Smart Buy & Wear Analytics from You (ProfileScreen)', () => {
      expect(profileScreenTsx).toContain('WARDROBE INTELLIGENCE');
      expect(profileScreenTsx).toContain('Smart Buy & Wardrobe Gaps');
      expect(profileScreenTsx).toContain('Wear & Rotation Analytics');
      expect(profileScreenTsx).toContain("onNavigateTab?.('Insight')");
      expect(appTsx).toContain('<ProfileScreen onNavigateTab={setCurrentTab} />');
    });
  });

  describe('3. Task 3: AI Saathi & Ask AI Companion Hub', () => {
    it('unifies AI Saathi and Ask AI in a single accessible floating hub', () => {
      expect(appTsx).toContain('role="region"');
      expect(appTsx).toContain('aria-label="AI Companions"');
      expect(appTsx).toContain('safe-floating-ai');
      expect(appTsx).toContain('glass-pill');
    });

    it('provides accessible >=44px touch targets (min-h-11) with tactile divider', () => {
      expect(appTsx).toContain('aria-label="Open AI Saathi conversation"');
      expect(appTsx).toContain('aria-label="Open Ask AI command palette (Command + K)"');
      expect(appTsx).toContain('<div className="h-4 w-px bg-border/80 mx-0.5" aria-hidden="true" />');
    });
  });

  describe('4. Task 4: Today Context Calibration', () => {
    it('removes hardcoded college occasion default in TodayScreen', () => {
      expect(todayScreenTsx).not.toMatch(/const \[activeOccasion,\s*setActiveOccasion\]\s*=\s*useState<Occasion>\('college'\);/);
    });

    it('dynamically calibrates activeOccasion based on user preferences with everyday fallback', () => {
      expect(todayScreenTsx).toContain('const mapContextToOccasion = (ctx?: string): Occasion => {');
      expect(todayScreenTsx).toContain('const calibratedDefaultOccasion = useMemo<Occasion>');
      expect(todayScreenTsx).toContain('setActiveOccasion(calibratedDefaultOccasion)');
      expect(todayScreenTsx).toContain('setHasManuallySwitchedOccasion(true)');
    });
  });

  describe('5. Task 5: Shared Design Tokens & Material Foundation', () => {
    it('defines official luxury color tokens in index.css', () => {
      expect(indexCss).toContain('--ivory: #F8F5F0');
      expect(indexCss).toContain('--paper: #FFFDF9');
      expect(indexCss).toContain('--ink: #121110');
      expect(indexCss).toContain('--kumkum: #8A1B36');
      expect(indexCss).toContain('--burnished-gold: #9E7B3B');
    });

    it('binds Cormorant Garamond display serif and Inter sans typography', () => {
      expect(indexCss).toContain("font-family: 'Cormorant Garamond'");
      expect(indexCss).toContain("font-family: 'Inter'");
      expect(indexCss).toContain("--font-serif: 'Cormorant Garamond'");
      expect(indexCss).toContain("--font-sans: 'Inter'");
    });
  });
});

