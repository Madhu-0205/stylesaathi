import React, { useState } from 'react';
import { MapPin, Navigation, X, Check, Loader2 } from 'lucide-react';
import { INDIAN_CITIES, IndianCityProfile } from '../../services/weather/indianCities';
import { WeatherLocation } from '../../types';
import { Button } from '@/components/ui/button';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLocation: WeatherLocation;
  onSelectLocation: (loc: WeatherLocation) => Promise<void>;
  onRequestDeviceLocation: () => Promise<boolean>;
}

export const LocationModal: React.FC<LocationModalProps> = ({
  isOpen,
  onClose,
  currentLocation,
  onSelectLocation,
  onRequestDeviceLocation,
}) => {
  const [isLocating, setIsLocating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDeviceLocation = async () => {
    setIsLocating(true);
    setFeedback(null);
    try {
      const success = await onRequestDeviceLocation();
      if (success) {
        onClose();
      } else {
        setFeedback('Could not determine nearest city. Please choose from the list below.');
      }
    } catch {
      setFeedback('Location access was not available.');
    } finally {
      setIsLocating(false);
    }
  };

  const handleSelectCity = async (city: IndianCityProfile) => {
    await onSelectLocation(city);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-modal-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3.5 mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--burnished-gold)/10 text-(--burnished-gold)">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <h2 id="location-modal-title" className="font-serif text-lg font-medium text-(--ink)">
                Your Wardrobe Location
              </h2>
              <p className="text-[11px] text-muted">
                Indian climate context guides fabric and outfit comfort
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-(--ivory) hover:text-(--ink) transition-colors"
            aria-label="Close location selector"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Device GPS Action */}
        <div className="mb-4">
          <Button
            variant="outline"
            onClick={handleDeviceLocation}
            disabled={isLocating}
            className="w-full min-h-11 justify-center gap-2 rounded-xl border-(--burnished-gold)/40 bg-(--ivory) text-xs font-semibold text-(--ink) hover:border-(--burnished-gold) hover:bg-(--paper) shadow-2xs"
          >
            {isLocating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-(--burnished-gold)" />
                <span>Locating nearest Indian city…</span>
              </>
            ) : (
              <>
                <Navigation className="h-4 w-4 text-(--burnished-gold)" />
                <span>Use My Current Location</span>
              </>
            )}
          </Button>
          <p className="mt-1.5 text-center text-[10px] text-muted italic">
            Privacy-first: Snaps to nearest major city. We never store precise household coordinates.
          </p>
          {feedback && (
            <p className="mt-1 text-center text-[11px] text-(--kumkum) font-medium">
              {feedback}
            </p>
          )}
        </div>

        {/* City List */}
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-1.5 pr-0.5">
          <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted block mb-1">
            Major Indian Cities & Climate Zones
          </span>
          {INDIAN_CITIES.map((city) => {
            const isSelected = currentLocation.city.toLowerCase() === city.city.toLowerCase();
            return (
              <button
                key={city.city}
                type="button"
                onClick={() => handleSelectCity(city)}
                className={`w-full min-h-11 flex items-center justify-between rounded-xl px-3.5 py-2 text-left transition-all border ${
                  isSelected
                    ? 'border-(--ink) bg-(--ink) text-(--paper) shadow-2xs'
                    : 'border-border bg-card hover:border-(--burnished-gold)/60 hover:bg-(--ivory) text-(--ink)'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold">{city.city}</span>
                    <span className={`text-[10px] ${isSelected ? 'text-(--paper)/70' : 'text-muted'}`}>
                      · {city.region}
                    </span>
                  </div>
                  <p className={`text-[10px] line-clamp-1 ${isSelected ? 'text-(--paper)/80' : 'text-muted'}`}>
                    {city.description}
                  </p>
                </div>
                {isSelected && <Check className="h-4 w-4 stroke-2 text-(--paper) shrink-0 ml-2" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
