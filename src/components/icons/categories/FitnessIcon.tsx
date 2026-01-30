import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
    size?: number;
    color?: string;
}

export const FitnessIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path d="M6 12H18" stroke={color} strokeWidth="3" strokeLinecap="round" />
        <rect x="2" y="9" width="4" height="6" rx="1" stroke={color} strokeWidth="2" />
        <rect x="18" y="9" width="4" height="6" rx="1" stroke={color} strokeWidth="2" />
        <rect x="4" y="7" width="2" height="10" rx="1" fill={color} />
        <rect x="18" y="7" width="2" height="10" rx="1" fill={color} />
    </svg>
);
