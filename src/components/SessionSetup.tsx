import React from 'react';
import { DurationSelector } from './DurationSelector';
import { SitesSelector } from './SitesSelector';
import { useMindLocker } from '../context/MindLockerContext';

export const SessionSetup: React.FC = () => {
  const { isSessionActive } = useMindLocker();
  
  return (
    <div className={`mb-6 transition-opacity duration-300 ${isSessionActive ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
      <div className="bg-light-purple p-6 rounded-lg shadow-sm mb-6">
        <h2 className="text-xl font-semibold text-dark-purple mb-4">Session Setup</h2>
        <DurationSelector />
      </div>
      
      <div className="bg-light-purple p-6 rounded-lg shadow-sm">
        <SitesSelector />
      </div>
    </div>
  );
};