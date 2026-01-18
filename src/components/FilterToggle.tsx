import React from 'react';

interface FilterToggleProps<T extends string> {
  options: { value: T; label: string }[];
  activeOption: T;
  onSelect: (option: T) => void;
}

const FilterToggle = <T extends string>({ options, activeOption, onSelect }: FilterToggleProps<T>) => {
  return (
    <div className="bg-sunset-cream/60 dark:bg-midnight-card/50 p-1 rounded-lg flex items-center w-full">
      {options.map(option => (
        <button
          key={option.value}
          onClick={() => onSelect(option.value)}
          className={`w-full py-1.5 px-2 text-sm font-semibold rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-electric-violet focus:ring-offset-2 focus:ring-offset-sunset-cream dark:focus:ring-offset-midnight
            ${activeOption === option.value ? 'midnight-card text-sunset-coral dark:text-electric-violet shadow' : 'bg-transparent text-slate-600 dark:text-slate-400 hover:bg-sunset-peach/40 dark:hover:bg-midnight-card'}
          `}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export default FilterToggle;