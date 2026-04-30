import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode } from "react";
import { islandTheme } from "./theme.js";

export type IslandButtonVariant = "primary" | "secondary" | "danger";

const baseButtonStyle: CSSProperties = {
  borderRadius: islandTheme.radius.control,
  border: `1px solid ${islandTheme.color.border}`,
  padding: "0.48rem 0.75rem",
  cursor: "pointer",
  fontWeight: 600
};

const buttonVariantStyles: Record<IslandButtonVariant, CSSProperties> = {
  primary: {
    background: islandTheme.color.primary,
    borderColor: islandTheme.color.primary,
    color: islandTheme.color.primaryText
  },
  secondary: {
    background: islandTheme.color.secondary,
    color: islandTheme.color.textSecondary
  },
  danger: {
    background: islandTheme.color.danger,
    borderColor: islandTheme.color.danger,
    color: islandTheme.color.dangerText
  }
};

export const islandInputStyle: CSSProperties = {
  background: islandTheme.color.panelMutedBg,
  color: islandTheme.color.textPrimary,
  border: `1px solid ${islandTheme.color.border}`,
  borderRadius: islandTheme.radius.control,
  padding: "0.5rem 0.65rem"
};

export const islandCardStyle: CSSProperties = {
  background: islandTheme.color.panelBg,
  border: `1px solid ${islandTheme.color.cardBorder}`,
  borderRadius: islandTheme.radius.card,
  padding: islandTheme.spacing.cardPadding
};

export function islandButtonStyle(variant: IslandButtonVariant): CSSProperties {
  return { ...baseButtonStyle, ...buttonVariantStyles[variant] };
}

type IslandButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: IslandButtonVariant;
};

export function IslandButton({ variant = "secondary", style, ...props }: IslandButtonProps) {
  return <button {...props} style={{ ...islandButtonStyle(variant), ...style }} />;
}

type IslandCardProps = HTMLAttributes<HTMLElement> & {
  as?: "section" | "div" | "article";
};

export function IslandCard({ as = "section", style, ...props }: IslandCardProps) {
  const Tag = as;
  return <Tag {...props} style={{ ...islandCardStyle, ...style }} />;
}

type IslandTileButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  title: string;
  description: string;
  imageUrl: string;
  accent: "primary" | "tool";
  hovered?: boolean;
};

