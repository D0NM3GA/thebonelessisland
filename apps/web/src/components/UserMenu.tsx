import { useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { useDayNight } from "../scene/useDayNight.js";
import { islandTheme } from "../theme.js";
import type { MeProfile, PageId } from "../types.js";
import { UserAvatar, getInitials } from "./Topbar.js";

type UserStatus = "online" | "idle" | "dnd" | "invisible";

type UserMenuProps = {
  menuRef: RefObject<HTMLDivElement | null>;
  profile: MeProfile | null;
  onClose: () => void;
  onNavigate: (page: PageId) => void;
  onLogout: () => void;
};

export function UserMenu({ menuRef, profile, onClose, onNavigate, onLogout }: UserMenuProps) {
  const { mode, toggle } = useDayNight();
  const [status, setStatus] = useState<UserStatus>("online");

  const initials = getInitials(profile?.displayName ?? profile?.username ?? "??");
  const handle = profile?.username ?? "guest";
  const discordId = profile?.discordUserId ?? "—";
  const customStatus = profile?.richPresenceText?.trim()
    ? profile.richPresenceText
    : "Hangin' on the dock 🌴";
  const inVoice = profile?.inVoice ?? false;

  return (
    <div
      ref={menuRef}
      role="menu"
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        right: "clamp(0.9rem, 2vw, 1.4rem)",
        width: 340,
        maxWidth: "calc(100vw - 24px)",
        background: islandTheme.color.panelBg,
        backdropFilter: islandTheme.glass.blurStrong,
        WebkitBackdropFilter: islandTheme.glass.blurStrong,
        border: `1px solid ${islandTheme.color.cardBorder}`,
        borderRadius: 16,
        boxShadow: "0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset",
        overflow: "hidden",
        zIndex: 50
      }}
    >
      <div
        style={{
          height: 70,
          background:
            mode === "day"
              ? "linear-gradient(135deg, #fbbf24 0%, #f97316 50%, #ec4899 100%)"
              : "linear-gradient(135deg, #1e3a8a 0%, #0c4a6e 50%, #0e7490 100%)",
          position: "relative"
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 16,
            bottom: -32,
            width: 80,
            height: 80,
            borderRadius: 999,
            border: `5px solid ${islandTheme.color.panelBg}`,
            overflow: "visible"
          }}
        >
          <UserAvatar profile={profile} initials={initials} size={70} />
        </div>
      </div>

      <div style={{ padding: "44px 16px 12px" }}>
        <div className="island-display" style={{ fontWeight: 800, fontSize: 18 }}>
          {profile?.displayName ?? "Not signed in"}
        </div>
        <div
          className="island-mono"
          style={{ color: islandTheme.color.textMuted, fontSize: 12, marginTop: 1 }}
        >
          @{handle} · {discordId}
        </div>

        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            background: islandTheme.color.panelMutedBg,
            border: `1px solid ${islandTheme.color.cardBorder}`,
            borderRadius: 10,
            fontSize: 12
          }}
        >
          <div
            className="island-mono"
            style={{
              fontSize: 10,
              color: islandTheme.color.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 4
            }}
          >
            Custom status
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PulseDot />
            <span>{customStatus}</span>
          </div>
        </div>

        {profile?.richPresenceText ? (
          <div
            style={{
              marginTop: 8,
              padding: 12,
              background: `linear-gradient(135deg, rgba(37, 99, 235, 0.25) 0%, ${islandTheme.color.panelBg} 100%)`,
              border: "1px solid rgba(96, 165, 250, 0.35)",
              borderRadius: 10,
              display: "grid",
              gridTemplateColumns: "48px 1fr",
              gap: 10
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 8,
                background:
                  "repeating-linear-gradient(45deg, #1e2a44, #1e2a44 4px, #2a3a5e 4px, #2a3a5e 8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24
              }}
            >
              🎮
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{profile.richPresenceText}</div>
              {inVoice ? (
                <div
                  className="island-mono"
                  style={{ fontSize: 11, color: islandTheme.color.primaryGlow, marginTop: 4 }}
                >
                  ⏱ in voice channel
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            marginTop: 8,
            background: islandTheme.color.panelMutedBg,
            border: `1px solid ${islandTheme.color.cardBorder}`,
            borderRadius: 10,
            overflow: "hidden"
          }}
        >
          <Stat value="—" label="Steam library" />
          <Stat value="—" label="Nights this mo." separator />
          <Stat value="—" label="Crew overlap" />
        </div>

        <StatusPicker value={status} onChange={setStatus} />

        <SectionLabel>Account</SectionLabel>
        <MenuLink
          icon="🪪"
          onClick={() => {
            onClose();
            onNavigate("profile");
          }}
        >
          View profile
        </MenuLink>
        <MenuLink icon="⛵">
          Steam: {profile?.steamId64 ? "synced" : "not linked"}
        </MenuLink>
        <ThemeRow mode={mode} onToggle={toggle} />
        <MenuLink
          icon="↩"
          danger
          onClick={() => {
            onClose();
            onLogout();
          }}
        >
          Sign out of the island
        </MenuLink>
      </div>
    </div>
  );
}

