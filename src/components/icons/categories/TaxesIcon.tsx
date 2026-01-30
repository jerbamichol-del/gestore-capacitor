import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
    size?: number;
    color?: string;
}

export const TaxesIcon: React.FC<IconProps> = ({ size = 24, color = '#64748b', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <rect x="3" y="4" width="18" height="16" rx="2" stroke={color} strokeWidth="2" />
        <path d="M3 9H21" stroke={color} strokeWidth="2" />
        <path d="M7 14H11" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <path d="M7 17H9" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <path d="M14 14L17 17" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <path d="M17 14L14 17" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
);
