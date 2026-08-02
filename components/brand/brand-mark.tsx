import Image from "next/image";
import Link from "next/link";

/** Cache-bust static brand asset (bump when logo.png bytes change). */
const LOGO_SRC = "/brand/logo.png?v=3";

const sizes = {
  sm: { className: "h-16 w-auto sm:h-[4.5rem]", height: 72, width: 72 },
  md: { className: "h-28 w-auto sm:h-32", height: 128, width: 128 },
  lg: { className: "h-40 w-auto sm:h-48", height: 192, width: 192 },
  hero: { className: "h-52 w-auto sm:h-64 md:h-72", height: 288, width: 288 }
} as const;

type BrandMarkProps = {
  className?: string;
  href?: string | null;
  priority?: boolean;
  size?: keyof typeof sizes;
};

export function BrandMark({
  className = "",
  href = "/",
  priority = false,
  size = "md"
}: BrandMarkProps) {
  const dims = sizes[size];
  // unoptimized: serve PNG alpha as-is (avoid /_next/image cache flattening old opaque plate)
  const image = (
    <Image
      src={LOGO_SRC}
      alt="Dream Team FC — Passione per il fantacalcio"
      width={dims.width}
      height={dims.height}
      priority={priority}
      unoptimized
      className={`${dims.className} object-contain ${className}`.trim()}
    />
  );

  if (href === null) {
    return image;
  }

  return (
    <Link
      href={href}
      className="inline-flex shrink-0 transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
      aria-label="Dream Team FC — Home"
    >
      {image}
    </Link>
  );
}
