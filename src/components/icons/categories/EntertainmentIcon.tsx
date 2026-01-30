import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
    size?: number;
    color?: string;
}

export const EntertainmentIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <rect x="2" y="4" width="20" height="16" rx="2" stroke={color} strokeWidth="2" />
        <path d="M10 9L16 12L10 15V9Z" fill={color} />
        <path d="M2 8H22" stroke={color} strokeWidth="2" />
    </svg>
);
