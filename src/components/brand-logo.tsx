import Image from "next/image";

export function BrandLogo({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  return (
    <span className={`inline-flex items-center overflow-hidden rounded-xl ${inverse ? "bg-white shadow-sm" : "bg-white"} ${compact ? "h-12 w-12" : "h-20 w-20"}`}>
      <Image
        src="/brand/trejder-email.png"
        alt="Trejder"
        width={360}
        height={383}
        priority
        className="h-full w-full object-contain"
      />
    </span>
  );
}
