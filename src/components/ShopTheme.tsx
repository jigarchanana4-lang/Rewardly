import { shopThemeCss } from "@/lib/theme";

/**
 * Wraps a shop's own surfaces in its brand colours.
 *
 * Scoped by shop id, so the marketplace around it keeps the Rewardly palette —
 * a customer still sees one product, the shop still sees its own brand.
 */
export default function ShopTheme({
  id,
  brand,
  accent,
  className,
  children,
}: {
  id: string;
  brand?: string | null;
  accent?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  const css = shopThemeCss(id, { brand: brand ?? undefined, accent: accent ?? undefined });

  return (
    <div data-shop-theme={id} className={className}>
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      {children}
    </div>
  );
}
