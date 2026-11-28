import { useEffect, useState } from 'react';
import { Loader2, MapPin, Navigation, Search, X } from 'lucide-react';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap.ts';
import { POPULAR_CITIES } from '../shared/aqi.ts';
import { LIMITS } from '../shared/constants.ts';
import type { CityLocation } from '../shared/types.ts';

interface LocationModalProps {
  open: boolean;
  currentCity: CityLocation;
  demoMode: boolean;
  onClose: () => void;
  onSelectCity: (city: CityLocation) => void;
  onToggleDemoMode: (enabled: boolean) => void;
}

export function LocationModal({
  open,
  currentCity,
  demoMode,
  onClose,
  onSelectCity,
  onToggleDemoMode,
}: LocationModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CityLocation[]>(POPULAR_CITIES);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [searchNotice, setSearchNotice] = useState<string | null>(null);

  const modalRef = useModalFocusTrap(open, onClose);

  useEffect(() => {
    if (!open) return;
    setGeoError(null);
    setSearchNotice(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(POPULAR_CITIES);
      setSearchNotice(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchNotice(null);
      try {
        const res = await fetch(
          `/api/cities/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        const data = (await res.json()) as {
          cities?: CityLocation[];
          notice?: string;
        };
        if (!controller.signal.aborted) {
          setResults(data.cities || []);
          if (data.notice) setSearchNotice(data.notice);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const lower = trimmed.toLowerCase();
        setResults(
          POPULAR_CITIES.filter(
            (c) =>
              c.name.toLowerCase().includes(lower) ||
              c.country.toLowerCase().includes(lower),
          ),
        );
        setSearchNotice('Unable to search online cities right now.');
      } finally {
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  if (!open) return null;

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Your browser does not support location access.');
      return;
    }
    setLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `/api/cities/reverse?lat=${latitude}&lon=${longitude}`,
          );
          const data = (await res.json()) as { city?: CityLocation };
          if (data.city) {
            onSelectCity(data.city);
            onClose();
          } else {
            onSelectCity({
              id: `geo-${latitude.toFixed(2)}-${longitude.toFixed(2)}`,
              name: 'Current Location',
              country: `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
              latitude,
              longitude,
            });
            onClose();
          }
        } catch {
          setGeoError('Detected coordinates, but could not load city details.');
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        const msgLower = (err.message || '').toLowerCase();
        if (msgLower.includes('permissions policy') || msgLower.includes('feature policy')) {
          setGeoError(
            'Location access is blocked by the preview frame. Open the app in a standalone tab or search and choose your city below.',
          );
        } else if (err.code === err.PERMISSION_DENIED) {
          setGeoError(
            'Location permission was denied in your browser or device settings. Allow location access for this site to auto-detect, or search and choose a city below.',
          );
        } else {
          setGeoError(
            'Could not determine your location right now. Please search or choose a city below.',
          );
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[2px] p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-modal-title"
        className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl border border-[#E5E7EB] shadow-lg overflow-hidden max-h-[88vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
          <div>
            <h2
              id="location-modal-title"
              className="text-lg font-semibold text-[#1F2937]"
            >
              Choose your location
            </h2>
            <p className="text-xs text-[#4B5563] mt-0.5">
              Select a city or use your current location
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close location dialog"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#4B5563] hover:text-[#1F2937] hover:bg-[#F8FAF9] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={locating}
            className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#EEF6F2] text-[#23634D] font-medium text-sm border border-[#CFE4DA] hover:bg-[#E2EFE8] transition-colors disabled:opacity-60"
          >
            {locating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Navigation className="w-4 h-4" />
            )}
            <span>
              {locating ? 'Finding your location…' : 'Use my current location'}
            </span>
          </button>

          {geoError && (
            <p
              role="alert"
              className="text-sm text-[#9A3412] bg-[#FFF3ED] border border-[#F7CDB9] rounded-xl px-3.5 py-2.5"
            >
              {geoError}
            </p>
          )}

          <div className="relative">
            <Search className="w-4 h-4 text-[#4B5563] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              maxLength={LIMITS.MAX_CITY_QUERY_CHARS}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search any city (e.g. Delhi, Mumbai, Kolkata, Noida)"
              aria-label="Search city"
              className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#F8FAF9] text-sm text-[#1F2937] placeholder:text-[#6B7280] focus:bg-white focus:border-[#2E7D62] focus:outline-none"
            />
          </div>

          {searchNotice && (
            <p role="status" className="text-xs text-[#4B5563]">
              {searchNotice}
            </p>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium text-[#4B5563] px-1">
              <span>{query.trim() ? 'Matching cities' : 'Popular cities'}</span>
              {searching && (
                <span className="inline-flex items-center gap-1" role="status">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Searching
                </span>
              )}
            </div>

            {results.length === 0 && !searching ? (
              <div className="py-6 text-center text-sm text-[#4B5563] border border-dashed border-[#E5E7EB] rounded-xl">
                No matching cities found. Try another spelling.
              </div>
            ) : (
              <div className="divide-y divide-[#E5E7EB] border border-[#E5E7EB] rounded-xl overflow-hidden bg-white">
                {results.map((city) => {
                  const isActive =
                    city.name === currentCity.name &&
                    Math.abs(city.latitude - currentCity.latitude) < 0.05;
                  return (
                    <button
                      key={city.id}
                      type="button"
                      onClick={() => {
                        onSelectCity(city);
                        onClose();
                      }}
                      className={`w-full min-h-[48px] px-4 py-2.5 flex items-center justify-between text-left transition-colors ${
                        isActive
                          ? 'bg-[#EEF6F2] text-[#1F2937]'
                          : 'hover:bg-[#F8FAF9] text-[#1F2937]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <MapPin
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-[#2E7D62]' : 'text-[#4B5563]'
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {city.name}
                            {city.isSample ? ' (Sample City)' : ''}
                          </div>
                          <div className="text-xs text-[#4B5563] truncate">
                            {[city.region, city.country]
                              .filter(Boolean)
                              .join(', ')}
                          </div>
                        </div>
                      </div>
                      {isActive && (
                        <span className="text-xs font-medium text-[#23634D] shrink-0 ml-2">
                          Selected
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-[#E5E7EB] flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-[#1F2937]">
                Demo Mode (Sample Data)
              </div>
              <div className="text-xs text-[#4B5563]">
                Preview the app with clearly labeled sample readings
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={demoMode}
              onClick={() => onToggleDemoMode(!demoMode)}
              className={`min-h-[44px] px-4 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                demoMode
                  ? 'bg-[#2E7D62] text-white border-[#2E7D62]'
                  : 'bg-[#F8FAF9] text-[#1F2937] border-[#E5E7EB] hover:bg-[#EEF6F2]'
              }`}
            >
              {demoMode ? 'Demo On' : 'Demo Off'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
