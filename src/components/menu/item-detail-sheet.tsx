"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Fraunces } from "next/font/google";
import { ImageOff, Star, X } from "lucide-react";
import { cloudinaryLoader } from "@/lib/images/cloudinary";
import { cn } from "@/lib/utils";
import type { MenuItem } from "@/lib/menu/types";

// Scoped to this one file — next/font/google's build-time transform only
// bundles this for routes that actually import this component. Playfair
// Display (font-heading, used elsewhere in this sheet) is already loaded
// globally — this is deliberately a second, different display face for the
// price only.
const priceFont = Fraunces({ subsets: ["latin"], weight: ["700", "900"], display: "swap" });

// Full-screen slide-up detail sheet, rendered once at MenuHome's top level
// (not per-row inside ItemCard), since only one item is ever expanded at a
// time (useMenuUrlState's single-expand/URL-sync rule). Satisfies
// specs/002-public-menu-home's inline-expand requirement (FR-002e–i) as a
// modal sheet rather than an inline accordion — it covers the row entirely
// behind the dimmed backdrop, so unlike an accordion it has to be
// self-contained: it shows name/price/best-seller/sold-out itself.
//
// Animation: slides both ways (translate-y-full <-> translate-y-0), via a
// brief setTimeout so the browser paints the closed position first before
// transitioning to open. Closing plays the same transition in reverse before
// telling the parent to actually unmount — `onClose` fires only after the
// transition's own duration elapses, not immediately on click/Escape/backdrop
// tap. Deliberately setTimeout, not requestAnimationFrame: browsers suspend
// rAF callbacks whenever the tab is backgrounded, which setTimeout isn't
// subject to.
const TRANSITION_MS = 300;

export function ItemDetailSheet({
  item,
  categoryName,
  showCategory,
  onClose,
}: {
  item: MenuItem;
  categoryName: string;
  showCategory: boolean;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setOpen(true), 20);
    return () => clearTimeout(id);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setTimeout(onClose, TRANSITION_MS);
  }, [onClose]);

  // Body scroll lock while the sheet is open — standard modal behavior,
  // restores whatever the previous inline value was on close/unmount.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);

  return (
    // `absolute`, not `fixed` — deliberately scoped to the app's own
    // `relative`-positioned mobile-frame wrapper (src/app/menu/[slug]/
    // page.tsx), not the browser viewport.
    <div className="absolute inset-0 z-50" role="dialog" aria-modal="true" aria-label={item.name}>
      {/* Dimmed backdrop — the page behind (hero, search, tabs, the tapped
          row) stays visible but darkened; tapping it closes the sheet, same
          as the close button. */}
      <button
        type="button"
        aria-label="Close"
        onClick={handleClose}
        className="absolute inset-0 bg-black/75"
      />

      <div
        className={cn(
          // No `overflow-hidden` here — this outer box must NOT clip its own
          // children, because the close button below is deliberately
          // positioned half above this box's own top edge (to float over the
          // backdrop/sheet boundary). The rounded top corners still need
          // something to actually clip content to them, so that job moved to
          // the inner scrollable wrapper below, which only wraps the
          // photo/text content, not this button. `duration-300` here must
          // match TRANSITION_MS above — handleClose waits exactly that long
          // before telling the parent to unmount.
          "absolute inset-x-0 bottom-0 flex max-h-[85vh] min-h-[60vh] flex-col rounded-t-3xl bg-card transition-transform duration-300 ease-out",
          open ? "translate-y-0" : "translate-y-full"
        )}
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="absolute left-1/2 top-0 z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-foreground shadow-md"
        >
          <X size={20} />
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-t-3xl">
          <div
            className={cn(
              "relative h-[28vh] w-full shrink-0 bg-gradient-to-br from-primary to-chart-2 text-primary-foreground/80",
              item.isSoldOut && "grayscale-[70%]"
            )}
          >
            {item.photoUrl ? (
              <Image
                loader={cloudinaryLoader}
                src={item.photoUrl}
                alt=""
                fill
                sizes="(min-width: 430px) 430px, 100vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ImageOff size={48} strokeWidth={1.2} className="opacity-85" />
              </div>
            )}
            {item.isSoldOut && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <span className="font-heading text-xl font-bold text-white">Sold Out</span>
              </div>
            )}
          </div>

          <div className="px-5 pb-8 pt-5">
            <div
              className={cn(
                priceFont.className,
                "text-right text-4xl font-bold text-accent tabular-nums"
              )}
            >
              ₱
              {item.price.toLocaleString("en-PH", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="mt-1 flex items-center gap-1.5 font-heading text-xl font-bold">
              <span>{item.name}</span>
              {item.isBestSeller && (
                <Star size={18} className="shrink-0 fill-warning text-warning" aria-label="Best seller" />
              )}
            </div>
            {item.description && (
              <p className="mt-3 text-[0.92rem] leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            )}
            {item.ingredients.length > 0 && (
              <p className="mt-2 text-[0.85rem] leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Ingredients: </span>
                {item.ingredients.map((ingredient) => ingredient.name).join(", ")}
              </p>
            )}
            {/* One pill for this item's actual category — the data model has
                exactly one category per item. Shown only when this item was
                opened via a search result (showCategory) — redundant
                otherwise, since the customer just tapped this exact
                category's own tab to get here (specs/002 FR-002h/FR-002i). */}
            {showCategory && (
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-primary px-3.5 py-1.5 text-[0.82rem] font-medium text-primary">
                  {categoryName}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
