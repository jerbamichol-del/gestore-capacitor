import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
    size?: number;
    color?: string;
}

export const GardenIcon: React.FC<IconProps> = ({ size = 24, color = '#64748b', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path d="M12 22V12" stroke={color} strokeWidth="2" />
        <path d="M12 12C12 12 6 12 6 7C6 2 12 2 12 7" stroke={color} strokeWidth="2" fill={color} fillOpacity="0.2" />
        <path d="M12 12C12 12 18 12 18 7C18 2 12 2 12 7" stroke={color} strokeWidth="2" fill={color} fillOpacity="0.2" />
        <path d="M8 22H16" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
);
