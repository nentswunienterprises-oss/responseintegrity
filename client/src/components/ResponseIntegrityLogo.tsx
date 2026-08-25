export function ResponseIntegrityLogo({
  size = "xl",
  variant = "hub",
}: {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "hub" | "integrity";
}) {
  // Responsive font sizes using clamp
  const sizeMap = {
    sm: "clamp(10px, 2.2vw, 12px)",
    md: "clamp(12px, 2.8vw, 14px)",
    lg: "clamp(14px, 3.2vw, 16px)",
    xl: "clamp(24px, 7vw, 40px)",
  };
  const integrityResponseSizeMap = {
    sm: "clamp(8.5px, 2vw, 11.5px)",
    md: "clamp(12px, 2.6vw, 15px)",
    lg: "clamp(15px, 3.2vw, 19px)",
    xl: "clamp(24px, 6.3vw, 39px)",
  };
  const integritySublineSizeMap = {
    sm: "clamp(8.5px, 1.8vw, 10.5px)",
    md: "clamp(10.5px, 2.2vw, 12.5px)",
    lg: "clamp(12.5px, 2.6vw, 14.5px)",
    xl: "clamp(19px, 4.8vw, 26px)",
  };
  const text = sizeMap[size];
  const integrityResponseText = integrityResponseSizeMap[size];
  const integritySublineText = integritySublineSizeMap[size];

  return (
    <div
      style={{
        display: "inline-block",
        lineHeight: 1.05,
        fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont',
        position: "relative",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {variant === "hub" ? (
          <>
            <span
              style={{
                fontSize: text,
                fontWeight: 600,
                color: "var(--ri-charcoal)",
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              THE
            </span>
            <span
              style={{
                fontSize: text,
                fontWeight: 700,
                color: "var(--ri-red)",
                letterSpacing: "normal",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              RESPONSE
            </span>
            <span
              style={{
                fontSize: text,
                fontWeight: 600,
                color: "var(--ri-charcoal)",
                letterSpacing: "0.02em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              HUB
            </span>
          </>
        ) : (
          <>
            <span
              style={{
                fontSize: integrityResponseText,
                fontWeight: 700,
                color: "var(--ri-red)",
                letterSpacing: "0.03em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                lineHeight: 0.92,
                marginBottom: "0.1em",
              }}
            >
              RESPONSE
            </span>
            <span
              style={{
                fontSize: integritySublineText,
                fontWeight: 700,
                color: "var(--ri-charcoal)",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                lineHeight: 0.95,
              }}
            >
              INTEGRITY
            </span>
          </>
        )}
      </div>
    </div>
  );
}

