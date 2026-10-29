import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";
import SignOutButton from "@/components/SignOutButton";
import DeleteAccountButton from "@/components/DeleteAccountButton";
import PushToggle from "@/components/PushToggle";
import MarketingToggle from "@/components/MarketingToggle";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/auth?next=/profile");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone_number, has_restaurant, marketing_opt_in")
    .eq("id", auth.user.id)
    .maybeSingle();

  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  const isOwner = role?.role === "owner" || profile?.has_restaurant;

  return (
    <main className="mx-auto max-w-md px-4 pb-28 pt-6">
      <div className="label">Account</div>
      <h1 className="display mt-1 text-[34px]">Profile</h1>

      <div className="mt-4 rounded-lg border-2 border-edge bg-brand p-5 text-on-brand shadow-pop">
        <div className="eyebrow opacity-70">Signed in as</div>
        <div className="display mt-1 text-2xl">{profile?.full_name || "Add your name"}</div>
        <div className="mt-0.5 font-mono text-sm opacity-80">
          {profile?.phone_number || auth.user.phone}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {isOwner ? (
          <Link href="/owner" className="btn-brand w-full">
            Open business dashboard
          </Link>
        ) : (
          <Link href="/onboarding/owner" className="btn-ghost w-full">
            List your business
          </Link>
        )}
        <Link href="/rewards" className="btn-ghost w-full">
          My rewards
        </Link>
        <PushToggle />
        <MarketingToggle initial={profile?.marketing_opt_in ?? true} />
        {role?.role === "admin" && (
          <Link href="/admin" className="btn-ghost w-full">
            Admin console
          </Link>
        )}
        <SignOutButton />
        <DeleteAccountButton />
      </div>

      <BottomNav />
    </main>
  );
}
