// Asset mapping registry for sample Indian & Western items
import whiteTeeImg from './tops/white-tee.webp';
import blueShirtImg from './tops/blue-shirt.jpg';
import blueJeansImg from './bottoms/blue-jeans.jpg';
import whiteKurtaImg from './ethnic/chikankari-kurta.jpg';
import blueKurtiImg from './ethnic/indigo-kurta.jpg';
import juttisImg from './footwear/tan-juttis.jpg';

export const wardrobeAssets: Record<string, string> = {
  'sample-white-tee': whiteTeeImg,
  'sample-blue-shirt': blueShirtImg,
  'sample-blue-jeans': blueJeansImg,
  'sample-white-kurta': whiteKurtaImg,
  'sample-blue-kurti': blueKurtiImg,
  'sample-juttis': juttisImg,
};

// Canonical asset basenames for mapping stored paths or production bundle URLs
const assetBasenameMap: Record<string, string> = {
  'white-tee': whiteTeeImg,
  'blue-shirt': blueShirtImg,
  'blue-jeans': blueJeansImg,
  'chikankari-kurta': whiteKurtaImg,
  'white-kurta': whiteKurtaImg,
  'indigo-kurta': blueKurtiImg,
  'blue-kurti': blueKurtiImg,
  'tan-juttis': juttisImg,
  'juttis': juttisImg,
};

export function getWardrobeAsset(id: string): string | null {
  return wardrobeAssets[id] || null;
}

/**
 * Centrally resolves the photograph URL for a wardrobe item.
 * Supports:
 * 1. Sample items mapped in wardrobeAssets (resolves to active bundler asset in both dev & prod).
 * 2. Stored paths from previous production bundles (e.g. /assets/tan-juttis-EZdIDvxm.jpg).
 * 3. User uploads (data URIs, blob URLs, external URLs).
 * Returns null if no photo is available or if item relies on an async IndexedDB photoId.
 */
export function resolveItemPhoto(item: {
  id?: string;
  photo?: string | null;
  photoUrl?: string | null;
  photoId?: string;
}): string | null {
  // 1. If catalog item has a registered asset in wardrobeAssets, use the live bundler asset
  if (item.id && wardrobeAssets[item.id]) {
    return wardrobeAssets[item.id];
  }

  const rawPhoto = item.photo || item.photoUrl;
  if (!rawPhoto) {
    return null;
  }

  // 2. Pass through user-provided data URLs, blob URLs, or external network URLs as-is
  if (
    rawPhoto.startsWith('data:') ||
    rawPhoto.startsWith('blob:') ||
    rawPhoto.startsWith('http://') ||
    rawPhoto.startsWith('https://')
  ) {
    return rawPhoto;
  }

  // 3. For bundled or stored paths (e.g. /assets/tan-juttis-EZdIDvxm.jpg), match against known basenames
  for (const [basename, assetUrl] of Object.entries(assetBasenameMap)) {
    if (rawPhoto.includes(basename)) {
      return assetUrl;
    }
  }

  // 4. Return the raw photo string if no mapping matched
  return rawPhoto;
}
