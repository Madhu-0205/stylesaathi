import { describe, it, expect } from 'vitest';
import { parseSaathiIntent, getOccasionSpecificity } from '../intentParser';

describe('Occasion Parser Stabilization Audit', () => {
  describe('Specific Occasion vs General Setting Precedence', () => {
    it('Case 1: "Suggest an outfit for college." resolves to ordinary college (formality ~1.8)', () => {
      const res = parseSaathiIntent('Suggest an outfit for college.');
      expect(res.entities.occasion).toBe('college');
      expect(res.intent).toBe('RECOMMEND_OUTFIT');
    });

    it('Case 2: "I have a presentation at college." resolves to office presentation (formality ~3.8), not downgraded to college', () => {
      const res = parseSaathiIntent('I have a presentation at college.');
      expect(res.entities.occasion).toBe('office');
      expect(res.entities.occasionContext).toContain('college presentation');
      expect(res.intent).toBe('RECOMMEND_OUTFIT');
    });

    it('Case 3: "I have a formal presentation tomorrow." resolves to office with date tomorrow', () => {
      const res = parseSaathiIntent('I have a formal presentation tomorrow.');
      expect(res.entities.occasion).toBe('office');
      expect(res.entities.relativeDate).toBe('tomorrow');
      expect(res.intent).toBe('RECOMMEND_OUTFIT');
    });

    it('Case 4: "I have a casual college event." resolves to college occasion', () => {
      const res = parseSaathiIntent('I have a casual college event.');
      expect(res.entities.occasion).toBe('college');
      expect(res.entities.occasionContext).toBe('casual college event');
      expect(res.intent).toBe('RECOMMEND_OUTFIT');
    });

    it('Case 5: "I have an interview at my college." resolves to interview (formality ~4.5), not downgraded to college', () => {
      const res = parseSaathiIntent('I have an interview at my college.');
      expect(res.entities.occasion).toBe('interview');
      expect(res.entities.occasionContext).toContain('college interview');
      expect(res.intent).toBe('RECOMMEND_OUTFIT');
    });

    it('Case 6: "I have a presentation followed by a casual event." splits into primary office and secondary casual outing', () => {
      const res = parseSaathiIntent('I have a presentation followed by a casual event.');
      expect(res.entities.occasion).toBe('office');
      expect(res.entities.secondaryOccasion).toBe('casual outing');
      expect(res.entities.occasionContext).toContain('presentation followed by');
      expect(res.intent).toBe('RECOMMEND_OUTFIT');
    });

    it('Case 7: Keyword ordering invariant: activity wins regardless of setting placement', () => {
      const v1 = parseSaathiIntent('presentation at college');
      const v2 = parseSaathiIntent('college presentation');
      const v3 = parseSaathiIntent('At my college I have a presentation');
      expect(v1.entities.occasion).toBe('office');
      expect(v2.entities.occasion).toBe('office');
      expect(v3.entities.occasion).toBe('office');

      const i1 = parseSaathiIntent('interview at college');
      const i2 = parseSaathiIntent('college interview');
      const i3 = parseSaathiIntent('At my college I have an interview tomorrow');
      expect(i1.entities.occasion).toBe('interview');
      expect(i2.entities.occasion).toBe('interview');
      expect(i3.entities.occasion).toBe('interview');
    });
  });

  describe('Occasion Specificity Metrics', () => {
    it('assigns higher specificity to specific activities than environmental settings', () => {
      const interviewSpec = getOccasionSpecificity('interview', 'interview');
      const presentationSpec = getOccasionSpecificity('presentation', 'office');
      const weddingSpec = getOccasionSpecificity('wedding', 'wedding guest');
      const collegeSpec = getOccasionSpecificity('college', 'college');
      const officeSpec = getOccasionSpecificity('office', 'office');
      const everydaySpec = getOccasionSpecificity('everyday', 'everyday');

      expect(interviewSpec).toBeGreaterThan(collegeSpec);
      expect(presentationSpec).toBeGreaterThan(collegeSpec);
      expect(weddingSpec).toBeGreaterThan(collegeSpec);
      expect(collegeSpec).toBeGreaterThanOrEqual(everydaySpec);
      expect(presentationSpec).toBeGreaterThan(officeSpec);
    });
  });

  describe('Constraint Removal & Anchor Unlock Detection', () => {
    it('detects "without the jacket" as removedRole = layer and intent SWAP_PIECE', () => {
      const res = parseSaathiIntent('without the jacket');
      expect(res.entities.removedRole).toBe('layer');
      expect(res.intent).toBe('SWAP_PIECE');
    });

    it('detects "no blazer" as removedRole = layer and intent SWAP_PIECE', () => {
      const res = parseSaathiIntent('no blazer');
      expect(res.entities.removedRole).toBe('layer');
      expect(res.intent).toBe('SWAP_PIECE');
    });

    it('detects "unlock anchor" as unlockedAnchor = true and intent SHOW_ALTERNATIVE', () => {
      const res = parseSaathiIntent('unlock anchor');
      expect(res.entities.unlockedAnchor).toBe(true);
      expect(res.intent).toBe('SHOW_ALTERNATIVE');
    });

    it('detects "no anchor" as unlockedAnchor = true', () => {
      const res = parseSaathiIntent('no anchor');
      expect(res.entities.unlockedAnchor).toBe(true);
    });

    it('detects "change everything" as unlockedAnchor = true', () => {
      const res = parseSaathiIntent('change everything');
      expect(res.entities.unlockedAnchor).toBe(true);
    });
  });
});

