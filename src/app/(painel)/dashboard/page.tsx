import ProductionDashboard, {type DashboardFilters} from "@/components/production-dashboard";

export default function DashboardPage({searchParams}:{searchParams:Promise<DashboardFilters>}) {
  return <ProductionDashboard searchParams={searchParams}/>;
}
