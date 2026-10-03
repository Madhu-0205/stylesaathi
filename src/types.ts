export type Category='Tops'|'Bottoms'|'Ethnic'|'Dresses'|'Outerwear'|'Footwear'|'Accessories';
export type Subcategory='t-shirt'|'shirt'|'crop top'|'hoodie'|'sweater'|'jeans'|'trousers'|'shorts'|'skirt'|'leggings'|'joggers'|'kurta'|'kurti'|'saree'|'blouse'|'lehenga'|'salwar set'|'sherwani'|'palazzo'|'churidar'|'dupatta'|'nehru jacket'|'western dress'|'co-ord set'|'jacket'|'blazer'|'shrug'|'sneakers'|'formal shoes'|'heels'|'flats'|'sandals'|'juttis'|'kolhapuris'|'bag'|'watch'|'jewellery'|'belt'|'sunglasses'|'scarf';
export type Season='summer'|'monsoon'|'winter';
export type Occasion='college'|'office'|'casual outing'|'date'|'party'|'family function'|'wedding guest'|'Diwali'|'Holi'|'Eid'|'puja'|'travel';
export type Status='clean'|'needs_washing'|'in_laundry';
export interface Item{ id:string; name:string; photo?:string; category:Category; subcategory:Subcategory; colors:string[]; seasons:Season[]; occasions:Occasion[]; formality:number; brand?:string; status:Status; favorite:boolean; note:string; timesWorn:number; }
export interface Outfit{template:string; slots:Record<string,Item[]>; score:number; why:string;}
