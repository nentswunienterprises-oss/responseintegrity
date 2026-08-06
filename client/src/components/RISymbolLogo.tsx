export function RISymbolLogo({
  size = "lg",
  className = "",
  alt = "Response Integrity symbol logo",
}: {
  size?: "sm" | "md" | "lg" | "xl" | "xxl";
  className?: string;
  alt?: string;
}) {
  const sizeMap = {
    sm: 28,
    md: 40,
    lg: 56,
    xl: 72,
    xxl: 80,
  };

  const logoSrc = "/ri-symbol-logo.svg?v=20260806-6";

  return (
    <img
      src={logoSrc}
      alt={alt}
      style={{ height: sizeMap[size], width: "auto" }}
      className={`block shrink-0 ${className}`.trim()}
      loading="eager"
      decoding="async"
    />
  );
}
