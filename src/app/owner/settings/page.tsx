import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OwnerSettingsForm from "@/components/OwnerSettingsForm";
import BranchManager from "@/components/BranchManager";
import BrandThemePicker from "@/components/BrandThemePicker";
import { TIERS, TierId } from "@/config/brand";
import type { Restaurant, Branch, Subscription } from "@/lib/types";

export const metadata = { title: "Business settings" };

export default async function OwnerSettings() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/auth?as=business&next=/owner/settings");

  const { data: r } = await supabase
    .from("restaurants")
    .select("*")
    .eq("owner_id", auth.user.id)
    .maybeSingle<Restaurant>();
  if (!r) redirect("/onboarding/owner");

  const [{ data: sub }, { data: branches }] = await Promise.all([
    supabase.from("subscriptions").select("tier").eq("restaurant_id", r.id).maybeSingle<Pick<Subscription, "tier">>(),
    supabase.from("branches").select("*").eq("restaurant_id", r.id).order("created_at").returns<Branch[]>(),
  ]);

  const tier = TIERS[(sub?.tier as TierId) ?? "basic"];

  return (
    <main className="mx-auto max-w-md px-5 py-8 lg:max-w-2xl">
      <Link href="/owner" className="text-sm text-brand lg:hidden">
        ← Dashboard
      </Link>
      <div className="label mt-2">{r.name}</div>
      <h1 className="display mt-1 text-[34px]">Settings</h1>
      <p className="mt-1.5 font-medium text-ink-2">Everything customers see and earn.</p>

      <section className="mt-6">
        <h2 className="label mb-2">Branding</h2>
        <BrandThemePicker
          restaurantId={r.id}
          initialBrand={r.brand_color}
          initialAccent={r.accent_color}
          initialWhiteLabel={r.white_label}
          canWhiteLabel={tier.id !== "basic"}
        />
      </section>

      <OwnerSettingsForm restaurant={r} />

      <section className="mt-8">
        <h2 className="label mb-1">Locations &amp; GPS</h2>
        <BranchManager
          restaurantId={r.id}
          initial={branches ?? []}
          maxLocations={tier.maxLocations}
          gpsEnabled={tier.gpsBranch}
        />
      </section>
    </main>
  );
}
