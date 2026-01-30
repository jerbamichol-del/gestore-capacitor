import React from 'react';
import { AllIcon } from '../components/icons/categories/AllIcon';
import { FoodIcon } from '../components/icons/categories/FoodIcon';
import { TransportIcon } from '../components/icons/categories/TransportIcon';
import { HomeIcon } from '../components/icons/categories/HomeIcon';
import { ShoppingIcon } from '../components/icons/categories/ShoppingIcon';
import { LeisureIcon } from '../components/icons/categories/LeisureIcon';
import { HealthIcon } from '../components/icons/categories/HealthIcon';
import { EducationIcon } from '../components/icons/categories/EducationIcon';
import { WorkIcon } from '../components/icons/categories/WorkIcon';
import { CharityIcon } from '../components/icons/categories/CharityIcon';
import { OtherIcon } from '../components/icons/categories/OtherIcon';
import { CategoryService } from '../services/category-service';

// Import unique icons for custom categories
import { GiftIcon } from '../components/icons/categories/GiftIcon';
import { TravelIcon } from '../components/icons/categories/TravelIcon';
import { EntertainmentIcon } from '../components/icons/categories/EntertainmentIcon';
import { PetsIcon } from '../components/icons/categories/PetsIcon';
import { BeautyIcon } from '../components/icons/categories/BeautyIcon';
import { FitnessIcon } from '../components/icons/categories/FitnessIcon';
import { TechIcon } from '../components/icons/categories/TechIcon';
import { MusicIcon } from '../components/icons/categories/MusicIcon';
import { ArtIcon } from '../components/icons/categories/ArtIcon';
import { GardenIcon } from '../components/icons/categories/GardenIcon';
import { BabyIcon } from '../components/icons/categories/BabyIcon';
import { InsuranceIcon } from '../components/icons/categories/InsuranceIcon';
import { TaxesIcon } from '../components/icons/categories/TaxesIcon';
import { InvestmentIcon } from '../components/icons/categories/InvestmentIcon';
import { SolidCircleIcon } from '../components/icons/categories/SolidCircleIcon';

interface CategoryStyle {
    label: string;
    Icon: React.FC<React.SVGProps<SVGSVGElement>>;
    color: string;
    bgColor: string;
}

// Mappa icone disponibili per selezione
export const ICON_MAP: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
    'food': FoodIcon,
    'transport': TransportIcon,
    'home': HomeIcon,
    'shopping': ShoppingIcon,
    'leisure': LeisureIcon,
    'health': HealthIcon,
    'education': EducationIcon,
    'work': WorkIcon,
    'charity': CharityIcon,
    'other': OtherIcon,
    'solid': SolidCircleIcon,
    'gift': GiftIcon,
    'travel': TravelIcon,
    'entertainment': EntertainmentIcon,
    'pets': PetsIcon,
    'beauty': BeautyIcon,
    'fitness': FitnessIcon,
    'tech': TechIcon,
    'music': MusicIcon,
    'art': ArtIcon,
    'garden': GardenIcon,
    'baby': BabyIcon,
    'insurance': InsuranceIcon,
    'taxes': TaxesIcon,
    'investment': InvestmentIcon,
    'all': AllIcon
};

// Legacy styles map (keep for backward compatibility if needed)
export const categoryStyles: Record<string, CategoryStyle> = {
    'all': { label: 'Tutte', Icon: AllIcon, color: 'text-slate-600', bgColor: 'bg-slate-200' },
    'Alimentari': { label: 'Alimentari', Icon: FoodIcon, color: 'text-lime-600', bgColor: 'bg-lime-100' },
    'Trasporti': { label: 'Trasporti', Icon: TransportIcon, color: 'text-slate-600', bgColor: 'bg-slate-100' },
    'Casa': { label: 'Casa', Icon: HomeIcon, color: 'text-blue-900', bgColor: 'bg-blue-100' },
    'Shopping': { label: 'Shopping', Icon: ShoppingIcon, color: 'text-purple-600', bgColor: 'bg-purple-100' },
    'Tempo Libero': { label: 'Tempo Libero', Icon: LeisureIcon, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
    'Salute': { label: 'Salute', Icon: HealthIcon, color: 'text-cyan-600', bgColor: 'bg-cyan-100' },
    'Istruzione': { label: 'Istruzione', Icon: EducationIcon, color: 'text-green-600', bgColor: 'bg-green-100' },
    'Lavoro': { label: 'Lavoro', Icon: WorkIcon, color: 'text-blue-600', bgColor: 'bg-blue-100' },
    'Beneficienza': { label: 'Beneficienza', Icon: CharityIcon, color: 'text-red-600', bgColor: 'bg-red-100' },
    'Altro': { label: 'Altro', Icon: OtherIcon, color: 'text-amber-900', bgColor: 'bg-amber-100' },
};

/**
 * Get category icon compatible with both legacy and custom categories
 */
export const getCategoryIcon = (categoryNameOrIconId: string): React.FC<any> => {
    // 1. First try to find custom category by name (MOST IMPORTANT for custom categories)
    const customCat = CategoryService.getCategoryByName(categoryNameOrIconId);
    if (customCat && customCat.icon && ICON_MAP[customCat.icon]) {
        return ICON_MAP[customCat.icon];
    }

    // 2. Try if it's a direct icon ID (e.g., 'food', 'transport')
    if (ICON_MAP[categoryNameOrIconId]) {
        return ICON_MAP[categoryNameOrIconId];
    }

    // 3. Fallback to legacy map using name
    if (categoryStyles[categoryNameOrIconId]) {
        return categoryStyles[categoryNameOrIconId].Icon;
    }

    // 4. Default
    return OtherIcon;
};

/**
 * Get category color (hex) compatible with both legacy and custom categories
 */
export const getCategoryColor = (categoryName: string): string => {
    // 1. Try to find category in service
    const customCat = CategoryService.getCategoryByName(categoryName);
    if (customCat && customCat.color) {
        return customCat.color;
    }

    // 2. Fallback to legacy map (convert tailwind class to approximation or return default)
    // This is a simplification; ideally legacy styles would store hex too
    const legacy = categoryStyles[categoryName];
    if (legacy) {
        // Map legacy tailwind classes to approximate hex for consistency
        if (legacy.color.includes('lime')) return '#84CC16';
        if (legacy.color.includes('slate')) return '#64748B';
        if (legacy.color.includes('blue-900')) return '#1E3A8A';
        if (legacy.color.includes('purple')) return '#9333EA';
        if (legacy.color.includes('yellow')) return '#CA8A04';
        if (legacy.color.includes('cyan')) return '#0891B2';
        if (legacy.color.includes('green')) return '#16A34A';
        if (legacy.color.includes('blue')) return '#2563EB';
        if (legacy.color.includes('red')) return '#DC2626';
        if (legacy.color.includes('amber')) return '#78350F';
    }

    return '#94A3B8'; // Default Gray
};

export const getCategoryStyle = (category: string | 'all'): CategoryStyle => {
    return categoryStyles[category] || categoryStyles['Altro'];
};
