import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
    size?: number;
    color?: string;
}

export const MusicIcon: React.FC<IconProps> = ({ size = 24, color = '#64748b', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle cx="6" cy="18" r="3" stroke={color} strokeWidth="2" />
        <circle cx="18" cy="15" r="3" stroke={color} strokeWidth="2" />
        <path d="M9 18V5L21 3V15" stroke={color} strokeWidth="2" />
        <path d="M9 10L21 8" stroke={color} strokeWidth="2" />
    </svg>
);
