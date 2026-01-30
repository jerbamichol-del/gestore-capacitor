import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
    size?: number;
    color?: string;
}

export const PetsIcon: React.FC<IconProps> = ({ size = 24, color = 'currentColor', ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <ellipse cx="12" cy="17" rx="5" ry="4" stroke={color} strokeWidth="2" />
        <ellipse cx="6" cy="9" rx="2" ry="3" fill={color} />
        <ellipse cx="18" cy="9" rx="2" ry="3" fill={color} />
        <ellipse cx="9.5" cy="6" rx="1.5" ry="2" fill={color} />
        <ellipse cx="14.5" cy="6" rx="1.5" ry="2" fill={color} />
    </svg>
);
