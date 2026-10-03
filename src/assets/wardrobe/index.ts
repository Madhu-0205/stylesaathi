// Asset mapping registry for sample Indian & Western items
import whiteTeeImg from './tops/white-tee.jpg';

export const wardrobeAssets: Record<string, string> = {
  'sample-white-tee': whiteTeeImg,
};

export function getWardrobeAsset(id: string): string | null {
  return wardrobeAssets[id] || null;
}
