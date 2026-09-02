import type { ComponentType, ReactNode } from "react";
import { Radar } from "lucide-react";

interface EmptyStateProps {
  icon?: ComponentType<{ size?: number; strokeWidth?: number }>;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon = Radar, title, description, action }: EmptyStateProps) {
  return (
    <div className="pan-empty">
      <span className="pan-empty-icon"><Icon size={23} strokeWidth={1.7} /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export default EmptyState;
