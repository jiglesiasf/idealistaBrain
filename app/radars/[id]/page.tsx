import { redirect, notFound } from "next/navigation";
import { getRadarDetail } from "@/lib/alerts/service";
import { createClient } from "@/lib/supabase/server";
import { RadarDetailClient } from "@/components/radar-detail-client";

export default async function RadarDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  try {
    const detail = await getRadarDetail(supabase, user.id, id);
    return <RadarDetailClient radar={detail.radar} listings={detail.listings} />;
  } catch {
    notFound();
  }
}
