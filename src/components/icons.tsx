import { Banknote, Briefcase, Bus, Car, CircleHelp, Clapperboard, CreditCard, Dumbbell, Fuel, Gift, GraduationCap, HeartPulse, House, Landmark, PawPrint, PiggyBank, Plane, ReceiptText, ShieldCheck, ShoppingBag, ShoppingCart, Smile, Smartphone, Sparkles, Train, Users, Utensils, WalletCards, Wrench, Zap, type LucideIcon } from "lucide-react";

export const categoryIcons: Record<string, LucideIcon> = {
  House, Zap, ShoppingCart, Utensils, Car, ShieldCheck, HeartPulse, Users,
  ShoppingBag, Clapperboard, Plane, PiggyBank, CreditCard, Briefcase,
  Gift, Smile, CircleHelp, Banknote, Bus, Dumbbell, Fuel, GraduationCap,
  Landmark, PawPrint, ReceiptText, Smartphone, Sparkles, Train, WalletCards, Wrench,
};

export function CategoryIcon({ name, size = 22 }: { name: string; size?: number }) {
  const Icon = categoryIcons[name] ?? CircleHelp;
  return <Icon size={size} strokeWidth={2.2} />;
}
