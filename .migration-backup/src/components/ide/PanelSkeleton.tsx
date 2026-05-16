export function FileTreeSkeleton() {
  return (
    <div className="p-3 space-y-2 animate-pulse">
      <div className="h-4 w-16 bg-muted rounded" />
      <div className="space-y-1.5 pl-2">
        <div className="h-3.5 w-24 bg-muted/70 rounded" />
        <div className="h-3.5 w-20 bg-muted/70 rounded" />
        <div className="h-3.5 w-28 bg-muted/70 rounded" />
      </div>
    </div>
  );
}

export function ChatSkeleton() {
  return (
    <div className="flex flex-col h-full p-4 space-y-3 animate-pulse">
      <div className="h-5 w-24 bg-muted rounded" />
      <div className="flex-1 space-y-4">
        <div className="flex gap-2">
          <div className="h-6 w-6 bg-muted rounded-full shrink-0" />
          <div className="space-y-1.5 flex-1">
            <div className="h-3 w-3/4 bg-muted/70 rounded" />
            <div className="h-3 w-1/2 bg-muted/70 rounded" />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <div className="space-y-1.5 flex-1 max-w-[80%]">
            <div className="h-3 w-full bg-primary/20 rounded" />
            <div className="h-3 w-2/3 bg-primary/20 rounded" />
          </div>
        </div>
      </div>
      <div className="h-10 bg-muted rounded" />
    </div>
  );
}

export function EditorSkeleton() {
  return (
    <div className="h-full p-4 space-y-2 animate-pulse">
      <div className="flex gap-2 mb-4">
        <div className="h-7 w-20 bg-muted rounded" />
        <div className="h-7 w-16 bg-muted/60 rounded" />
      </div>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="h-3 w-6 bg-muted/40 rounded" />
          <div
            className="h-3 bg-muted/50 rounded"
            style={{ width: `${30 + Math.random() * 50}%` }}
          />
        </div>
      ))}
    </div>
  );
}

export function PreviewSkeleton() {
  return (
    <div className="h-full flex items-center justify-center animate-pulse">
      <div className="space-y-3 text-center">
        <div className="h-8 w-8 bg-muted rounded-lg mx-auto" />
        <div className="h-3 w-20 bg-muted/70 rounded mx-auto" />
      </div>
    </div>
  );
}
