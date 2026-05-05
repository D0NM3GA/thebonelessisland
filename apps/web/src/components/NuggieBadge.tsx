import { EquippedItem, NuggiesShopItem } from "../types.js";

type Item = EquippedItem | NuggiesShopItem;

type Props = {
  item: Item;
  size?: "sm" | "md";
};

export function NuggieBadge({ item, size = "md" }: Props) {
  const { itemData, itemType } = item;
  const isTitle = itemType === "title";
  const px = size === "sm" ? "0.35rem 0.6rem" : "0.4rem 0.75rem";
  const fontSize = size === "sm" ? "0.72rem" : "0.8rem";
  const label = isTitle && itemData.label ? ` ${itemData.label}` : "";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        padding: px,
        borderRadius: 999,
        fontSize,
        fontWeight: 600,
        lineHeight: 1,
        background: `${itemData.color}22`,
        border: `1px solid ${itemData.color}55`,
        color: itemData.color,
        whiteSpace: "nowrap",
      }}
    >
      <span>{itemData.emoji}</span>
      {label && <span>{label}</span>}
    </span>
  );
}
