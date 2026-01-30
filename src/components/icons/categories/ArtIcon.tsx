import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
    size?: number;
    color?: string;
}

export const ArtIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle cx="7" cy="8" r="2" fill={color} />
        <circle cx="17" cy="8" r="2" fill={color} />
        <circle cx="7" cy="16" r="2" fill={color} />
        <circle cx="17" cy="16" r="2" fill={color} />
        <path d="M19 3L21 5L5 21L3 19L19 3Z" stroke={color} strokeWidth="2" />
        <path d="M17 7L19 9" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
);
