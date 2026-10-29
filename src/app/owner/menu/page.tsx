import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MenuManager from "@/components/MenuManager";
import MenuImporter from "@/components/MenuImporter";
import MenuQRCard from "@/components/MenuQRCard";
import type { MenuCategory, MenuItem } from "@/lib/types";

export const metadata = { title: "Edit menu" };

export default async function OwnerMenu() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/auth?as=business&next=/owner/menu");

  const { data: r } = await supabase
    .from("restaurants")
    .select("id, slug")
    .eq("owner_id", auth.user.id)
    .maybeSingle();
  if (!r) redirect("/onboarding/owner");

  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase.from("menu_categories").select("*").eq("restaurant_id", r.id).order("sort_order").returns<MenuCategory[]>(),
    supabase.from("menu_items").select("*").eq("restaurant_id", r.id).order("sort_order").returns<MenuItem[]>(),
  ]);

  return (
    <main className="mx-auto max-w-md px-5 py-8 lg:max-w-3xl">
      <Link href="/owner" className="text-sm text-brand lg:hidden">
        ← Dashboard
      </Link>
      <h1 className="display mt-2 text-[34px]">Menu</h1>
      <p className="mt-1.5 font-medium text-ink-2">What customers see on your public page.</p>

      <div className="mt-6 lg:grid lg:grid-cols-[1fr_18rem] lg:items-start lg:gap-6">
        <MenuImporter restaurantId={r.id} existingCategories={categories ?? []} />
        <div className="mt-6 lg:mt-0">
          <MenuQRCard
            url={`${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/m/${r.slug}`}
            name={r.slug}
          />
        </div>
      </div>

      <div className="my-7 flex items-center gap-3">
        <span className="h-0.5 flex-1 bg-line" />
        <span className="label">or add by hand</span>
        <span className="h-0.5 flex-1 bg-line" />
      </div>

      <MenuManager restaurantId={r.id} initialCategories={categories ?? []} initialItems={items ?? []} />
    </main>
  );
}
