import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function SectionCard({ title, description, action, children, className, contentClassName }: SectionCardProps) {
  return (
    <section className={cn("pan-card", className)}>
      {title || description || action ? (
        <header className="pan-card-header">
          <div className="min-w-0">
            {title ? <h2 className="pan-card-title">{title}</h2> : null}
            {description ? <p className="pan-card-description">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      <div className={cn("pan-card-content", contentClassName)}>{children}</div>
    </section>
  );
}

export default SectionCard;
