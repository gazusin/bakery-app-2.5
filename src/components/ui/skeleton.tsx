import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

function CardSkeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-lg border bg-card p-6 space-y-3", className)} {...props}>
      <Skeleton className="h-4 w-[100px]" />
      <Skeleton className="h-8 w-[120px]" />
      <Skeleton className="h-3 w-full" />
    </div>
  )
}

export { Skeleton, CardSkeleton }
