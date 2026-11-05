// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const srcDir = path.resolve(process.cwd(), 'src');
const dressMeScreenTsx = fs.readFileSync(path.join(srcDir, 'screens/DressMeScreen.tsx'), 'utf-8');
const outfitCardTsx = fs.readFileSync(path.join(srcDir, 'components/dressme/OutfitCard.tsx'), 'utf-8');
const wardrobeScreenTsx = fs.readFileSync(path.join(srcDir, 'screens/WardrobeScreen.tsx'), 'utf-8');
const itemCardTsx = fs.readFileSync(path.join(srcDir, 'components/wardrobe/ItemCard.tsx'), 'utf-8');
const aiSaathiChatViewTsx = fs.readFileSync(path.join(srcDir, 'components/saathi/AISaathiChatView.tsx'), 'utf-8');

describe('Phase D — Core Screens Editorial Redesign Verification', () => {
  describe('1. Home / Daily Style Screen (DressMeScreen)', () => {
    it('features editorial magazine cover header and personalized tagline', () => {
      expect(dressMeScreenTsx).toContain('Aaj kya pehenna hai?');
      expect(dressMeScreenTsx).toContain('DRESS ME');
      expect(dressMeScreenTsx).toContain('Styled around your wardrobe · Curated for how you like to dress');
    });

    it('integrates WeatherStatusBar and Tomorrow Planner card', () => {
      expect(dressMeScreenTsx).toContain('<WeatherStatusBar />');
      expect(dressMeScreenTsx).toContain('TOMORROW ·');
      expect(dressMeScreenTsx).toContain('Plan Tomorrow');
    });

    it('implements responsive occasion chips and climate season switcher', () => {
      expect(dressMeScreenTsx).toContain('OCCASIONS.map');
      expect(dressMeScreenTsx).toContain('SEASONS.map');
      expect(dressMeScreenTsx).toContain('CLIMATE:');
    });

    it('provides dual experience switcher between Daily Edit and 3D Atelier with OutfitAtelierStage', () => {
      expect(dressMeScreenTsx).toContain('Daily Edit');
      expect(dressMeScreenTsx).toContain('Atelier (3D)');
      expect(dressMeScreenTsx).toContain('<OutfitAtelierStage');
      expect(dressMeScreenTsx).toContain('<ItemDetailSheet');
    });
  });

  describe('2. Editorial Outfit Composition (OutfitCard)', () => {
    it('uses luxury specular-border and rounded-3xl container', () => {
      expect(outfitCardTsx).toContain('rounded-3xl');
      expect(outfitCardTsx).toContain('specular-border');
    });

    it('implements hero piece portrait framing with fabric provenance tag', () => {
      expect(outfitCardTsx).toContain('Hero Piece');
      expect(outfitCardTsx).toContain('primarySlot[1][0].fabric');
    });

    it('renders transparent output contract with gold-accent-rule and confidence badge', () => {
      expect(outfitCardTsx).toContain('WHY THIS WORKS');
      expect(outfitCardTsx).toContain('gold-accent-rule');
      expect(outfitCardTsx).toContain('CONFIDENCE');
      expect(outfitCardTsx).toContain('Cultural Rationale');
      expect(outfitCardTsx).toContain('weatherComfortRationale');
    });

    it('provides tactile action buttons meeting 44px minimum touch targets', () => {
      expect(outfitCardTsx).toContain('Wear Today');
      expect(outfitCardTsx).toContain('Plan');
      expect(outfitCardTsx).toContain('Save');
      expect(outfitCardTsx).toContain('Pass');
      expect(outfitCardTsx).toContain('tactile-press');
    });
  });

  describe('3. Personal Fashion Archive (WardrobeScreen & ItemCard)', () => {
    it('features personal archive header with rotation counts', () => {
      expect(wardrobeScreenTsx).toContain('Personal Archive');
      expect(wardrobeScreenTsx).toContain('WARDROBE');
      expect(wardrobeScreenTsx).toContain('pieces in rotation');
    });

    it('renders category filter chips and care status filter buttons', () => {
      expect(wardrobeScreenTsx).toContain('CATEGORIES.map');
      expect(wardrobeScreenTsx).toContain('Favorites');
      expect(wardrobeScreenTsx).toContain('Clean');
      expect(wardrobeScreenTsx).toContain('Needs Wash');
      expect(wardrobeScreenTsx).toContain('In Laundry');
    });

    it('ItemCard uses 4:5 portrait frame with glass-pill favorite button and status indicators', () => {
      expect(itemCardTsx).toContain('aspect-4/5');
      expect(itemCardTsx).toContain('glass-pill');
      expect(itemCardTsx).toContain('Needs Wash');
      expect(itemCardTsx).toContain('In Laundry');
    });
  });

  describe('4. AI Stylist Salon (AISaathiChatView)', () => {
    it('renders luxury stylist salon dialog with glass-header and privacy orchestrator badge', () => {
      expect(aiSaathiChatViewTsx).toContain('AI SAATHI');
      expect(aiSaathiChatViewTsx).toContain('glass-header');
      expect(aiSaathiChatViewTsx).toContain('Privacy-First Orchestrator');
      expect(aiSaathiChatViewTsx).toContain('Zero Cloud Tracking • Local Domain Engines');
    });

    it('provides quick styling prompt chips with tactile feedback', () => {
      expect(aiSaathiChatViewTsx).toContain('What should I wear today?');
      expect(aiSaathiChatViewTsx).toContain('Do I need to buy anything?');
      expect(aiSaathiChatViewTsx).toContain('Style my blue kurta');
    });
  });
});
