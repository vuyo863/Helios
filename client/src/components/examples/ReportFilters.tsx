import ReportFilters from '../ReportFilters';

export default function ReportFiltersExample() {
  const handleFilterChange = (filters: { startDate: string; endDate: string; periodType: string }) => {
    console.log('Filters changed:', filters);
  };

  return (
    <div className="p-6 bg-background">
      <ReportFilters onFilterChange={handleFilterChange} />
    </div>
  );
}
