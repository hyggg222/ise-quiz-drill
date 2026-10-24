import React, { type ReactNode } from 'react';

export interface EmptyStateProps {
  icon: ReactNode;
  // Colours of the round icon
  iconClass?: string;
  title: string;
  text: string;
  children?: ReactNode;
}

// The dashed card a library shows when it has nothing to list
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  iconClass = 'bg-[#006fbf] text-white',
  title,
  text,
  children,
}) => (
  <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center space-y-4">
    <div
      className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${iconClass}`}
    >
      {icon}
    </div>
    <h2 className="text-xl font-bold text-gray-900">{title}</h2>
    <p className="text-sm text-gray-500 max-w-md mx-auto">{text}</p>
    {children}
  </div>
);
