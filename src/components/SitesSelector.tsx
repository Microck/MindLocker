import React from 'react';
import { useMindLocker } from '../context/MindLockerContext';

export const SitesSelector: React.FC = () => {
  const { siteCategories, toggleSite } = useMindLocker();

  return (
    <div>
      <h3 className="text-lg font-medium text-dark-purple mb-3">Sites to Block:</h3>
      <div className="max-h-60 overflow-y-auto pr-2 custom-scrollbar">
        {siteCategories.map((category) => (
          <div key={category.id} className="mb-4">
            <h4 className="text-md font-medium text-primary-purple mb-2">{category.name}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {category.sites.map((site) => (
                <div key={site.id} className="flex items-center">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={site.checked}
                      onChange={() => toggleSite(category.id, site.id)}
                      className="w-4 h-4 rounded text-primary-purple focus:ring-primary-purple focus:ring-offset-0"
                    />
                    <span className="ml-2 text-gray-700">{site.name}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};