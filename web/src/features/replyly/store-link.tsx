export function StoreLink({ packageName }: { packageName: string }) {
  return (
    <a
      href={`https://play.google.com/store/apps/details?id=${encodeURIComponent(packageName)}`}
      target="_blank"
      rel="noreferrer"
      className="rp-store-link"
      aria-label={`Open ${packageName} on Google Play`}
      title="Open on Google Play"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
        <path
          d="M5 2H2.5A.5.5 0 0 0 2 2.5v7a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5V7M7 2h3v3M10 2 5.5 6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
}
