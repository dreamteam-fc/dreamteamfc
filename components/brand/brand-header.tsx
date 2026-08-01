import type { ReactNode } from "react";

import { BrandMark } from "@/components/brand/brand-mark";

type BrandHeaderProps = {
  actions?: ReactNode;
  children?: ReactNode;
  description?: string;
  title: string;
};

export function BrandHeader({
  actions,
  children,
  description,
  title
}: BrandHeaderProps) {
  return (
    <header className="overflow-hidden rounded-3xl bg-brand-void text-white shadow-brand">
      <div className="brand-spectrum-bar" />
      <div className="relative bg-brand-aurora px-6 py-7 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex min-w-0 flex-wrap items-center gap-4 sm:gap-5">
            <BrandMark size="sm" />
            <div className="min-w-0">
              <h1 className="font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl">
                {title}
              </h1>
              {description ? (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-mute sm:text-base">
                  {description}
                </p>
              ) : null}
              {children}
            </div>
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-3">{actions}</div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
