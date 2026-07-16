import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { requireUser } from "@/lib/auth";
import { getReviewCount } from "@/lib/data";

export async function PageShell({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const reviewCount = await getReviewCount();
  return (
    <>
      <div className="app-frame">
        <AppHeader firstName={user.firstName} />
        <main>{children}</main>
      </div>
      <BottomNav reviewCount={reviewCount} />
    </>
  );
}
