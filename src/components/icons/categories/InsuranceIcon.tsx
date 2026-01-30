import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
    size?: number;
    color?: string;
}

export const InsuranceIcon: React.FC<IconProps> = ({ size = 24, color = '#64748b', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <path d="M12 2L4 5V11C4 16.5 7.5 20.7 12 22C16.5 20.7 20 16.5 20 11V5L12 2Z" stroke={color} strokeWidth="2" fill={color} fillOpacity="0.1" />
        <path d="M9 12L11 14L15 10" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
