import { SearchTrigger } from "@/components/nav/search-trigger";

export function UtilityBar() {
  return (
    <div className="hidden items-center gap-2 md:flex">
      <SearchTrigger />
    </div>
  );
}
