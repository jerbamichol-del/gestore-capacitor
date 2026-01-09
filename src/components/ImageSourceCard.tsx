import React from 'react';

interface ImageSourceCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    onClick: () => void;
}

const ImageSourceCard: React.FC<ImageSourceCardProps> = ({ icon, title, description, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="bg-white dark:bg-slate-900 p-6 rounded-lg shadow-md hover:shadow-lg hover:ring-2 hover:ring-indigo-500 transition-all duration-200 text-left w-full flex flex-col items-center text-center group"
        >
            <div className="text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 p-4 rounded-full mb-4 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/50 transition-colors">
                {icon}
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 transition-colors">{title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 transition-colors">{description}</p>
        </button>
    )
}

export default ImageSourceCard;
