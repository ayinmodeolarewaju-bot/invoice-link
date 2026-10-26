import { Logo, Mark } from "./Logo";
export function TopBar({ right, compact }: { right?: React.ReactNode; compact?: boolean }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-ink/[.08] bg-paper/80 px-5 backdrop-blur md:px-8">
      {compact ? <span className="md:hidden"><Mark /></span> : null}
      <span className={compact ? "hidden md:block" : ""}><Logo /></span>
      <div className="flex items-center gap-3">{right}</div>
    </header>
  );
}
