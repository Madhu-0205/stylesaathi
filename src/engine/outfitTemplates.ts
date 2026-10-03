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
    name: 'Western dress',
    required: { dress: ['Dresses'], footwear: ['Footwear'] },
    optional: { outerwear: ['Outerwear'], accessory: ['Accessories'] },
  },
  {
    name: 'Kurta look',
    required: { top: ['Ethnic'], bottom: ['Bottoms', 'Ethnic'], footwear: ['Footwear'] },
    optional: { dupatta: ['Ethnic'], jacket: ['Ethnic'], accessory: ['Accessories'] },
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
    name: 'Indo-western',
    required: { top: ['Ethnic'], bottom: ['Bottoms'], footwear: ['Footwear'] },
    optional: { outerwear: ['Outerwear'], accessory: ['Accessories'] },
  },
];
