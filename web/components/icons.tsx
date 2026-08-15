/**
 * A small, dependency-free stroke icon set.
 *
 * Icons here are affordances and wayfinding marks, never decoration and never
 * the sole carrier of meaning — every icon in the console sits beside a word.
 * All of them are `aria-hidden` by default so a screen reader hears the label
 * once, not twice.
 */
import type { CSSProperties } from 'react';

export type IconName =
  | 'alert'
  | 'audit'
  | 'back'
  | 'ban'
  | 'beaker'
  | 'bell'
  | 'calendar'
  | 'check'
  | 'checkCircle'
  | 'chevronDown'
  | 'chevronLeft'
  | 'chevronRight'
  | 'clock'
  | 'copy'
  | 'droplet'
  | 'file'
  | 'flask'
  | 'help'
  | 'history'
  | 'inbox'
  | 'info'
  | 'layers'
  | 'logOut'
  | 'mapPin'
  | 'notes'
  | 'refresh'
  | 'search'
  | 'shield'
  | 'sliders'
  | 'sort'
  | 'thermometer'
  | 'tool'
  | 'upload'
  | 'user'
  | 'waves'
  | 'xCircle';

/** Each entry is the inner markup of a 24×24, currentColor stroke icon. */
const PATHS: Record<IconName, React.ReactNode> = {
  alert: (
    <>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4.5M12 17.2h.01" />
    </>
  ),
  audit: (
    <>
      <path d="M9 3h6v3H9z" />
      <path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <path d="m8.8 13.8 2 2 4.4-4.4" />
    </>
  ),
  back: <path d="M19 12H5m0 0 6-6m-6 6 6 6" />,
  ban: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.6 5.6 12.8 12.8" />
    </>
  ),
  beaker: (
    <>
      <path d="M9 3h6M10 3v6l-5.4 9A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.7-3L14 9V3" />
      <path d="M7.6 14.5h8.8" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8.5a6 6 0 1 0-12 0c0 6.5-2.5 8.5-2.5 8.5h17S18 15 18 8.5Z" />
      <path d="M13.7 20.5a2 2 0 0 1-3.4 0" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="16.5" rx="2" />
      <path d="M8 2.5v4M16 2.5v4M3 10h18" />
    </>
  ),
  check: <path d="m4.5 12.5 5 5 10-11" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.2 12.3 2.6 2.6 5-5.4" />
    </>
  ),
  chevronDown: <path d="m6 9.5 6 6 6-6" />,
  chevronLeft: <path d="M14.5 5 8 12l6.5 7" />,
  chevronRight: <path d="M9.5 5 16 12l-6.5 7" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.3l3.3 2" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11.5" height="11.5" rx="2" />
      <path d="M5.5 15H5a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 5 3h9a1.5 1.5 0 0 1 1.5 1.5V5" />
    </>
  ),
  droplet: <path d="M12 2.8s6.3 6.8 6.3 11a6.3 6.3 0 0 1-12.6 0C5.7 9.6 12 2.8 12 2.8Z" />,
  file: (
    <>
      <path d="M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2.5V8h5.5M8.5 13.5h7M8.5 17.2h4.5" />
    </>
  ),
  flask: (
    <>
      <path d="M9.5 2.5v6.2L4.8 17a2.4 2.4 0 0 0 2 3.6h10.4a2.4 2.4 0 0 0 2-3.6l-4.7-8.3V2.5" />
      <path d="M8.2 2.5h7.6M7.4 14.6h9.2" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.4 9.3a2.7 2.7 0 0 1 5.3.7c0 1.8-2.7 2.4-2.7 4M12 17.2h.01" />
    </>
  ),
  history: (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3 8.6" />
      <path d="M3 3.5V9h5.5M12 7.5V12l3 1.8" />
    </>
  ),
  inbox: (
    <>
      <path d="M21.5 12.5h-5.4l-1.7 3H9.6l-1.7-3H2.5" />
      <path d="M5.9 4.9h12.2l3.4 7.6v5.6a2 2 0 0 1-2 2H4.5a2 2 0 0 1-2-2v-5.6Z" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16.4v-4.8M12 8.2h.01" />
    </>
  ),
  layers: (
    <>
      <path d="m12 2.8 8.6 4.6L12 12 3.4 7.4Z" />
      <path d="m3.4 12 8.6 4.6L20.6 12M3.4 16.6 12 21.2l8.6-4.6" />
    </>
  ),
  logOut: (
    <>
      <path d="M9.5 21H5.5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 16.5 4.5-4.5L16 7.5M20.5 12h-11" />
    </>
  ),
  mapPin: (
    <>
      <path d="M20.5 10.4c0 5.8-8.5 11.4-8.5 11.4S3.5 16.2 3.5 10.4a8.5 8.5 0 0 1 17 0Z" />
      <circle cx="12" cy="10.2" r="2.9" />
    </>
  ),
  notes: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
      <path d="M7.5 8.5h9M7.5 12h9M7.5 15.5h5" />
    </>
  ),
  refresh: (
    <>
      <path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" />
      <path d="M21 3.5V9h-5.5" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="7" />
      <path d="m20.5 20.5-4.7-4.7" />
    </>
  ),
  shield: <path d="M12 21.5s7.8-3.7 7.8-9.6V5.4L12 2.5 4.2 5.4v6.5c0 5.9 7.8 9.6 7.8 9.6Z" />,
  sliders: (
    <>
      <path d="M4 21v-6.5M4 10.5V3M12 21v-8.5M12 8.5V3M20 21v-4.5M20 12.5V3" />
      <path d="M1.5 14.5h5M9.5 8.5h5M17.5 16.5h5" />
    </>
  ),
  sort: (
    <>
      <path d="M6.5 3.5v17M6.5 3.5 3 7M6.5 3.5 10 7" />
      <path d="M13 6h8M13 12h6M13 18h4" />
    </>
  ),
  thermometer: <path d="M14.2 14.9V5.2a2.2 2.2 0 1 0-4.4 0v9.7a4.4 4.4 0 1 0 4.4 0Z" />,
  tool: (
    <>
      <path d="M14.9 6.3a4.2 4.2 0 0 1-5.5 5.5L3.6 17.6V20.5h2.9l5.8-5.8a4.2 4.2 0 0 1 5.5-5.5l-2.6 2.6-2.1-.5-.5-2.1Z" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16.2V3.8M7.2 8.6 12 3.8l4.8 4.8" />
      <path d="M3.8 20.2h16.4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  waves: (
    <>
      <path d="M2 7.6c2.6-2 5.1-2 7.7 0s5.1 2 7.7 0 4.6-1.4 4.6-1.4" />
      <path d="M2 12.6c2.6-2 5.1-2 7.7 0s5.1 2 7.7 0 4.6-1.4 4.6-1.4" />
      <path d="M2 17.6c2.6-2 5.1-2 7.7 0s5.1 2 7.7 0 4.6-1.4 4.6-1.4" />
    </>
  ),
  xCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6" />
    </>
  ),
};

export function Icon({
  name,
  size = 16,
  className,
  style,
  strokeWidth = 1.7,
  title,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
  /** Only pass this when the icon is genuinely the only label. */
  title?: string;
}) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name]}
    </svg>
  );
}
