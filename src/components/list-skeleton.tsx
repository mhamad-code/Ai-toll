import { Item, ItemContent, ItemGroup, ItemMedia } from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"

/** Placeholder rows shaped like the model and connector rows while they load. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ItemGroup className="gap-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <Item key={index} variant="outline">
          <ItemMedia>
            <Skeleton className="size-9 rounded-full" />
          </ItemMedia>
          <ItemContent>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <div className="flex gap-1.5 pt-1">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  )
}
