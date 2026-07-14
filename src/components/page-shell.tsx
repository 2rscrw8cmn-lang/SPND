import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { requireUser } from "@/lib/auth";

export async function PageShell({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <>
      <div className="app-frame">
        <AppHeader firstName={user.firstName} />
        <main>{children}</main>
      </div>
      <BottomNav />
    </>
  );
}