export function IslandTileButton({
  title,
  description,
  imageUrl,
  accent,
  hovered = false,
  style,
  ...props
}: IslandTileButtonProps) {
  const accentBorder = accent === "primary" ? islandTheme.color.primaryStrong : islandTheme.color.toolAccent;
  const hoverShadow = accent === "primary" ? islandTheme.shadow.tileGameNightHover : islandTheme.shadow.tileToolsHover;
  const gradient = accent === "primary" ? islandTheme.gradient.gameNightTile : islandTheme.gradient.toolsTile;
  return (
    <button
      {...props}
      style={{
        ...islandButtonStyle("secondary"),
        width: "100%",
        minHeight: "clamp(160px, 24vw, 250px)",
        borderRadius: islandTheme.radius.surface,
        textAlign: "left",
        color: islandTheme.color.textInverted,
        padding: "1rem",
        border: `1px solid ${accentBorder}`,
        backgroundImage: `${gradient}, url("${imageUrl}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        boxShadow: hovered ? hoverShadow : islandTheme.shadow.tileIdle,
        transition: "box-shadow 160ms ease, transform 160ms ease",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        overflow: "hidden",
        ...style
      }}
    >
      <div>
        <div style={{ fontSize: "clamp(1.75rem, 3.4vw, 2.25rem)", fontWeight: 800, lineHeight: 1.05, marginBottom: 10 }}>
          {title}
        </div>
        <div style={{ fontSize: 16, lineHeight: 1.3, opacity: 0.97, maxWidth: 280 }}>{description}</div>
      </div>
    </button>
  );
}

type IslandMemberChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  selected: boolean;
};

export function IslandMemberChip({ label, selected, style, ...props }: IslandMemberChipProps) {
  return (
    <button
      {...props}
      style={{
        ...islandButtonStyle("secondary"),
        borderRadius: 999,
        background: selected ? islandTheme.color.primary : islandTheme.color.secondary,
        color: islandTheme.color.textPrimary,
        border: selected ? `1px solid ${islandTheme.color.primary}` : `1px solid ${islandTheme.color.border}`,
        padding: "0.26rem 0.62rem",
        ...style
      }}
    >
      {selected ? "✓ " : ""}
      {" "}
      {label}
    </button>
  );
}

type IslandGameCardProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  title: string;
  subtitle: string;
  imageUrl?: string | null;
  selected: boolean;
};

export function IslandGameCard({ title, subtitle, imageUrl, selected, style, ...props }: IslandGameCardProps) {
  return (
    <button
      {...props}
      style={{
        ...islandButtonStyle("secondary"),
        textAlign: "left",
        border: selected ? `2px solid ${islandTheme.color.primaryGlow}` : `1px solid ${islandTheme.color.border}`,
        background: selected ? islandTheme.color.info : islandTheme.color.panelMutedBg,
        color: islandTheme.color.textPrimary,
        padding: 8,
        ...style
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={title}
          style={{
            width: "100%",
            height: 90,
            objectFit: "cover",
            borderRadius: 6,
            border: `1px solid ${islandTheme.color.border}`
          }}
        />
      ) : null}
      <div style={{ marginTop: 6, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 12, opacity: 0.95 }}>{subtitle}</div>
    </button>
  );
}

type IslandComingSoonTileProps = HTMLAttributes<HTMLDivElement> & {
  title?: string;
  description?: string;
};

export function IslandComingSoonTile({
  title = "Coming Soon",
  description = "Reserved for future modules.",
  style,
  ...props
}: IslandComingSoonTileProps) {
  return (
    <div
      {...props}
      aria-disabled="true"
      style={{
        width: "100%",
        minHeight: "clamp(160px, 24vw, 250px)",
        borderRadius: islandTheme.radius.surface,
        textAlign: "left",
        color: islandTheme.color.textMuted,
        padding: "1rem",
        border: `1px dashed ${islandTheme.color.border}`,
        background: islandTheme.gradient.comingSoonTile,
        boxShadow: islandTheme.shadow.tileComingSoon,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        overflow: "hidden",
        ...style
      }}
    >
      <div>
        <div
          style={{
            fontSize: "clamp(1.75rem, 3.4vw, 2.25rem)",
            fontWeight: 800,
            lineHeight: 1.05,
            marginBottom: 10,
            color: islandTheme.color.textSubtle
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 16, lineHeight: 1.3 }}>{description}</div>
      </div>
    </div>
  );
}

type IslandNewsPlaceholderCardProps = HTMLAttributes<HTMLElement> & {
  title: string;
  meta: string;
};

export function IslandNewsPlaceholderCard({ title, meta, style, ...props }: IslandNewsPlaceholderCardProps) {
  return (
    <article
      {...props}
      style={{
        border: `1px solid ${islandTheme.color.border}`,
        borderRadius: islandTheme.radius.control,
        padding: "0.7rem",
        background: islandTheme.color.panelMutedBg,
        ...style
      }}
    >
      <strong>{title}</strong>
      <div style={{ fontSize: 13, opacity: 0.85 }}>{meta}</div>
    </article>
  );
}

type IslandActiveMemberRowProps = HTMLAttributes<HTMLDivElement> & {
  displayName: string;
  avatarUrl?: string | null;
  presenceText: string;
  inVoice?: boolean;
};

export function IslandActiveMemberRow({
  displayName,
  avatarUrl,
  presenceText,
  inVoice = false,
  style,
  ...props
}: IslandActiveMemberRowProps) {
  return (
    <div
      {...props}
      style={{
        border: `1px solid ${islandTheme.color.border}`,
        borderRadius: islandTheme.radius.control,
        padding: "0.55rem 0.7rem",
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: islandTheme.color.panelMutedBg,
        ...style
      }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={displayName}
          style={{ width: 34, height: 34, borderRadius: "999px", border: `1px solid ${islandTheme.color.border}` }}
        />
      ) : null}
      <div>
        <div style={{ fontWeight: 700 }}>{displayName}</div>
        <div style={{ fontSize: 12, opacity: 0.9 }}>
          {presenceText}
          {inVoice ? " - in voice" : ""}
        </div>
      </div>
    </div>
  );
}

type IslandStatusPillProps = HTMLAttributes<HTMLSpanElement> & {
  tone: "success" | "danger";
  children: ReactNode;
};

export function IslandStatusPill({ tone, children, style, ...props }: IslandStatusPillProps) {
  const palette =
    tone === "success"
      ? { bg: islandTheme.color.success, fg: islandTheme.color.successText }
      : { bg: islandTheme.color.dangerSurface, fg: islandTheme.color.dangerText };
  return (
    <span
      {...props}
      style={{
        borderRadius: 999,
        padding: "0.22rem 0.55rem",
        fontSize: 12,
        border: `1px solid ${islandTheme.color.border}`,
        background: palette.bg,
        color: palette.fg,
        alignSelf: "flex-end",
        ...style
      }}
    >
      {children}
    </span>
  );
}
