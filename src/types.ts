export type Category =
  | 'Tops'
  | 'Bottoms'
  | 'Ethnic'
  | 'Dresses'
  | 'Outerwear'
  | 'Footwear'
  | 'Accessories';

export type Subcategory =
  | 't-shirt'
  | 'shirt'
  | 'crop top'
  | 'hoodie'
  | 'sweater'
  | 'jeans'
  | 'trousers'
  | 'shorts'
  | 'skirt'
  | 'leggings'
  | 'joggers'
  | 'kurta'
  | 'kurti'
  | 'anarkali'
  | 'saree'
  | 'blouse'
  | 'lehenga'
  | 'salwar set'
  | 'sherwani'
  | 'palazzo'
  | 'churidar'
  | 'pajama'
  | 'dupatta'
  | 'nehru jacket'
  | 'western dress'
  | 'co-ord set'
  | 'jacket'
  | 'blazer'
  | 'shrug'
  | 'sneakers'
  | 'formal shoes'
  | 'heels'
  | 'flats'
  | 'sandals'
  | 'juttis'
  | 'kolhapuris'
  | 'bag'
  | 'watch'
  | 'jewellery'
  | 'belt'
  | 'sunglasses'
  | 'scarf';

export type Season = 'summer' | 'monsoon' | 'winter';

export type Occasion =
  | 'college'
  | 'everyday'
  | 'office'
  | 'interview'
  | 'casual outing'
  | 'date'
  | 'party'
  | 'family function'
  | 'family gathering'
  | 'puja'
  | 'festive'
  | 'wedding guest'
  | 'celebration'
  | 'Diwali'
  | 'Holi'
  | 'Eid'
  | 'travel';

export type Status = 'clean' | 'needs_washing' | 'in_laundry';

export interface WardrobeItem {
  id: string;
  name: string;
  photo?: string | null;
  photoId?: string;
  category: Category;
  subcategory: Subcategory;
  colors: string[];
  seasons: Season[];
  occasions: Occasion[];
  formality: number;
  brand?: string;
  status: Status;
  favorite: boolean;
  note: string;
  timesWorn: number;
  lastWorn?: number;
  createdAt?: number;
}

// Backward-compatible alias for existing code
export type Item = WardrobeItem;

export interface GeneratedOutfit {
  id?: string;
  template: string;
  slots: Record<string, WardrobeItem[]>;
  score: number;
  why: string;
}

// Backward-compatible alias for existing code
export type Outfit = GeneratedOutfit;

export interface SavedOutfit {
  id: string;
  name?: string;
  outfit: GeneratedOutfit;
  savedAt: number;
}

export interface CandidateItem extends WardrobeItem {
  priceRange?: string;
}

export interface SmartBuyRecommendation {
  candidate: CandidateItem;
  baselineOutfitCount: number;
  simulatedOutfitCount: number;
  newOutfitsUnlocked: number;
  compatibleExistingItems: WardrobeItem[];
  previewOutfits: GeneratedOutfit[];
  reason: string;
}

export type { AutoTagResult } from './services/autoTag';

export interface WardrobeRepository {
  getItems(): Promise<WardrobeItem[]>;
  getItem(id: string): Promise<WardrobeItem | null>;
  addItem(item: WardrobeItem): Promise<void>;
  updateItem(id: string, patch: Partial<WardrobeItem>): Promise<void>;
  deleteItem(id: string): Promise<void>;
  getSavedOutfits(): Promise<SavedOutfit[]>;
  saveOutfit(outfit: GeneratedOutfit): Promise<void>;
  deleteSavedOutfit(id: string): Promise<void>;
  clear(): Promise<void>;
}

export interface WardrobePhotoStore {
  savePhoto(id: string, dataUrl: string): Promise<string>;
  getPhoto(id: string): Promise<string | null>;
  deletePhoto(id: string): Promise<void>;
}
