import React, { useState } from 'react';
import { useMindLocker } from '../context/MindLockerContext';

export const DurationSelector: React.FC = () => {
  const { duration, setDuration, isSessionActive, customDuration, setCustomDuration } = useMindLocker();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDuration(value as any);
  };

  const handleCustomDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*$/.test(value) && parseInt(value) <= 480) {
      setCustomDuration(value);
    }
  };

  const durations = [
    { value: '15', label: '15 Min' },
    { value: '30', label: '30 Min' },
    { value: '60', label: '1 Hour' },
    { value: '120', label: '2 Hours' },
    { value: 'custom', label: 'Custom' },
  ];

  return (
    <div>
      <h3 className="text-lg font-medium text-dark-purple mb-3">Duration:</h3>
      <div className="flex flex-wrap gap-4">
        {durations.map((option) => (
          <label 
            key={option.value}
            className={`
              relative flex items-center justify-center px-4 py-2 rounded-lg cursor-pointer
              transition-all duration-200 border-2
              ${duration === option.value
                ? 'border-primary-purple bg-primary-purple/10 text-primary-purple font-medium' 
                : 'border-gray-200 hover:border-primary-purple/50 text-gray-700'}
            `}
          >
            <input
              type="radio"
              className="sr-only"
              name="duration"
              value={option.value}
              checked={duration === option.value}
              onChange={handleChange}
              disabled={isSessionActive}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      
      {duration === 'custom' && (
        <div className="mt-4 flex items-center gap-2">
          <input
            type="number"
            value={customDuration}
            onChange={handleCustomDurationChange}
            min="1"
            max="480"
            className="w-24 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-primary-purple focus:outline-none"
            placeholder="Minutes"
            disabled={isSessionActive}
          />
          <span className="text-gray-600">minutes (max 480)</span>
        </div>
      )}
    </div>
  );
};