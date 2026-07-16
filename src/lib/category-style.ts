export const categoryColors = ["#9B6CFF", "#FFD24A", "#45D9E1", "#FF705B", "#58A6FF", "#FF5D6C", "#F79AD3", "#63D9A2", "#FF9F43", "#7D8CFF", "#B7E36B", "#A6ACB8"];

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
  for (const [pattern, icon] of iconKeywords) if (pattern.test(value)) return icon;
  return "WalletCards";
}

export function resolveCategoryIcon(icon: string | null | undefined, name: string): string {
  return icon && icon !== "CircleHelp" ? icon : inferCategoryIcon(name);
}

export function inferCategoryColor(name: string): string {
  let hash = 0;
  for (const char of name.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return categoryColors[hash % (categoryColors.length - 1)]!;
}
