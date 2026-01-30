import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
    size?: number;
    color?: string;
}

export const TravelIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path d="M3 21L7 17L3 13V21Z" fill={color} fillOpacity="0.2" />
        <path d="M21 3L17 7L21 11V3Z" fill={color} fillOpacity="0.2" />
        <path d="M21 3L3 21" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <path d="M15 9L21 3" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <path d="M9 15L3 21" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <circle cx="6" cy="6" r="3" stroke={color} strokeWidth="2" />
        <circle cx="18" cy="18" r="3" stroke={color} strokeWidth="2" />
    </svg>
);
