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

export function getWardrobeAsset(id: string): string | null {
  return wardrobeAssets[id] || null;
}
