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

// Import Finanza icons
import { Finanza1Icon } from '../components/icons/categories/finanza/Finanza1Icon';
import { Finanza2Icon } from '../components/icons/categories/finanza/Finanza2Icon';
import { Finanza3Icon } from '../components/icons/categories/finanza/Finanza3Icon';
import { Finanza4Icon } from '../components/icons/categories/finanza/Finanza4Icon';
import { Finanza5Icon } from '../components/icons/categories/finanza/Finanza5Icon';
import { Finanza6Icon } from '../components/icons/categories/finanza/Finanza6Icon';
import { Finanza7Icon } from '../components/icons/categories/finanza/Finanza7Icon';
import { Finanza8Icon } from '../components/icons/categories/finanza/Finanza8Icon';
import { Finanza9Icon } from '../components/icons/categories/finanza/Finanza9Icon';
import { Finanza10Icon } from '../components/icons/categories/finanza/Finanza10Icon';
import { Finanza11Icon } from '../components/icons/categories/finanza/Finanza11Icon';
import { Finanza12Icon } from '../components/icons/categories/finanza/Finanza12Icon';
import { Finanza13Icon } from '../components/icons/categories/finanza/Finanza13Icon';
import { Finanza14Icon } from '../components/icons/categories/finanza/Finanza14Icon';
import { Finanza15Icon } from '../components/icons/categories/finanza/Finanza15Icon';
import { Finanza16Icon } from '../components/icons/categories/finanza/Finanza16Icon';
import { Svago1Icon } from '../components/icons/categories/svago/Svago1Icon';
import { Svago2Icon } from '../components/icons/categories/svago/Svago2Icon';
import { Svago3Icon } from '../components/icons/categories/svago/Svago3Icon';
import { Svago4Icon } from '../components/icons/categories/svago/Svago4Icon';
import { Svago5Icon } from '../components/icons/categories/svago/Svago5Icon';
import { Svago6Icon } from '../components/icons/categories/svago/Svago6Icon';
import { Svago7Icon } from '../components/icons/categories/svago/Svago7Icon';
import { Svago8Icon } from '../components/icons/categories/svago/Svago8Icon';
import { Svago9Icon } from '../components/icons/categories/svago/Svago9Icon';
import { Svago10Icon } from '../components/icons/categories/svago/Svago10Icon';
import { Svago11Icon } from '../components/icons/categories/svago/Svago11Icon';
import { Svago12Icon } from '../components/icons/categories/svago/Svago12Icon';
import { Svago13Icon } from '../components/icons/categories/svago/Svago13Icon';
import { Svago14Icon } from '../components/icons/categories/svago/Svago14Icon';
import { Svago15Icon } from '../components/icons/categories/svago/Svago15Icon';
import { Svago16Icon } from '../components/icons/categories/svago/Svago16Icon';
import { Svago17Icon } from '../components/icons/categories/svago/Svago17Icon';
import { Svago18Icon } from '../components/icons/categories/svago/Svago18Icon';
import { Svago19Icon } from '../components/icons/categories/svago/Svago19Icon';
import { Svago20Icon } from '../components/icons/categories/svago/Svago20Icon';
import { Svago21Icon } from '../components/icons/categories/svago/Svago21Icon';
import { Svago22Icon } from '../components/icons/categories/svago/Svago22Icon';
import { Svago23Icon } from '../components/icons/categories/svago/Svago23Icon';
import { Svago24Icon } from '../components/icons/categories/svago/Svago24Icon';
import { Svago25Icon } from '../components/icons/categories/svago/Svago25Icon';
import { Svago26Icon } from '../components/icons/categories/svago/Svago26Icon';
import { Shopping1Icon } from '../components/icons/categories/shopping/Shopping1Icon';
import { Shopping2Icon } from '../components/icons/categories/shopping/Shopping2Icon';
import { Shopping3Icon } from '../components/icons/categories/shopping/Shopping3Icon';
import { Shopping4Icon } from '../components/icons/categories/shopping/Shopping4Icon';
import { Shopping5Icon } from '../components/icons/categories/shopping/Shopping5Icon';
import { Shopping6Icon } from '../components/icons/categories/shopping/Shopping6Icon';
import { Shopping7Icon } from '../components/icons/categories/shopping/Shopping7Icon';
import { Shopping8Icon } from '../components/icons/categories/shopping/Shopping8Icon';
import { Shopping9Icon } from '../components/icons/categories/shopping/Shopping9Icon';
import { Shopping10Icon } from '../components/icons/categories/shopping/Shopping10Icon';
import { Shopping11Icon } from '../components/icons/categories/shopping/Shopping11Icon';
import { Shopping12Icon } from '../components/icons/categories/shopping/Shopping12Icon';
import { Shopping13Icon } from '../components/icons/categories/shopping/Shopping13Icon';
import { Shopping14Icon } from '../components/icons/categories/shopping/Shopping14Icon';
import { Shopping15Icon } from '../components/icons/categories/shopping/Shopping15Icon';
import { Shopping16Icon } from '../components/icons/categories/shopping/Shopping16Icon';
import { Shopping17Icon } from '../components/icons/categories/shopping/Shopping17Icon';
import { Shopping18Icon } from '../components/icons/categories/shopping/Shopping18Icon';
import { Shopping19Icon } from '../components/icons/categories/shopping/Shopping19Icon';
import { Shopping20Icon } from '../components/icons/categories/shopping/Shopping20Icon';

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
    'all': AllIcon,
    'finanza1': Finanza1Icon,
    'finanza2': Finanza2Icon,
    'finanza3': Finanza3Icon,
    'finanza4': Finanza4Icon,
    'finanza5': Finanza5Icon,
    'finanza6': Finanza6Icon,
    'finanza7': Finanza7Icon,
    'finanza8': Finanza8Icon,
    'finanza9': Finanza9Icon,
    'finanza10': Finanza10Icon,
    'finanza11': Finanza11Icon,
    'finanza12': Finanza12Icon,
    'finanza13': Finanza13Icon,
    'finanza14': Finanza14Icon,
    'finanza15': Finanza15Icon,
    'finanza16': Finanza16Icon,
    'svago1': Svago1Icon,
    'svago2': Svago2Icon,
    'svago3': Svago3Icon,
    'svago4': Svago4Icon,
    'svago5': Svago5Icon,
    'svago6': Svago6Icon,
    'svago7': Svago7Icon,
    'svago8': Svago8Icon,
    'svago9': Svago9Icon,
    'svago10': Svago10Icon,
    'svago11': Svago11Icon,
    'svago12': Svago12Icon,
    'svago13': Svago13Icon,
    'svago14': Svago14Icon,
    'svago15': Svago15Icon,
    'svago16': Svago16Icon,
    'svago17': Svago17Icon,
    'svago18': Svago18Icon,
    'svago19': Svago19Icon,
    'svago20': Svago20Icon,
    'svago21': Svago21Icon,
    'svago22': Svago22Icon,
    'svago23': Svago23Icon,
    'svago24': Svago24Icon,
    'svago25': Svago25Icon,
    'svago26': Svago26Icon,
    'shopping1': Shopping1Icon,
    'shopping2': Shopping2Icon,
    'shopping3': Shopping3Icon,
    'shopping4': Shopping4Icon,
    'shopping5': Shopping5Icon,
    'shopping6': Shopping6Icon,
    'shopping7': Shopping7Icon,
    'shopping8': Shopping8Icon,
    'shopping9': Shopping9Icon,
    'shopping10': Shopping10Icon,
    'shopping11': Shopping11Icon,
    'shopping12': Shopping12Icon,
    'shopping13': Shopping13Icon,
    'shopping14': Shopping14Icon,
    'shopping15': Shopping15Icon,
    'shopping16': Shopping16Icon,
    'shopping17': Shopping17Icon,
    'shopping18': Shopping18Icon,
    'shopping19': Shopping19Icon,
    'shopping20': Shopping20Icon
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
    // 1. Check legacy styles first for built-in categories
    if (categoryStyles[category]) {
        return categoryStyles[category];
    }

    // 2. Check for custom category
    const customCat = CategoryService.getCategoryByName(category);
    if (customCat) {
        const icon = customCat.icon && ICON_MAP[customCat.icon]
            ? ICON_MAP[customCat.icon]
            : OtherIcon;
        const color = customCat.color || '#94A3B8';

        return {
            label: customCat.name,
            Icon: icon,
            color: color,
            bgColor: `${color}20`  // translucent background
        };
    }

    // 3. Fallback to 'Altro'
    return categoryStyles['Altro'];
};
