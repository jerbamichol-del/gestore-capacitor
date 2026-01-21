import React, { useMemo } from "react";

type Props = {
  width?: string | number;
  height?: string | number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  className?: string;
  sunkHeight?: number;
};

/**
 * A smooth pull-tab shape with a uniform color and a pronounced drop shadow for a 3D effect.
 */
export default function SmoothPullTab({
  width = 192,
  height = 64,
  fill = "currentColor",
  stroke = "none",
  strokeWidth = 0,
  className = "",
  sunkHeight = 0,
}: Props) {
  const W = Number(width);
  const H = Number(height);
  const S = Number(sunkHeight);

  // Generate a unique ID for filters and clip-paths to avoid conflicts between instances
  const idSuffix = useMemo(() => Math.random().toString(36).substring(2, 9), []);
  const lightShadowId = `smooth-pull-tab-shadow-light-${idSuffix}`;
  const darkShadowId = `smooth-pull-tab-shadow-dark-${idSuffix}`;
  const clipId = `smooth-pull-tab-clip-${idSuffix}`;

  const topPlateauWidth = W * 0.35;
  const bulgeFactor = W * 0.25;
  const x1 = (W - topPlateauWidth) / 2;
  const x2 = x1 + topPlateauWidth;

  // The path 'd' defines the full shape including the "sunk" part
  const d = [
    `M 0 ${H}`,
    `C ${bulgeFactor} ${H}, ${x1 - bulgeFactor} 0, ${x1} 0`,
    `L ${x2} 0`,
    `C ${x2 + bulgeFactor} 0, ${W - bulgeFactor} ${H}, ${W} ${H}`,
    "Z",
  ].join(" ");

  // The visible height (where the panel edge is)
  const visibleH = H - S;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Linguetta"
      className={className}
      style={{ overflow: 'visible' }} // Essential for shadows
    >
      <defs>
        {/* Clip path: cuts off everything below the panel edge line */}
        <clipPath id={clipId}>
          <rect x="-100" y="-100" width={W + 200} height={visibleH} />
        </clipPath>

        {/* Light mode shadow */}
        <filter id={lightShadowId} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow
            dx="0"
            dy="-3"
            stdDeviation="5"
            floodColor="#475569"
            floodOpacity="0.6"
          />
        </filter>

        {/* Dark mode shadow */}
        <filter id={darkShadowId} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow
            dx="0"
            dy="-3"
            stdDeviation="5"
            floodColor="#000000"
            floodOpacity="0.8"
          />
        </filter>
      </defs>

      {/* Light mode path - Clipped to avoid shadow bleed at the base */}
      <g className="dark:hidden" filter={`url(#${lightShadowId})`} clipPath={`url(#${clipId})`}>
        <path
          d={d}
          fill={fill}
          stroke="none"
        />
      </g>

      {/* Dark mode path - Clipped and with stroke that stops at panel edge */}
      <g className="hidden dark:block" filter={`url(#${darkShadowId})`} clipPath={`url(#${clipId})`}>
        {/* Fill */}
        <path
          d={d}
          fill={fill}
          stroke="none"
        />
        {/* Stroke curved part: start/end exactly at visibleH to avoid border overlap */}
        <path
          d={`M 0 ${visibleH} C ${bulgeFactor} ${visibleH}, ${x1 - bulgeFactor} 0, ${x1} 0 L ${x2} 0 C ${x2 + bulgeFactor} 0, ${W - bulgeFactor} ${visibleH}, ${W} ${visibleH}`}
          fill="none"
          stroke="rgba(168, 85, 247, 0.3)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </g>
    </svg>
  );
}
