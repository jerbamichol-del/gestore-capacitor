import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
    size?: number;
    color?: string;
}

export const BabyIcon: React.FC<IconProps> = ({ size = 24, color = '#64748b', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle cx="12" cy="8" r="5" stroke={color} strokeWidth="2" />
        <path d="M8 7.5C8.5 7 9.5 7 10 7.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M14 7.5C14.5 7 15.5 7 16 7.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M10 10C10.5 10.5 13.5 10.5 14 10" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M6 13C6 13 6 21 12 21C18 21 18 13 18 13" stroke={color} strokeWidth="2" />
        <circle cx="4" cy="15" r="2" fill={color} />
        <circle cx="20" cy="15" r="2" fill={color} />
    </svg>
);
