import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
    size?: number;
    color?: string;
}

export const TechIcon: React.FC<IconProps> = ({ size = 24, color = '#64748b', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <rect x="2" y="3" width="20" height="14" rx="2" stroke={color} strokeWidth="2" />
        <path d="M8 21H16" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <path d="M12 17V21" stroke={color} strokeWidth="2" />
        <circle cx="12" cy="10" r="2" fill={color} />
    </svg>
);
