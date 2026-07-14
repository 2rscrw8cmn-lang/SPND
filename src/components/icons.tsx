import { Car, Play, ShoppingCart, Users, Utensils } from "lucide-react";

const icons = { cart: ShoppingCart, utensils: Utensils, users: Users, car: Car, play: Play };

export function CategoryIcon({ name, size = 22 }: { name: string; size?: number }) {
  const Icon = icons[name as keyof typeof icons] ?? ShoppingCart;
  return <Icon size={size} strokeWidth={2.2} />;
}

