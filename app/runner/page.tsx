import { redirect } from "next/navigation";
import { RunnerClient } from "@/components/runner-client";
import { createClient } from "@/lib/supabase/server";

export default async function RunnerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="stack">
      <RunnerClient />
    </div>
  );
}
