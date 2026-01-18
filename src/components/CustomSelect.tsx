
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon } from './icons/ChevronDownIcon';

interface Option {
  value: string;
  label: string;
  Icon?: React.FC<React.SVGProps<SVGSVGElement>>;
  color?: string;
  bgColor?: string;
}

interface CustomSelectProps {
  options: Option[];
  selectedValue: string;
  onSelect: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ options, selectedValue, onSelect, placeholder, disabled = false, icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (value: string) => {
    onSelect(value);
    setIsOpen(false);
  };

  const selectedOption = options.find(opt => opt.value === selectedValue);

  return (
    <div className="relative" ref={selectRef}>
      <div className="relative">
        {icon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            {icon}
          </div>
        )}
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between pl-10 pr-4 py-2 text-sm text-left rounded-lg border border-slate-300 dark:border-electric-violet/30 bg-sunset-cream/60 dark:bg-midnight-card/50 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-electric-violet
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-sunset-peach/30 dark:hover:bg-midnight-card'}`}
          aria-haspopup="true"
          aria-expanded={isOpen}
          disabled={disabled}
        >
          {selectedOption ? (
            <span className="flex items-center gap-3">
              {selectedOption.Icon && (
                <selectedOption.Icon className="w-6 h-6 flex-shrink-0" />
              )}
              <span className="text-slate-900">{selectedOption.label}</span>
            </span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
          <ChevronDownIcon className={`w-5 h-5 text-slate-500 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-10 mt-1 w-full midnight-card rounded-md shadow-lg border border-sunset-coral/20 dark:border-electric-violet/20 max-h-60 overflow-y-auto">
          <ul className="py-1">
            {options.map((option) => {
              const isSelected = selectedValue === option.value;
              return (
                <li key={option.value}>
                  <button
                    onClick={() => handleSelect(option.value)}
                    className={`w-full text-left px-4 py-2 text-sm flex items-center gap-3 transition-colors ${isSelected ? 'bg-sunset-coral dark:bg-electric-violet text-white' : 'text-slate-700 dark:text-slate-200 hover:bg-sunset-peach/30 dark:hover:bg-midnight-card'
                      }`}
                  >
                    {option.Icon && (
                      <option.Icon className="w-6 h-6 flex-shrink-0" />
                    )}
                    {option.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
