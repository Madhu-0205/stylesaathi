/**
 * StyleSaathi 4.0 — Designer's Edit Catalog
 *
 * Curated editorial philosophies, regional handloom textile traditions,
 * color harmonies, and verified principles of Indian & contemporary fashion.
 * Strictly educational, deterministic, and grounded in verified craft traditions.
 */

export interface ColorPalette {
  name: string;
  hexCodes: string[];
  description: string;
}

export interface TextileTradition {
  name: string;
  region: string;
  technique: string;
  description: string;
  bestSeason: 'Summer' | 'Monsoon' | 'Winter' | 'Transitional' | 'All Year';
  historicalSignificance: string;
}

export interface SilhouetteGuidelines {
  proportions: string;
  top: string;
  bottom: string;
  layering: string;
  footwear: string;
}

export interface EditorialPhilosophy {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  corePrinciples: string[];
  recommendedPalettes: ColorPalette[];
  textileTraditions: TextileTradition[];
  silhouetteGuide: SilhouetteGuidelines;
  verifiedSources: string[];
  outfitKeywords: string[];
}

export const DESIGNERS_EDIT_PHILOSOPHIES: ReadonlyArray<EditorialPhilosophy> = [
  {
    id: 'quiet-luxury',
    title: 'Quiet Luxury',
    subtitle: 'Understated Elegance & Tactile Richness',
    description:
      'Focuses on impeccable fabric quality, precise cuts, and subtle tonal harmony without visible logos or loud branding. Luxury is felt through tactile weight, clean drape, and flawless tailoring.',
    corePrinciples: [
      'Prioritize organic textures: raw linen, mulberry silk, fine cashmere, and combed long-staple cotton.',
      'Maintain monochrome or closely analogous tonal color palettes (creams, warm taupes, navy, charcoal).',
      'Choose relaxed yet structured tailoring with clean seam lines and minimal hardware.',
      'Invest in elevated baseline essentials that harmonize effortlessly with multiple garments.',
    ],
    recommendedPalettes: [
      {
        name: 'Tonal Alabaster',
        hexCodes: ['#F7F5F0', '#EAE5D9', '#C5BCAC', '#4A463F'],
        description: 'Warm off-white, oat milk, brushed linen, and espresso grounding.',
      },
      {
        name: 'Monastic Navy',
        hexCodes: ['#0A192F', '#172A45', '#303C55', '#D1D5DB'],
        description: 'Midnight navy layers offset by cool grey and brushed silver accents.',
      },
    ],
    textileTraditions: [
      {
        name: 'Mulmul (Fine Muslin)',
        region: 'Bengal & Awadh',
        technique: 'Fine plain-weave combed cotton spun from delicate gossamer yarns.',
        description: 'Feather-light fabric with sublime breathability, traditionally hand-woven for tropical climates.',
        bestSeason: 'Summer',
        historicalSignificance: 'Celebrated since ancient times; prized for its airy transparency and soft hand.',
      },
      {
        name: 'Pashmina',
        region: 'Kashmir',
        technique: 'Hand-combed Changthangi goat underfleece spun and woven on wooden handlooms.',
        description: 'Ultra-fine thermal insulation that provides weightless warmth with microscopic softness.',
        bestSeason: 'Winter',
        historicalSignificance: 'Protected GI craft of Ladakh and the Kashmir Valley with centuries of regal provenance.',
      },
    ],
    silhouetteGuide: {
      proportions: 'Relaxed upper drape anchored by tailored, straight-cut or fluid wide-leg lines.',
      top: 'Unstructured camp collar shirts, fine-gauge knit tees, or crisp band-collar shirts.',
      bottom: 'Double-pleated straight trousers or tailored linen chinos.',
      layering: 'Unlined softly tailored blazers or fluid open dusters.',
      footwear: 'Sleek leather loafers, minimalist leather slides, or clean court sneakers.',
    },
    verifiedSources: [
      'Crafts Council of India — Handloom Documentation Archive',
      'The Structure of Fashion: Modern Minimalist Tailoring (Vogue Archive)',
    ],
    outfitKeywords: ['quiet luxury', 'minimal luxury', 'old money', 'refined', 'understated', 'tonal'],
  },
  {
    id: 'indian-heritage',
    title: 'Indian Heritage',
    subtitle: 'Living Weaves & Handcrafted Splendor',
    description:
      'Honors the living handloom traditions of India. Each drape, motif, and weave embodies centuries of artisan knowledge, natural botanical dyes, and regional community pride.',
    corePrinciples: [
      'Respect the architectural integrity of unstitched drapes (sarees, dupattas, dhotis).',
      'Celebrate handcrafted irregularities — slubs in khadi, slight block-print offsets, and loom-edge selvedges.',
      'Harmonize rich jewel tones (rani pink, peacock blue, haldi yellow, sindoor red) with earthy anchors.',
      'Incorporate traditional embellishments (zari borders, kantha stitches, gota patti) as focal anchors.',
    ],
    recommendedPalettes: [
      {
        name: 'Royal Durbar',
        hexCodes: ['#800020', '#C5A059', '#1A472A', '#F4E8C1'],
        description: 'Deep crimson, burnished antique gold, forest green, and raw silk cream.',
      },
      {
        name: 'Temple Turmeric',
        hexCodes: ['#FFB81C', '#D84315', '#6D214F', '#FFF8E7'],
        description: 'Warm haldi yellow, terracotta, deep plum, and natural unbleached kora.',
      },
    ],
    textileTraditions: [
      {
        name: 'Chanderi',
        region: 'Madhya Pradesh',
        technique: 'Interweaving silk warp with fine cotton weft, adorned with zari bootis.',
        description: 'Shimmering sheer texture with luxurious lightness and delicate gold motifs.',
        bestSeason: 'All Year',
        historicalSignificance: 'Patronized by the Scindias and Mughals; famous for translucent ceremonial drapes.',
      },
      {
        name: 'Chikankari',
        region: 'Lucknow, Uttar Pradesh',
        technique: 'Intricate shadow-work, tepchi, and phanda hand-embroidery on fine muslin.',
        description: 'Tonal white-on-white delicate needlework radiating regal poetic softness.',
        bestSeason: 'Summer',
        historicalSignificance: 'Nawabi heritage craft celebrated for subtle, refined courtly aesthetics.',
      },
      {
        name: 'Banarasi Brocade',
        region: 'Varanasi, Uttar Pradesh',
        technique: 'Kadhwa and Jamdani gold and silver zari brocade woven on pit looms.',
        description: 'Heavy, opulent silk with luminous metallic floral and paisley motifs.',
        bestSeason: 'Winter',
        historicalSignificance: 'Sacred weaving tradition documented since the Buddhist canonical era.',
      },
      {
        name: 'Ajrakh',
        region: 'Kutch (Gujarat) & Sindh',
        technique: '16-stage natural resist block printing using indigo, madder, and pomegranate peel.',
        description: 'Geometric star and web motifs in saturated indigos and earthen reds.',
        bestSeason: 'Transitional',
        historicalSignificance: 'Ancient craft tracing back to the Indus Valley Civilization.',
      },
    ],
    silhouetteGuide: {
      proportions: 'Graceful elongated vertical lines with structured shoulders and flowing hemlines.',
      top: 'Structured knee-length kurta, fitted blouse, or angrakha tunic.',
      bottom: 'Churidar, flared lehenga skirt, tailored dhoti pants, or straight salwar.',
      layering: 'Embroidered bandi/Nehru jacket, Banarasi dupatta, or Jamawar stole.',
      footwear: 'Handcrafted leather juttis, embellished kolhapuris, or metallic mojaris.',
    },
    verifiedSources: [
      'National Handicrafts and Handlooms Museum (National Crafts Museum, New Delhi)',
      'Handcrafted Indian Textiles: Tradition and Beyond (Roli Books)',
    ],
    outfitKeywords: ['traditional', 'festive', 'saree', 'heritage', 'handloom', 'chikankari', 'banarasi', 'kurta'],
  },
  {
    id: 'indo-western',
    title: 'Indo-Western Fusion',
    subtitle: 'Cross-Cultural Synthesis & Daily Wear Modernity',
    description:
      'Seamlessly bridges traditional Indian textiles and craft techniques with modern Western tailoring. Balances effortless comfort with bold cultural identity.',
    corePrinciples: [
      'Anchor one statement ethnic piece with crisp modern western separates (e.g. short kurta + raw denim).',
      'Juxtapose formal tailoring with heritage artisanal accessories (e.g. Italian blazer + Nehru collar + juttis).',
      'Keep silhouettes balanced: if the top is flowing or asymmetrical, ground it with sharp, tapered bottoms.',
      'Blend footwear traditions intentionally (clean white minimal sneakers paired with rolled-hem kurtas).',
    ],
    recommendedPalettes: [
      {
        name: 'Indigo & Raw Canvas',
        hexCodes: ['#1C3F60', '#D6C7A1', '#2C3539', '#FFFFFF'],
        description: 'Heritage indigo resist-dye paired with raw ecru canvas and dark denim slate.',
      },
      {
        name: 'Terracotta & Slate',
        hexCodes: ['#C46238', '#5B6770', '#EFEBE9', '#1A1A1A'],
        description: 'Warm clay terracotta layered against industrial cool grey and charcoal.',
      },
    ],
    textileTraditions: [
      {
        name: 'Khadi Denim',
        region: 'Gujarat & Maharashtra',
        technique: 'Hand-spun khadi cotton dyed with botanical indigo and woven into durable twill.',
        description: 'Combines the rugged utility of denim with the hand-spun breathability of Gandhi khadi.',
        bestSeason: 'All Year',
        historicalSignificance: 'Modern sustainable innovation revitalizing the swadeshi hand-spinning movement.',
      },
      {
        name: 'Ikat & Pochampally',
        region: 'Telangana & Odisha',
        technique: 'Tie-dyed warp and weft yarns woven into sharp geometric patterns.',
        description: 'Vibrant, precision-calculated motifs with intentional feathered boundaries.',
        bestSeason: 'All Year',
        historicalSignificance: 'Centuries-old mathematical resist-dye technique celebrated globally.',
      },
    ],
    silhouetteGuide: {
      proportions: 'Sharp high-low contrast; tailored structured lines meeting fluid ethnic drape.',
      top: 'Short band-collar kurta, linen tunic, or oversized boyfriend shirt draped as a wrap.',
      bottom: 'Cropped selvedge denim, slim-fit stretch chinos, or tailored culottes.',
      layering: 'Single-breasted linen blazer, sleeveless waist-length Nehru vest, or utility trench.',
      footwear: 'Minimalist leather sneakers, modern Belgian loafers, or sleek monk straps.',
    },
    verifiedSources: [
      'National Institute of Fashion Technology (NIFT) — Contemporary Textile Research',
      'Textiles and Tailoring in Modern South Asia (Oxford University Press)',
    ],
    outfitKeywords: ['indo-western', 'fusion', 'kurta with jeans', 'nehru jacket', 'contemporary ethnic', 'blazer kurta'],
  },
  {
    id: 'contemporary-tailoring',
    title: 'Contemporary Tailoring',
    subtitle: 'Architectural Cuts & Relaxed Power Dressing',
    description:
      'Reimagines classic suiting and workwear for the modern era. Discards rigid, restrictive padding in favor of fluid shoulders, high-waisted pleats, and elevated proportions.',
    corePrinciples: [
      'Emphasize shoulder drape and waistline placement over tight, restrictive fits.',
      'Pair relaxed double-pleated trousers with clean tucked tees or open-neck camp shirts.',
      'Embrace micro-textures (herringbone, houndstooth, tropical wool) for tactile visual depth.',
      'Ensure hemlines finish crisply at or slightly above the shoe break for clean verticality.',
    ],
    recommendedPalettes: [
      {
        name: 'Architectural Slate',
        hexCodes: ['#2F3640', '#718093', '#DCDDE1', '#192A56'],
        description: 'Graphite slate, flannel grey, crisp paper white, and midnight ink.',
      },
      {
        name: 'Warm Savile',
        hexCodes: ['#4E3629', '#8D6E63', '#D7CCC8', '#212121'],
        description: 'Rich tobacco brown, warm camel, stone chalk, and jet black.',
      },
    ],
    textileTraditions: [
      {
        name: 'Tropical Cool Wool',
        region: 'Northern India & International',
        technique: 'High-twist worsted wool woven with open pores for hot-weather airflow.',
        description: 'Naturally wrinkle-resistant, moisture-wicking suiting with a dry, matte drape.',
        bestSeason: 'Transitional',
        historicalSignificance: 'Modern tailoring breakthrough enabling sharp suiting in humid climates.',
      },
    ],
    silhouetteGuide: {
      proportions: 'High-waisted elongated legs with structured yet relaxed drop shoulders.',
      top: 'Crisp spread-collar poplin shirt, silk-knit polo, or structured mock-neck.',
      bottom: 'Double-pleated forward-crease trousers with generous thigh ease and subtle taper.',
      layering: 'Unstructured double-breasted blazer or relaxed boxy overshirt.',
      footwear: 'Chunky derbies, polished penny loafers, or minimalist monochrome trainers.',
    },
    verifiedSources: [
      'Savile Row Bespoke Association Tailoring Standards',
      'The Modern Menswear & Womenswear Architecture Compendium',
    ],
    outfitKeywords: ['tailored', 'formal', 'interview', 'blazer', 'power dressing', 'workwear', 'pleated'],
  },
  {
    id: 'minimalist',
    title: 'Minimalist Function',
    subtitle: 'Pure Form, Essential Utility & Neutral Calm',
    description:
      'Distills the wardrobe to timeless functional essentials. Every piece has a designated purpose, high inter-compatibility, and clean unbroken lines.',
    corePrinciples: [
      'Eliminate visual clutter: conceal closures, avoid excessive pockets, and omit high-contrast logos.',
      'Rely on subtle volume contrast (e.g. boxy tee over slim straight pants or fitted tee over wide pants).',
      'Stick to neutral base tones with at most one muted earthen accent.',
      'Focus on high-durability, easy-care fabrics that maintain structural shape after frequent wear.',
    ],
    recommendedPalettes: [
      {
        name: 'Monochrome Void',
        hexCodes: ['#000000', '#333333', '#888888', '#FFFFFF'],
        description: 'Pure stark black, charcoal, silver grey, and optic white.',
      },
      {
        name: 'Earth Neutral',
        hexCodes: ['#3E3D39', '#787265', '#B8B2A6', '#F5F4F0'],
        description: 'Charcoal olive, river pebble, bleached sand, and chalk.',
      },
    ],
    textileTraditions: [
      {
        name: 'Organic Heavy Cotton',
        region: 'Central India',
        technique: 'Dense single-jersey and interlock knitting from combed organic cotton yarn.',
        description: 'Substantial 240+ GSM drape that holds its boxy architectural structure.',
        bestSeason: 'All Year',
        historicalSignificance: 'Sustainable revival prioritizing soil health, chemical-free processing, and longevity.',
      },
    ],
    silhouetteGuide: {
      proportions: 'Balanced, uncluttered vertical geometry with continuous clean lines.',
      top: 'Heavyweight crew-neck t-shirt, seamless mock-neck, or crisp minimalist poplin shirt.',
      bottom: 'Straight-leg flat-front chinos, unbranded dark selvedge jeans, or tailored cropped trousers.',
      layering: 'Clean coach jacket, collarless chore coat, or lightweight mac coat.',
      footwear: 'Unbranded low-top canvas or leather sneakers, Chelsea boots, or clean slide sandals.',
    },
    verifiedSources: [
      'Dieter Rams: Ten Principles for Good Design Applied to Apparel',
      'Scandinavian & Japanese Capsule Wardrobe Design Protocols',
    ],
    outfitKeywords: ['minimalist', 'capsule', 'simple', 'clean lines', 'monochrome', 'basics', 'essential'],
  },
];

