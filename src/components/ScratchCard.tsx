"use client";

import { useRef, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Canvas scratch-to-reveal. The prize is decided server-side (reveal_scratch RPC);
 * scratching is purely cosmetic so the outcome can't be gamed on the client.
 */
export default function ScratchCard({ restaurantId }: { restaurantId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [prize, setPrize] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("reveal_scratch", {
        p_restaurant_id: restaurantId,
      });
      setLoading(false);
      if (!error && data) {
        setPrize((data as { prize: string }).prize);
        if ((data as { is_claimed: boolean }).is_claimed) setRevealed(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || revealed) return;
    const ctx = c.getContext("2d")!;
    // Ultraviolet foil with a diagonal sheen — brand-coloured, not gold leaf.
    const foil = ctx.createLinearGradient(0, 0, c.width, c.height);
    foil.addColorStop(0, "#4B21F5");
    foil.addColorStop(0.45, "#7B5CFF");
    foil.addColorStop(0.5, "#A99BFF");
    foil.addColorStop(0.55, "#7B5CFF");
    foil.addColorStop(1, "#3A15C7");
    ctx.fillStyle = foil;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.font = "800 19px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.letterSpacing = "2px";
    ctx.fillText("SCRATCH HERE", c.width / 2, c.height / 2 + 6);

    let scratched = 0;
    const total = c.width * c.height;
    const scratch = (x: number, y: number) => {
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fill();
      scratched += 1500;
      if (scratched > total * 0.5) setRevealed(true);
    };
    const pos = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      scratch(((e.clientX - r.left) / r.width) * c.width, ((e.clientY - r.top) / r.height) * c.height);
    };
    let down = false;
    c.addEventListener("pointerdown", () => (down = true));
    c.addEventListener("pointerup", () => (down = false));
    c.addEventListener("pointermove", (e) => down && pos(e));
  }, [revealed, prize]);

  if (loading) return <div className="card animate-pulse text-center text-ink-2">Loading scratch card…</div>;
  if (!prize) return null;

  return (
    <div className="card-pop text-center">
      <div className="label mb-3">Scratch &amp; win</div>
      <div className="relative mx-auto h-40 w-full max-w-xs overflow-hidden rounded-md border-2 border-edge bg-accent">
        <div className="absolute inset-0 grid place-items-center px-4">
          <div>
            <div className="eyebrow text-accent-ink/70">You won</div>
            <div className="display mt-1 text-3xl text-accent-ink">{prize}</div>
          </div>
        </div>
        {!revealed && (
          <canvas
            ref={canvasRef}
            width={320}
            height={160}
            className="absolute inset-0 h-full w-full cursor-grab touch-none active:cursor-grabbing"
          />
        )}
      </div>
      <p className="mt-3 text-sm font-medium text-ink-2">
        {revealed ? "Show this to staff to claim your gift." : "Drag across the foil to reveal your prize."}
      </p>
    </div>
  );
}
