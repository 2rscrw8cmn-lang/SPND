import { Baby, Banknote, Briefcase, Bus, Car, CircleHelp, Clapperboard, Coffee, CreditCard, Droplets, Dumbbell, Fuel, Gamepad2, Gift, GraduationCap, HeartPulse, House, Landmark, PawPrint, PiggyBank, Plane, ReceiptText, ShieldCheck, Shirt, ShoppingBag, ShoppingCart, Smile, Smartphone, Sofa, Sparkles, Train, Users, Utensils, WalletCards, Wifi, Wrench, Zap, type LucideIcon } from "lucide-react";
import { inferCategoryIcon } from "@/lib/category-style";

export const categoryIcons: Record<string, LucideIcon> = {
  House, Zap, ShoppingCart, Utensils, Car, ShieldCheck, HeartPulse, Users,
  ShoppingBag, Clapperboard, Plane, PiggyBank, CreditCard, Briefcase,
  Gift, Smile, CircleHelp, Banknote, Bus, Dumbbell, Fuel, GraduationCap,
  Landmark, PawPrint, ReceiptText, Smartphone, Sparkles, Train, WalletCards, Wrench,
  Baby, Coffee, Droplets, Gamepad2, Shirt, Sofa, Wifi,
};

export function CategoryIcon({ name, size = 22 }: { name: string; size?: number }) {
  const Icon = categoryIcons[name] ?? categoryIcons[inferCategoryIcon(name)] ?? WalletCards;
  return <Icon size={size} strokeWidth={2.65} />;
}
