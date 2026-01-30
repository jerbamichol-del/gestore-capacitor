import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
    size?: number;
    color?: string;
}

export const InvestmentIcon: React.FC<IconProps> = ({ size = 24, color = '#64748b', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path d="M3 21L3 16" stroke={color} strokeWidth="3" strokeLinecap="round" />
        <path d="M9 21L9 12" stroke={color} strokeWidth="3" strokeLinecap="round" />
        <path d="M15 21L15 8" stroke={color} strokeWidth="3" strokeLinecap="round" />
        <path d="M21 21L21 3" stroke={color} strokeWidth="3" strokeLinecap="round" />
        <path d="M3 14L9 10L15 6L21 3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="21" cy="3" r="2" fill={color} />
    </svg>
);