function PulseDot() {
  return (
    <>
      <style>{`
        @keyframes islandUmPulse {
          0% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.45); }
          70% { box-shadow: 0 0 0 8px rgba(74, 222, 128, 0); }
          100% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); }
        }
      `}</style>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: "#4ade80",
          animation: "islandUmPulse 1.8s infinite"
        }}
      />
    </>
  );
}

function Stat({ value, label, separator }: { value: string; label: string; separator?: boolean }) {
  return (
    <div
      style={{
        padding: 10,
        textAlign: "center",
        borderRight: separator ? `1px solid ${islandTheme.color.cardBorder}` : undefined,
        borderLeft: separator ? `1px solid ${islandTheme.color.cardBorder}` : undefined
      }}
    >
      <div className="island-display" style={{ fontWeight: 700, fontSize: 18 }}>
        {value}
      </div>
      <div
        className="island-mono"
        style={{
          fontSize: 10,
          color: islandTheme.color.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginTop: 2
        }}
      >
        {label}
      </div>
    </div>
  );
}

const STATUS_OPTIONS: Array<{ id: UserStatus; label: string; color: string }> = [
  { id: "online", label: "Online", color: "#4ade80" },
  { id: "idle", label: "Idle", color: "#facc15" },
  { id: "dnd", label: "DND", color: "#ef4444" },
  { id: "invisible", label: "Hidden", color: "#94a3b8" }
];

function StatusPicker({ value, onChange }: { value: UserStatus; onChange: (v: UserStatus) => void }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        marginTop: 8,
        padding: 4,
        background: islandTheme.color.panelMutedBg,
        border: `1px solid ${islandTheme.color.cardBorder}`,
        borderRadius: 10
      }}
    >
      {STATUS_OPTIONS.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            style={{
              flex: 1,
              padding: "6px 4px",
              borderRadius: 7,
              border: 0,
              background: active ? islandTheme.color.primary : "transparent",
              color: active ? "#fff" : islandTheme.color.textSubtle,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: opt.color
              }}
            />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      className="island-mono"
      style={{
        padding: "8px 4px 4px",
        fontSize: 10,
        color: islandTheme.color.textMuted,
        textTransform: "uppercase",
        letterSpacing: "0.08em"
      }}
    >
      {children}
    </div>
  );
}

type MenuLinkProps = {
  icon: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  rightSlot?: ReactNode;
};

function MenuLink({ icon, children, onClick, danger, rightSlot }: MenuLinkProps) {
  const baseStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    borderRadius: 8,
    color: danger ? "#fca5a5" : islandTheme.color.textSubtle,
    cursor: onClick ? "pointer" : "default",
    fontSize: 13,
    border: "none",
    background: "transparent",
    textAlign: "left",
    width: "100%",
    font: "inherit"
  };
  return (
    <button
      type="button"
      onClick={onClick}
      style={baseStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger
          ? "rgba(127, 29, 29, 0.3)"
          : islandTheme.color.secondary;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <span style={{ width: 18, textAlign: "center", opacity: 0.85 }}>{icon}</span>
      <span style={{ flex: 1 }}>{children}</span>
      {rightSlot}
    </button>
  );
}

function ThemeRow({ mode, onToggle }: { mode: "day" | "night"; onToggle: () => void }) {
  const day = mode === "day";
  return (
    <MenuLink
      icon={day ? "☀️" : "🌙"}
      onClick={onToggle}
      rightSlot={
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: islandTheme.color.textMuted }}>{day ? "Day" : "Night"}</span>
          <ThemeSwitch on={day} />
        </span>
      }
    >
      Theme
    </MenuLink>
  );
}

function ThemeSwitch({ on }: { on: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 44,
        height: 24,
        borderRadius: 999,
        background: on ? "rgba(244, 162, 97, 0.45)" : islandTheme.color.panelMutedBg,
        border: `1px solid ${islandTheme.color.cardBorder}`,
        position: "relative",
        transition: "background 320ms ease",
        flexShrink: 0
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 22 : 2,
          width: 18,
          height: 18,
          borderRadius: 999,
          background: on
            ? "linear-gradient(135deg, #fde68a, #f59e0b)"
            : "linear-gradient(135deg, #e2e8f0, #94a3b8)",
          transition: "left 320ms cubic-bezier(.5,0,.25,1), background 320ms",
          boxShadow: "0 2px 6px rgba(0,0,0,0.4)"
        }}
      />
    </span>
  );
}
