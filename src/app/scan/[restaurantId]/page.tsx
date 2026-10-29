import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Physical QR stands point here (/scan/<restaurantId>).
 * We resolve the shop and forward to its page, where the customer collects a stamp.
 */
export default async function ScanRedirect({ params }: { params: { restaurantId: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from("restaurants")
    .select("slug")
    .eq("id", params.restaurantId)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) notFound();
  redirect(`/shop/${data.slug}?scan=1`);
}
