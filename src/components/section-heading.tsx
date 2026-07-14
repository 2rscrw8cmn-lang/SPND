import { ChevronRight } from "lucide-react";
import Link from "next/link";

export function SectionHeading({ title, href, action = "View all" }: { title: string; href?: string; action?: string }) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {href ? <Link href={href}>{action}<ChevronRight size={18} /></Link> : null}
    </div>
  );
}

