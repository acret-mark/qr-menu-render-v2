import Image from "next/image";
import { ImageOff, Star } from "lucide-react";
import { cloudinaryLoader } from "@/lib/images/cloudinary";
import { cn } from "@/lib/utils";
import type { MenuItem } from "@/lib/menu/types";

// Tapping a row opens ItemDetailSheet at MenuHome's top level (a slide-up
// modal over a dimmed backdrop) — this row doesn't render any detail itself.
export function ItemCard({
  item,
  onToggle,
}: {
  item: MenuItem;
  onToggle: () => void;
}) {
  return (
    <button type="button" onClick={onToggle} className="flex w-full gap-4 text-left">
      <div
        className={cn(
          "relative h-32 w-32 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-chart-2 text-primary-foreground/80",
          item.isSoldOut && "grayscale-[70%]"
        )}
      >
        {item.photoUrl ? (
          <Image
            loader={cloudinaryLoader}
            src={item.photoUrl}
            alt=""
            fill
            sizes="128px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageOff size={36} strokeWidth={1.5} className="opacity-85" />
          </div>
        )}
        {/* Sold-out renders as a banner overlaid on the thumbnail; price
            stays visible and the item stays in its normal position
            (specs/001-sold-out-best-seller FR-001/FR-002). */}
        {item.isSoldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="font-heading text-base font-bold text-white">Sold Out</span>
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col pt-1">
        <div className="flex items-center gap-1.5 font-heading text-[1.05rem] font-bold">
          <span className="truncate">{item.name}</span>
          {item.isBestSeller && (
            <Star size={16} className="shrink-0 fill-warning text-warning" aria-label="Best seller" />
          )}
        </div>
        {item.description && (
          <div className="mt-1 line-clamp-2 text-[0.85rem] text-muted-foreground">
            {item.description}
          </div>
        )}
        <div className="mt-2 text-[1.05rem] font-bold text-accent tabular-nums">
          ₱{item.price.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
        </div>
      </div>
    </button>
  );
}
