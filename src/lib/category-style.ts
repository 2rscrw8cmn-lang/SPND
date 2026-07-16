export const categoryColors = [
  "#9B6CFF",
  "#FFD24A",
  "#45D9E1",
  "#FF705B",
  "#58A6FF",
  "#FF5D6C",
  "#F79AD3",
  "#63D9A2",
  "#FF9F43",
  "#7D8CFF",
  "#B7E36B",
  "#A6ACB8",
];

export const categoryPalettes = {
  "violet-indigo": ["#b57aff", "#7155f5"],
  "yellow-orange": ["#ffe16b", "#ff9a43"],
  "cyan-teal": ["#65e8e9", "#23b9a7"],
  "orange-amber": ["#ff9d59", "#f5bd3e"],
  "lime-green": ["#d0ff5a", "#55c971"],
  "blue-indigo": ["#66b2ff", "#5e70f2"],
  "coral-red": ["#ff8275", "#ee4663"],
  "pink-violet": ["#ff8fc8", "#a65af0"],
  "purple-pink": ["#ae72ff", "#ee6bc5"],
  "magenta-violet": ["#ef64ca", "#895cf4"],
  "sky-blue": ["#72ddff", "#4f8df4"],
  "teal-emerald": ["#52e0c3", "#34b877"],
  "amber-orange": ["#ffd45f", "#ff8f46"],
  "lime-emerald": ["#d0ff58", "#43d486"],
  slate: ["#aab3c2", "#697483"],
} as const;

export type CategoryPaletteKey = keyof typeof categoryPalettes;

const paletteKeywords: Array<[RegExp, CategoryPaletteKey]> = [
  [/rent|mortgage|housing|house|home/, "violet-indigo"],
  [/water|power|electric|energy|utilit|internet|phone/, "yellow-orange"],
  [/grocer|market|food/, "cyan-teal"],
  [/dining|restaurant|takeout|coffee|cafe/, "orange-amber"],
  [/transport|car|auto|gas|fuel|commute|parking|toll/, "lime-green"],
  [/insur/, "blue-indigo"],
  [
    /health|medical|doctor|dental|pharma|toiletr|hygiene|personal|beauty|groom|care/,
    "coral-red",
  ],
  [/kid|baby|child|daycare|family/, "pink-violet"],
  [/shop|cloth|apparel|shoe/, "purple-pink"],
  [/subscript|stream|entertain|movie|music|tv|game/, "magenta-violet"],
  [/travel|vacation|flight|hotel|trip/, "sky-blue"],
  [/saving|emergency|rainy/, "teal-emerald"],
  [/debt|loan|credit/, "amber-orange"],
  [/income|paycheck|salary|payroll|work/, "lime-emerald"],
];

export function inferCategoryPaletteKey(name: string): CategoryPaletteKey {
  const value = name.toLowerCase();
  for (const [pattern, palette] of paletteKeywords)
    if (pattern.test(value)) return palette;
  return "slate";
}

export function resolveCategoryPaletteKey(
  paletteKey: string | null | undefined,
  name: string,
): CategoryPaletteKey {
  if (paletteKey && paletteKey in categoryPalettes && paletteKey !== "slate")
    return paletteKey as CategoryPaletteKey;
  return inferCategoryPaletteKey(name);
}

export function categoryVisualStyle(category: {
  color: string;
  name: string;
  paletteKey?: string | null;
}) {
  const [start, end] =
    categoryPalettes[
      resolveCategoryPaletteKey(category.paletteKey, category.name)
    ];
  return {
    "--category": category.color,
    "--category-start": start,
    "--category-end": end,
  };
}

const iconKeywords: Array<[RegExp, string]> = [
  [/homegood|furnitur|decor|household/, "Sofa"],
  [/rent|mortgage|housing|house|home/, "House"],
  [/grocer|market|food/, "ShoppingCart"],
  [/coffee|cafe/, "Coffee"],
  [/dining|restaurant|takeout|eat/, "Utensils"],
  [/water|power|electric|energy|utilit/, "Zap"],
  [/internet|wifi|broadband|cable/, "Wifi"],
  [/phone|mobile|cell/, "Smartphone"],
  [/clean|laundry/, "Sparkles"],
  [/toiletr|hygiene|personal|beauty|groom|care/, "Droplets"],
  [/insur/, "ShieldCheck"],
  [/health|medical|doctor|dental|pharma/, "HeartPulse"],
  [/fitness|gym|sport|workout/, "Dumbbell"],
  [/kid|baby|child|daycare/, "Baby"],
  [/pet|vet/, "PawPrint"],
  [/cloth|apparel|shirt|wardrobe|shoe/, "Shirt"],
  [/transport|car|auto|gas|fuel|commute|parking|toll/, "Car"],
  [/game|gaming/, "Gamepad2"],
  [/subscript|stream|entertain|movie|music|tv/, "Clapperboard"],
  [/travel|vacation|flight|hotel|trip/, "Plane"],
  [/saving|emergency|rainy/, "PiggyBank"],
  [/debt|loan|credit/, "CreditCard"],
  [/income|paycheck|salary|payroll|work/, "Banknote"],
  [/gift|donat|charit|tithe/, "Gift"],
  [/education|school|tuition|college|book/, "GraduationCap"],
  [/tax|bank|fee|finance/, "Landmark"],
  [/repair|maintenance|tool/, "Wrench"],
  [/shop/, "ShoppingBag"],
  [/bill/, "ReceiptText"],
];

export function inferCategoryIcon(name: string): string {
  const value = name.toLowerCase();
  for (const [pattern, icon] of iconKeywords)
    if (pattern.test(value)) return icon;
  return "WalletCards";
}

export function resolveCategoryIcon(
  icon: string | null | undefined,
  name: string,
): string {
  return icon && icon !== "CircleHelp" ? icon : inferCategoryIcon(name);
}

export function inferCategoryColor(name: string): string {
  let hash = 0;
  for (const char of name.toLowerCase())
    hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return categoryColors[hash % (categoryColors.length - 1)]!;
}
