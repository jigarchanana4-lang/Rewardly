import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { one } from "@/lib/utils";
import AdminShopControls from "@/components/AdminShopControls";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/auth?next=/admin");

  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (role?.role !== "admin") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="text-4xl">🔒</div>
        <h1 className="mt-3 text-xl font-extrabold">Admins only</h1>
        <p className="mt-1 text-ink-2">This area is restricted.</p>
        <Link href="/" className="btn-ghost mt-4">Home</Link>
      </main>
    );
  }

  // Elevated reads via service role (admin already verified above).
  const svc = createServiceClient();
  const [
    { count: shops },
    { count: activeShops },
    { count: customers },
    { count: rewards },
    { count: campaigns },
    { data: list },
  ] = await Promise.all([
    svc.from("restaurants").select("id", { count: "exact", head: true }),
    svc.from("restaurants").select("id", { count: "exact", head: true }).eq("is_active", true),
    svc.from("profiles").select("id", { count: "exact", head: true }),
    svc.from("claimed_rewards").select("id", { count: "exact", head: true }),
    svc.from("campaigns").select("id", { count: "exact", head: true }),
    svc
      .from("restaurants")
      .select("id, name, slug, is_active, total_visits, created_at, profiles:owner_id(phone_number)")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <h1 className="display text-2xl">Admin console</h1>

      <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-5">
        <Stat label="Shops" value={shops ?? 0} />
        <Stat label="Active" value={activeShops ?? 0} />
        <Stat label="Customers" value={customers ?? 0} />
        <Stat label="Rewards" value={rewards ?? 0} />
        <Stat label="Campaigns" value={campaigns ?? 0} />
      </div>

      <h2 className="mb-2 mt-8 text-lg font-bold">Businesses</h2>
      <div className="space-y-2">
        {(list ?? []).map((s) => {
          const owner = one<{ phone_number?: string }>(s.profiles);
          return (
            <div key={s.id} className="card flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/shop/${s.slug}`} className="truncate font-semibold text-ink hover:text-brand">
                  {s.name}
                </Link>
                <div className="text-xs text-ink-2">
                  {owner?.phone_number ?? "—"} · {s.total_visits} visits ·{" "}
                  {new Date(s.created_at).toLocaleDateString()}
                </div>
              </div>
              <AdminShopControls restaurantId={s.id} isActive={s.is_active} />
            </div>
          );
        })}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-3 text-center">
      <div className="text-xl font-extrabold tabular-nums">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}
