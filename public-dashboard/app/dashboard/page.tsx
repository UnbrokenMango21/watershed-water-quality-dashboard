import { DashboardShell } from "@/components/DashboardShell";

export const metadata = {
  title: "Public Dashboard | Watershed Watch",
  description: "Explore approved water-quality observations and monitoring sites in the Watershed Watch public dashboard.",
};

export default function DashboardPage() {
  return <DashboardShell />;
}
