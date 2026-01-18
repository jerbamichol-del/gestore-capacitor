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
            className="bg-white dark:midnight-card p-6 rounded-lg shadow-md hover:shadow-lg hover:ring-2 hover:ring-indigo-500 dark:hover:ring-electric-violet transition-all duration-200 text-left w-full flex flex-col items-center text-center border border-transparent dark:border-electric-violet/20"
        >
            <div className="text-indigo-600 dark:text-electric-violet bg-indigo-100 dark:bg-electric-violet/20 p-4 rounded-full mb-4">
                {icon}
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">{title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>
        </button>
    )
}

export default ImageSourceCard;
