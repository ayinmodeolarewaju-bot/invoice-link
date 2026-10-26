export function Mark({ size = 28 }: { size?: number }) {
  return (
    <span className="grid place-items-center rounded-lg bg-ink" style={{ width: size, height: size }}>
      <svg width={size * 0.57} height={size * 0.57} viewBox="0 0 24 24" fill="none" stroke="#2BD4A4" strokeWidth="2.6" strokeLinecap="round">
        <path d="M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1 1" /><path d="M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6" />
      </svg>
    </span>
  );
}
export function Logo() {
  return <a href="/" className="flex items-center gap-2.5 text-[17px] font-bold tracking-[-.02em]"><Mark />Invoice Link</a>;
}
