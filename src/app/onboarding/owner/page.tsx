import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OwnerOnboardingForm from "@/components/OwnerOnboardingForm";
import { TRIAL_DAYS } from "@/config/brand";

export const metadata = { title: "Set up your business" };

export default async function OwnerOnboarding() {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/auth?as=business&next=/onboarding/owner");

  // Already has a business? Go to dashboard.
  const { data: existing } = await supabase
    .from("restaurants")
    .select("id")
    .eq("owner_id", auth.user.id)
    .maybeSingle();
  if (existing) redirect("/owner");

  return (
    <main className="mx-auto max-w-md px-5 py-8 lg:max-w-5xl">
      <div className="eyebrow text-brand">Setup · {TRIAL_DAYS} days free</div>
      <h1 className="display mt-2 text-[40px]">
        Build your
        <br />
        <span className="tape bg-accent text-accent-ink">loyalty card.</span>
      </h1>
      <p className="mt-3 max-w-md font-medium text-ink-2">
        Two minutes, six fields. Everything here is editable later — nothing is locked in.
      </p>

      <OwnerOnboardingForm />
    </main>
  );
}
