export interface Template {
  name: string;
  required: Record<string, string[]>;
  optional: Record<string, string[]>;
}

export const TEMPLATES: Template[] = [
  {
    name: 'Western',
    required: { top: ['Tops'], bottom: ['Bottoms'], footwear: ['Footwear'] },
    optional: { outerwear: ['Outerwear'], accessory: ['Accessories'] },
  },
  {
    name: 'Tailored Western',
    required: { outerwear: ['Outerwear'], top: ['Tops'], bottom: ['Bottoms'], footwear: ['Footwear'] },
    optional: { accessory: ['Accessories'] },
  },
  {
    name: 'Western dress',
    required: { dress: ['Dresses'], footwear: ['Footwear'] },
    optional: { outerwear: ['Outerwear'], accessory: ['Accessories'] },
  },
  {
    name: 'Kurta look',
    required: { top: ['Ethnic'], bottom: ['Bottoms', 'Ethnic'], footwear: ['Footwear'] },
    optional: { jacket: ['Ethnic'], accessory: ['Accessories'] },
  },
  {
    name: 'Kurta with dupatta',
    required: { top: ['Ethnic'], bottom: ['Bottoms', 'Ethnic'], dupatta: ['Ethnic'], footwear: ['Footwear'] },
    optional: { accessory: ['Accessories'] },
  },
  {
    name: 'Kurta & Nehru jacket',
    required: { top: ['Ethnic'], jacket: ['Ethnic'], bottom: ['Bottoms', 'Ethnic'], footwear: ['Footwear'] },
    optional: { accessory: ['Accessories'] },
  },
  {
    name: 'Saree look',
    required: { saree: ['Ethnic'], blouse: ['Ethnic'], footwear: ['Footwear'] },
    optional: { accessory: ['Accessories'] },
  },
  {
    name: 'Salwar/lehenga set',
    required: { set: ['Ethnic'], dupatta: ['Ethnic'], footwear: ['Footwear'] },
    optional: { accessory: ['Accessories'] },
  },
  {
    name: 'Lehenga ensemble',
    required: { blouse: ['Ethnic', 'Tops'], lehenga: ['Ethnic'], dupatta: ['Ethnic'], footwear: ['Footwear'] },
    optional: { accessory: ['Accessories'] },
  },
  {
    name: 'Anarkali look',
    required: { top: ['Ethnic'], dupatta: ['Ethnic'], footwear: ['Footwear'] },
    optional: { bottom: ['Ethnic', 'Bottoms'], accessory: ['Accessories'] },
  },
  {
    name: 'Indo-western',
    required: { top: ['Ethnic'], bottom: ['Bottoms'], footwear: ['Footwear'] },
    optional: { outerwear: ['Outerwear'], accessory: ['Accessories'] },
  },
  {
    name: 'Indo-western tailored',
    required: { outerwear: ['Outerwear'], top: ['Ethnic'], bottom: ['Bottoms'], footwear: ['Footwear'] },
    optional: { accessory: ['Accessories'] },
  },
];
