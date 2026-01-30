import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
    size?: number;
    color?: string;
}

export const BeautyIcon: React.FC<IconProps> = ({ size = 24, color = '#64748b', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path d="M12 3C12 3 8 7 8 12C8 17 12 21 12 21C12 21 16 17 16 12C16 7 12 3 12 3Z" stroke={color} strokeWidth="2" fill={color} fillOpacity="0.2" />
        <path d="M12 3V8" stroke={color} strokeWidth="2" />
        <circle cx="12" cy="12" r="2" fill={color} />
    </svg>
);
