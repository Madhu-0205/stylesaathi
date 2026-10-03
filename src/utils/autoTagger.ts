import { AutoTagResult, Category, Subcategory, Occasion } from '../types';

export interface AutoTagger {
  analyze(file: File): Promise<AutoTagResult>;
}

export class MockAutoTagger implements AutoTagger {
  async analyze(file: File): Promise<AutoTagResult> {
    const fn = file.name.toLowerCase();

    // Intelligent filename heuristic for demo/testing convenience
    let category: Category = 'Tops';
    let subcategory: Subcategory = 't-shirt';
    let colors = ['white'];
    let occasions: Occasion[] = ['college', 'casual outing'];
    let formality = 2;

    if (fn.includes('kurta') || fn.includes('kurti')) {
      category = 'Ethnic';
      subcategory = fn.includes('kurti') ? 'kurti' : 'kurta';
      occasions = ['college', 'family function', 'puja'];
      formality = 3;
      colors = ['white', 'cream'];
    } else if (fn.includes('saree')) {
      category = 'Ethnic';
      subcategory = 'saree';
      occasions = ['wedding guest', 'Diwali', 'party'];
      formality = 5;
      colors = ['black', 'gold'];
    } else if (fn.includes('lehenga')) {
      category = 'Ethnic';
      subcategory = 'lehenga';
      occasions = ['wedding guest', 'Diwali'];
      formality = 5;
      colors = ['navy', 'pink'];
    } else if (fn.includes('palazzo') || fn.includes('churidar')) {
      category = 'Ethnic';
      subcategory = fn.includes('palazzo') ? 'palazzo' : 'churidar';
      occasions = ['college', 'family function', 'puja'];
      formality = 3;
      colors = ['cream', 'beige'];
    } else if (fn.includes('jean') || fn.includes('denim')) {
      category = 'Bottoms';
      subcategory = 'jeans';
      occasions = ['college', 'casual outing', 'date', 'travel'];
      formality = 2;
      colors = ['blue'];
    } else if (fn.includes('trouser') || fn.includes('pant')) {
      category = 'Bottoms';
      subcategory = 'trousers';
      occasions = ['office', 'college', 'date'];
      formality = 3;
      colors = ['black', 'beige'];
    } else if (fn.includes('dress')) {
      category = 'Dresses';
      subcategory = 'western dress';
      occasions = ['date', 'party', 'casual outing'];
      formality = 3;
      colors = ['black'];
    } else if (fn.includes('jacket') || fn.includes('blazer')) {
      category = 'Outerwear';
      subcategory = fn.includes('blazer') ? 'blazer' : 'jacket';
      occasions = ['office', 'party', 'date'];
      formality = 4;
      colors = ['black', 'blue'];
    } else if (fn.includes('sneaker') || fn.includes('shoe')) {
      category = 'Footwear';
      subcategory = 'sneakers';
      occasions = ['college', 'casual outing', 'travel'];
      formality = 2;
      colors = ['white'];
    } else if (fn.includes('jutti') || fn.includes('kolhapuri')) {
      category = 'Footwear';
      subcategory = 'juttis';
      occasions = ['wedding guest', 'Diwali', 'puja'];
      formality = 4;
      colors = ['mustard', 'gold'];
    } else if (fn.includes('shirt')) {
      category = 'Tops';
      subcategory = 'shirt';
      occasions = ['college', 'office', 'date'];
      formality = 3;
      colors = ['blue', 'white'];
    }

    return {
      category,
      subcategory,
      colors,
      occasions,
      formality,
      confidence: 0.88,
      note: 'Auto-detected tags. Tap any tag to refine.',
    };
  }
}

export const autoTagger: AutoTagger = new MockAutoTagger();
