import { notFound, redirect } from "next/navigation";
import { JobStatusClient } from "@/components/job-status-client";
import { getJobView } from "@/lib/jobs/service";
import { createClient } from "@/lib/supabase/server";

export default async function JobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ dispatch?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const job = await getJobView(supabase, user.id, id);

  if (!job) {
    notFound();
  }

  return <JobStatusClient initialJob={job} dispatchFailed={query.dispatch === "failed"} />;
}
