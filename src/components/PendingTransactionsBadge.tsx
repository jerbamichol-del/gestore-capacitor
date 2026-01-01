// components/PendingTransactionsBadge.tsx

import React from 'react';

interface Props {
  count: number;
  onClick: () => void;
}

const PendingTransactionsBadge: React.FC<Props> = ({ count, onClick }) => {
  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      className="relative inline-flex items-center justify-center p-2 rounded-full hover:bg-slate-100 transition-colors"
      aria-label={`${count} transazioni in attesa`}
    >
      {/* Bell Icon */}
      <svg 
        className="w-6 h-6 text-slate-700" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" 
        />
      </svg>
      
      {/* Badge */}
      <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-600 rounded-full animate-pulse">
        {count > 9 ? '9+' : count}
      </span>
    </button>
  );
};

export default PendingTransactionsBadge;
