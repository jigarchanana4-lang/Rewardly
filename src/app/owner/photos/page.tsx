import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import YummyCam from "@/components/YummyCam";
import CreditsCard from "@/components/CreditsCard";
import type { Restaurant } from "@/lib/types";

export const metadata = { title: "Photo studio" };

export default async function PhotosPage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/auth?as=business&next=/owner/photos");

  const { data: r } = await supabase
    .from("restaurants")
    .select("id, credits")
    .eq("owner_id", auth.user.id)
    .maybeSingle<Pick<Restaurant, "id" | "credits">>();
  if (!r) redirect("/onboarding/owner");

  return (
    <main className="mx-auto max-w-md px-5 py-8 lg:max-w-5xl">
      <Link href="/owner" className="text-sm font-bold text-brand underline decoration-2 underline-offset-4 lg:hidden">
        ← Dashboard
      </Link>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="label">Photo studio</div>
        <CreditsCard credits={r.credits} compact />
      </div>
      <h1 className="display mt-1 text-[34px]">Make your food look as good as it tastes</h1>
      <p className="mt-1.5 max-w-xl font-medium text-ink-2">
        Fix the lighting and colour on your own photos, then save them sized for your menu, Swiggy,
        Zomato or Instagram. Everything happens on your phone — your photos are never uploaded.
      </p>
      <YummyCam restaurantId={r.id} credits={r.credits} />
    </main>
  );
}
