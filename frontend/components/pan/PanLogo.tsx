import Link from "next/link";
import { Radar } from "lucide-react";
import { cn } from "@/lib/utils";

interface PanLogoProps {
  compact?: boolean;
  href?: string;
  className?: string;
}

export function PanLogo({ compact = false, href = "/dashboard", className }: PanLogoProps) {
  return (
    <Link aria-label="vulnexa home" className={cn("pan-logo", compact && "pan-logo-compact", className)} href={href}>
      <span className="pan-logo-mark"><Radar size={21} strokeWidth={2.1} /></span>
      {!compact ? <span><strong>DELTA</strong><small>Academy</small></span> : null}
    </Link>
  );
}
