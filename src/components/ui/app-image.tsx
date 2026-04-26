import Image from "next/image";

type AppImageProps = {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
};

export function AppImage({
  src,
  alt,
  className = "",
  fill = false,
  width = 800,
  height = 500,
  sizes = "(max-width: 900px) 100vw, 50vw",
  priority = false,
}: AppImageProps) {
  const isDataUrl = src.startsWith("data:");

  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        className={className}
        sizes={sizes}
        priority={priority}
        unoptimized={isDataUrl}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      sizes={sizes}
      priority={priority}
      unoptimized={isDataUrl}
    />
  );
}

