import { createFileRoute } from "@tanstack/react-router";

import DashboardGreeting from "@/features/dashboard/components/dashboard-greeting";
import MyPerformanceCard from "@/features/dashboard/components/my-performance-card";
import UpNextCard from "@/features/perjalanan-dinas/components/up-next-card";
import FavoriteProcessesCard from "@/features/processes/components/favorite-processes-card";

export const Route = createFileRoute("/_auth/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { user } = Route.useRouteContext();

  return (
    <>
      <DashboardGreeting name={user.name} />
      <FavoriteProcessesCard />
      <div className="grid items-start gap-6 xl:grid-cols-[3fr_2fr]">
        <UpNextCard />
        <MyPerformanceCard />
      </div>
    </>
  );
}
