import { Briefcase, Car, CircleHelp, Clapperboard, CreditCard, Gift, HeartPulse, House, PiggyBank, Plane, ShieldCheck, ShoppingBag, ShoppingCart, Smile, Users, Utensils, Zap, type LucideIcon } from "lucide-react";

export const categoryIcons: Record<string, LucideIcon> = {
  House, Zap, ShoppingCart, Utensils, Car, ShieldCheck, HeartPulse, Users,
  ShoppingBag, Clapperboard, Plane, PiggyBank, CreditCard, Briefcase,
  Gift, Smile, CircleHelp,
};

export function CategoryIcon({ name, size = 22 }: { name: string; size?: number }) {
  const Icon = categoryIcons[name] ?? CircleHelp;
  return <Icon size={size} strokeWidth={2.2} />;
}
