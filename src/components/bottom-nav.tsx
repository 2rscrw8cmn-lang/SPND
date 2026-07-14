"use client";

import { CalendarDays, ChartNoAxesColumnIncreasing, House, ReceiptText, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Home", icon: House },
  { href: "/budget", label: "Budget", icon: ChartNoAxesColumnIncreasing },
  { href: "/activity", label: "Activity", icon: ReceiptText },
  { href: "/plan", label: "Plan", icon: CalendarDays },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      <div className="nav-inner">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link href={href} key={href} className={cn("nav-item", active && "nav-item-active")}>
              <Icon aria-hidden="true" size={23} strokeWidth={active ? 2.5 : 2} />
              <span>{label}</span>
            </Link>
          );
        })}
        <Link href="/settings" className={cn("nav-item nav-settings", pathname.startsWith("/settings") && "nav-item-active")}>
          <Settings aria-hidden="true" size={23} />
          <span>Settings</span>
        </Link>
      </div>
    </nav>
  );
}

