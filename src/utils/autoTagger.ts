import { autoTagImage, AutoTagResult } from '../services/autoTag';
export type { AutoTagResult };

export interface AutoTagger {
  analyze(file: File): Promise<AutoTagResult>;
}

export class MockAutoTagger implements AutoTagger {
  async analyze(file: File): Promise<AutoTagResult> {
    return autoTagImage(file);
  }
}

export const autoTagger: AutoTagger = new MockAutoTagger();
