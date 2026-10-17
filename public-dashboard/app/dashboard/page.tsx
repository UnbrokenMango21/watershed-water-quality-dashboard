import { DashboardShell } from "@/components/DashboardShell";

export const metadata = {
  title: "Public dashboard",
  description: "Explore monitoring sites and approved water quality readings for Central Pennsylvania streams.",
};

export default function DashboardPage() {
  return <DashboardShell />;
}
