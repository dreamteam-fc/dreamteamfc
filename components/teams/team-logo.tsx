import { getTeamLogoPublicUrl } from "@/lib/teams/team-logo-url.ts";

type TeamLogoProps = {
  alt: string;
  cacheBust?: Date | string | number | null;
  className?: string;
  logoPath?: string | null;
  size?: "sm" | "md" | "lg";
};

const SIZE_CLASS: Record<NonNullable<TeamLogoProps["size"]>, string> = {
  lg: "h-20 w-20",
  md: "h-10 w-10",
  sm: "h-7 w-7"
};

export function TeamLogo({
  alt,
  cacheBust,
  className,
  logoPath,
  size = "sm"
}: TeamLogoProps) {
  const url = getTeamLogoPublicUrl(logoPath, cacheBust);
  const sizeClass = SIZE_CLASS[size];
  const rootClass = [
    "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100",
    sizeClass,
    className
  ]
    .filter(Boolean)
    .join(" ");

  if (!url) {
    return (
      <span aria-hidden className={rootClass}>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          FC
        </span>
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- small public Storage assets; avoid next/image remote config
    <img
      src={url}
      alt={alt}
      className={`${rootClass} object-cover`}
      loading="lazy"
      decoding="async"
    />
  );
}
