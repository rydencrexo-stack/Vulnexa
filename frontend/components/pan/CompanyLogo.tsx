import type { ReactNode } from "react";
import type { Company } from "@/types/pan";

interface CompanyLogoProps {
  company: Pick<Company, "slug" | "name" | "color" | "soft" | "mark">;
  size?: number;
  className?: string;
}

function VulnexaLogo({ color }: { color: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" width="26" height="26">
      <path d="M10 6h28l-6 12h6l-22 24 7-18H14z" fill={color} />
    </svg>
  );
}

function NexaLogo({ color }: { color: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 48"
      width="26"
      height="26"
      fill="none"
    >
      <path
        d="M12 30a8 8 0 1 1 3-15.4 10 10 0 0 1 19.4 2.2A7 7 0 0 1 38 30z"
        fill={color}
        opacity="0.9"
      />
      <circle cx="17" cy="30" r="2.2" fill="#0b1220" />
      <circle cx="26" cy="34" r="2.2" fill="#0b1220" />
      <circle cx="34" cy="28" r="2.2" fill="#0b1220" />
    </svg>
  );
}

function FinPulseLogo({ color }: { color: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 48"
      width="26"
      height="26"
      fill="none"
    >
      <circle cx="24" cy="24" r="17" stroke={color} strokeWidth="3" />
      <path
        d="M8 26h8l4-9 5 14 4-8 3 3h8"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const LOGOS: Record<string, (color: string) => ReactNode> = {
  "vulnexa-labs": (color) => <VulnexaLogo color={color} />,
  nexacloud: (color) => <NexaLogo color={color} />,
  finpulse: (color) => <FinPulseLogo color={color} />,
};

export function CompanyLogo({
  company,
  size = 40,
  className,
}: CompanyLogoProps) {
  const render =
    LOGOS[company.slug] ??
    (() => (
      <strong style={{ color: company.color }}>{company.mark}</strong>
    ));

  return (
    <span
      aria-label={`${company.name} logo`}
      className={`pan-company-logo${className ? ` ${className}` : ""}`}
      style={{
        background: company.soft,
        borderColor: `${company.color}44`,
        width: size,
        height: size,
        fontSize: size * 0.32,
      }}
    >
      {render(company.color)}
    </span>
  );
}