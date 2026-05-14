import type { JobStatus } from "@/lib/jobs/contracts";

const LABELS: Record<JobStatus, string> = {
  queued: "En cola",
  dispatching: "Enviando",
  running: "En marcha",
  completed: "Completado",
  failed: "Fallido",
};

export function StatusBadge({ status }: { status: JobStatus }) {
  return <span className={`badge ${status}`}>{LABELS[status]}</span>;
}
