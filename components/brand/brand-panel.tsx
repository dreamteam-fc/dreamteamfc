import type { ReactNode } from "react";

import { BrandMark } from "@/components/brand/brand-mark";

type BrandPanelProps = {
  children?: ReactNode;
  description?: string;
  markSize?: "sm" | "md" | "lg";
  title: string;
};

export function BrandPanel({
  children,
  description,
  markSize = "md",
  title
}: BrandPanelProps) {
  return (
    <section className="overflow-hidden rounded-3xl bg-brand-void text-white shadow-brand">
      <div className="brand-spectrum-bar" />
      <div className="relative bg-brand-aurora px-6 py-8 sm:px-8">
        <div className="flex flex-col items-center text-center">
          <BrandMark size={markSize} priority />
          <h1 className="mt-5 font-display text-3xl font-bold uppercase tracking-wide">
            {title}
          </h1>
          {description ? (
            <p className="mt-3 max-w-sm text-sm leading-6 text-brand-mute">
              {description}
            </p>
          ) : null}
          {children}
        </div>
      </div>
    </section>
  );
}