/**
 * Find philosophy by ID.
 */
export function getPhilosophyById(id: string): EditorialPhilosophy | undefined {
  return DESIGNERS_EDIT_PHILOSOPHIES.find((p) => p.id === id);
}

/**
 * Match philosophies relevant to a user query or garment keywords.
 */
export function searchPhilosophies(query: string): EditorialPhilosophy[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return DESIGNERS_EDIT_PHILOSOPHIES.filter((p) => {
    const titleMatch =
      p.title.toLowerCase().includes(q) || q.includes(p.title.toLowerCase());
    const subMatch =
      p.subtitle.toLowerCase().includes(q) || q.includes(p.subtitle.toLowerCase());
    const descMatch = p.description.toLowerCase().includes(q);
    const kwMatch = p.outfitKeywords.some(
      (kw) => q.includes(kw.toLowerCase()) || kw.toLowerCase().includes(q)
    );
    const craftMatch = p.textileTraditions.some((t) => {
      const tLower = t.name.toLowerCase();
      if (q.includes(tLower) || tLower.includes(q)) return true;
      const tokens = tLower
        .replace(/[()&,]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3);
      return tokens.some((tok) => q.includes(tok));
    });
    return titleMatch || subMatch || descMatch || kwMatch || craftMatch;
  });
}

