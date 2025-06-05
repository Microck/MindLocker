import React from 'react';
import { Lock } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <div className="bg-gradient-to-r from-dark-purple to-primary-purple py-6 px-8 flex items-center">
      <Lock size={32} className="text-white mr-3" />
      <h1 className="text-3xl font-bold text-white">MindLocker</h1>
    </div>
  );
};