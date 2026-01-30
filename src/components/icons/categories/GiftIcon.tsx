import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
    size?: number;
    color?: string;
}

export const GiftIcon: React.FC<IconProps> = ({ size = 24, color = '#64748b', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <rect x="3" y="8" width="18" height="13" rx="2" stroke={color} strokeWidth="2" />
        <path d="M12 8V21" stroke={color} strokeWidth="2" />
        <path d="M3 13H21" stroke={color} strokeWidth="2" />
        <path d="M12 8C12 8 12 5 9 5C6 5 6 8 12 8Z" stroke={color} strokeWidth="2" fill="none" />
        <path d="M12 8C12 8 12 5 15 5C18 5 18 8 12 8Z" stroke={color} strokeWidth="2" fill="none" />
    </svg>
);
