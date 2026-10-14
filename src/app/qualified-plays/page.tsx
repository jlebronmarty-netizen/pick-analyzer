import DashboardShell from "@/components/dashboard/DashboardShell";
import QualifiedPlaysPanel from "@/components/dashboard/QualifiedPlaysPanel";
import { getQualifiedPlaysReport } from "@/services/qualified-plays-read.service";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function QualifiedPlaysPage() {
  const report = await getQualifiedPlaysReport();
  return (
    <DashboardShell>
      <QualifiedPlaysPanel report={report} />
    </DashboardShell>
  );
}
