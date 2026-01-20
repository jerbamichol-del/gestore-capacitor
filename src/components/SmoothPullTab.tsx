import React from "react";

type Props = {
  width?: string | number;
  height?: string | number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  className?: string;
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
}: Props) {
  const W = Number(width);
  const H = Number(height);
  const lightShadowId = "smooth-pull-tab-shadow-light";
  const darkShadowId = "smooth-pull-tab-shadow-dark";

  // The path calculation remains the same
  const topPlateauWidth = W * 0.35;
  const bulgeFactor = W * 0.25;
  const x1 = (W - topPlateauWidth) / 2;
  const x2 = x1 + topPlateauWidth;
  const d = [
    `M 0 ${H}`,
    `C ${bulgeFactor} ${H}, ${x1 - bulgeFactor} 0, ${x1} 0`,
    `L ${x2} 0`,
    `C ${x2 + bulgeFactor} 0, ${W - bulgeFactor} ${H}, ${W} ${H}`,
    "Z",
  ].join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Linguetta morbida con effetto rilievo"
      className={className}
      style={{ overflow: 'visible' }} // Allow shadow to render outside the viewbox
    >
      <defs>
        {/* Light mode shadow: slate with 0.6 opacity */}
        <filter id={lightShadowId} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow
            dx="0"
            dy="-3"
            stdDeviation="5"
            floodColor="#475569"
            floodOpacity="0.6"
          />
        </filter>
        {/* Dark mode shadow: black with 0.8 opacity */}
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

      {/* Light mode path */}
      <g className="dark:hidden" filter={`url(#${lightShadowId})`}>
        <path
          d={d}
          fill={fill}
          stroke="none"
          vectorEffect="non-scaling-stroke"
        />
      </g>

      {/* Dark mode path with purple border only on top and sides (not base) */}
      <g className="hidden dark:block" filter={`url(#${darkShadowId})`}>
        {/* Fill */}
        <path
          d={d}
          fill={fill}
          stroke="none"
          vectorEffect="non-scaling-stroke"
        />
        {/* Border only on curved parts, excluding the base */}
        <path
          d={`M 0 ${H} C ${bulgeFactor} ${H}, ${x1 - bulgeFactor} 0, ${x1} 0 L ${x2} 0 C ${x2 + bulgeFactor} 0, ${W - bulgeFactor} ${H}, ${W} ${H}`}
          fill="none"
          stroke="rgba(168, 85, 247, 0.3)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </g>
    </svg>
  );
}
