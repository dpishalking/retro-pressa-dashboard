import Image from "next/image";

type ProductCoverProps = {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
};

export function ProductCover({ src, alt, className = "", sizes, priority }: ProductCoverProps) {
  return (
    <div className={`relative overflow-hidden bg-[#f4efe6] ${className}`}>
      <div className="absolute inset-0 p-3 sm:p-5">
        <div className="relative h-full w-full">
          <Image
            src={src}
            alt={alt}
            fill
            priority={priority}
            sizes={sizes}
            className="object-contain"
            unoptimized
          />
        </div>
      </div>
    </div>
  );
}
