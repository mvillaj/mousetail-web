import type { SVGProps } from 'react';

/**
 * A generic espresso machine, drawn to sit beside lucide icons: 24px grid,
 * 2px round strokes, currentColor. Lucide has no espresso machine, and a
 * product photo would mean using Fellow's imagery.
 */
export function EspressoMachineIcon({
  size = 24,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Body, with a gauge and a control strip */}
      <rect x="3" y="3" width="18" height="6" rx="1.5" />
      <circle cx="7" cy="6" r="0.5" />
      <path d="M11 6h6" />
      {/* Side column and drip-tray base */}
      <path d="M19 9v12" />
      <path d="M3 21h18" />
      {/* Group head */}
      <path d="M9 9v2h5V9" />
      {/* Cup */}
      <path d="M9 15h5v3a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2z" />
    </svg>
  );
}
