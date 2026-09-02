import type { ReactNode } from "react";

interface AppPageProps {
  title: string;
  description: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AppPage({ title, description, eyebrow, actions, children }: AppPageProps) {
  return (
    <div className="pan-page">
      <header className="pan-page-header">
        <div className="min-w-0">
          {eyebrow ? <p className="pan-eyebrow">{eyebrow}</p> : null}
          <h1 className="pan-page-title">{title}</h1>
          <p className="pan-page-description">{description}</p>
        </div>
        {actions ? <div className="pan-page-actions">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}

export default AppPage;
