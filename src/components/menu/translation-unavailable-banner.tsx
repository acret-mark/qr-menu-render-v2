// Shown when a manually-selected display language couldn't be fetched (e.g.
// the request failed) and the menu is falling back to showing the
// business's original-language text instead — so that fallback is never
// mistaken for a real translation (specs/002-public-menu-home FR-014).
export function TranslationUnavailableBanner() {
  return (
    <div
      role="status"
      className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-center text-[0.8rem] text-warning-foreground"
    >
      Showing original text — translation isn&rsquo;t available right now.
    </div>
  );
}
