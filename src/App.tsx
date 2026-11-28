import { useCallback, useEffect, useRef, useState } from 'react';
import { AssistantPage } from './components/AssistantPage.tsx';
import { DailyTipsPage } from './components/DailyTipsPage.tsx';
import { HomePage } from './components/HomePage.tsx';
import { ImpactPage } from './components/ImpactPage.tsx';
import { LocationModal } from './components/LocationModal.tsx';
import { Navbar, type NavTab } from './components/Navbar.tsx';
import { PreferencesModal } from './components/PreferencesModal.tsx';
import { buildBaselineAdvice } from './shared/aqi.ts';
import type {
  AdviceRecommendations,
  AirQualityData,
  AqiScale,
  ChatMessage,
  CityLocation,
  EmissionFactors,
  ImpactAction,
  UserPreferences,
} from './shared/types.ts';
import {
  getLocalDateKey,
  loadChatHistory,
  loadDailyHabitIds,
  loadDemoMode,
  loadEmissionFactors,
  loadImpactActions,
  loadPreferences,
  saveChatHistory,
  saveDailyHabitIds,
  saveDemoMode,
  saveEmissionFactors,
  saveImpactActions,
  savePreferences,
} from './utils/storage.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [preferences, setPreferences] = useState<UserPreferences>(() =>
    loadPreferences(),
  );
  const [demoMode, setDemoMode] = useState<boolean>(() => loadDemoMode());
  const [aqiData, setAqiData] = useState<AirQualityData | null>(null);
  const [aqiLoading, setAqiLoading] = useState<boolean>(true);
  const [aqiError, setAqiError] = useState<string | null>(null);

  const [advice, setAdvice] = useState<AdviceRecommendations | null>(null);
  const [adviceLoading, setAdviceLoading] = useState<boolean>(false);

  const [completedHabitIds, setCompletedHabitIds] = useState<string[]>(() =>
    loadDailyHabitIds(),
  );
  const [activeDateKey, setActiveDateKey] = useState<string>(() =>
    getLocalDateKey(),
  );
  const [impactActions, setImpactActions] = useState<ImpactAction[]>(() =>
    loadImpactActions(),
  );
  const [emissionFactors, setEmissionFactors] = useState<EmissionFactors>(() =>
    loadEmissionFactors(),
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() =>
    loadChatHistory(),
  );

  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [preferencesModalOpen, setPreferencesModalOpen] = useState(false);

  const aqiAbortRef = useRef<AbortController | null>(null);

  // Fetch AQI whenever city, scale, or demoMode changes, aborting stale requests
  const fetchAqi = useCallback(
    async (city: CityLocation, scale: AqiScale, isDemo: boolean) => {
      aqiAbortRef.current?.abort();
      const controller = new AbortController();
      aqiAbortRef.current = controller;

      setAqiLoading(true);
      setAqiError(null);
      try {
        const params = new URLSearchParams({
          id: city.id,
          city: city.name,
          country: city.country,
          lat: String(city.latitude),
          lon: String(city.longitude),
          scale,
          demo: isDemo ? 'true' : 'false',
        });
        if (city.region) params.set('region', city.region);
        if (city.isSample) params.set('sample', 'true');

        const res = await fetch(`/api/aqi?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as AirQualityData & {
          error?: string;
        };

        if (!res.ok) {
          throw new Error(
            data.error || 'Could not retrieve air quality data right now.',
          );
        }

        if (!controller.signal.aborted) {
          setAqiData(data);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setAqiError(
          err instanceof Error
            ? err.message
            : 'Unable to load air quality data.',
        );
        setAqiData(null);
      } finally {
        if (!controller.signal.aborted) {
          setAqiLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    fetchAqi(preferences.city, preferences.preferredScale, demoMode);
    return () => {
      aqiAbortRef.current?.abort();
    };
  }, [preferences.city, preferences.preferredScale, demoMode, fetchAqi]);

  // Fetch personalized advice whenever verified AQI data or household profile changes (debounced to protect AI rate limits)
  const { planningFor, commuteMethod } = preferences;
  useEffect(() => {
    if (!aqiData) {
      setAdvice(null);
      return;
    }

    const controller = new AbortController();
    const profileSnapshot: UserPreferences = {
      city: aqiData.city,
      planningFor,
      commuteMethod,
      preferredScale: aqiData.scale,
      onboardingCompleted: true,
    };
    const baseline = buildBaselineAdvice(aqiData, profileSnapshot);
    setAdvice({ ...baseline, source: 'deterministic' });
    setAdviceLoading(true);

    const debounceTimer = setTimeout(() => {
      fetch('/api/advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aqiData, preferences: profileSnapshot }),
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error('Advice request failed');
          return res.json() as Promise<AdviceRecommendations>;
        })
        .then((data) => {
          if (
            !controller.signal.aborted &&
            data &&
            data.outdoor &&
            data.indoor &&
            data.travel
          ) {
            setAdvice(data);
          }
        })
        .catch(() => {
          // Keep verified deterministic baseline on network/rate-limit error
        })
        .finally(() => {
          if (!controller.signal.aborted) setAdviceLoading(false);
        });
    }, 600);

    return () => {
      clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [aqiData, planningFor, commuteMethod]);

  // Check if local calendar day changed while app was open
  useEffect(() => {
    const checkDateRollover = () => {
      const current = getLocalDateKey();
      if (current !== activeDateKey) {
        setActiveDateKey(current);
        setCompletedHabitIds(loadDailyHabitIds());
      }
    };
    window.addEventListener('focus', checkDateRollover);
    const interval = setInterval(checkDateRollover, 60000);
    return () => {
      window.removeEventListener('focus', checkDateRollover);
      clearInterval(interval);
    };
  }, [activeDateKey]);

  const handleUpdatePreferences = useCallback((next: UserPreferences) => {
    setPreferences(next);
    savePreferences(next);
  }, []);

  const handleSelectCity = useCallback((city: CityLocation) => {
    setPreferences((prev) => {
      const next = { ...prev, city };
      savePreferences(next);
      return next;
    });
  }, []);

  const handleChangeScale = useCallback((scale: AqiScale) => {
    setPreferences((prev) => {
      if (scale === prev.preferredScale) return prev;
      const next = { ...prev, preferredScale: scale };
      savePreferences(next);
      return next;
    });
  }, []);

  const handleToggleDemoMode = useCallback((enabled: boolean) => {
    setDemoMode(enabled);
    saveDemoMode(enabled);
  }, []);

  const handleToggleHabit = useCallback(
    (habitId: string, title: string, willComplete: boolean) => {
      setCompletedHabitIds((prevIds) => {
        const nextIds = willComplete
          ? Array.from(new Set([...prevIds, habitId]))
          : prevIds.filter((id) => id !== habitId);
        saveDailyHabitIds(nextIds);
        return nextIds;
      });

      const todayKey = getLocalDateKey();
      const habitActionId = `habit-${todayKey}-${habitId}`;

      setImpactActions((prevActions) => {
        if (willComplete) {
          if (prevActions.some((a) => a.id === habitActionId)) {
            return prevActions;
          }
          const nextActions: ImpactAction[] = [
            {
              id: habitActionId,
              description: title,
              type: 'habit',
              co2AvoidedKg: 0,
              timestamp: new Date().toISOString(),
            },
            ...prevActions,
          ];
          saveImpactActions(nextActions);
          return nextActions;
        }
        const nextActions = prevActions.filter((a) => a.id !== habitActionId);
        saveImpactActions(nextActions);
        return nextActions;
      });
    },
    [],
  );

  const handleAddImpactAction = useCallback((action: ImpactAction) => {
    setImpactActions((prev) => {
      const next = [action, ...prev];
      saveImpactActions(next);
      return next;
    });
  }, []);

  const handleRemoveImpactAction = useCallback((id: string) => {
    setImpactActions((prev) => {
      const next = prev.filter((a) => a.id !== id);
      saveImpactActions(next);
      return next;
    });

    // Sync today's Daily Tips checklist if a today's habit entry is deleted
    const todayPrefix = `habit-${getLocalDateKey()}-`;
    if (id.startsWith(todayPrefix)) {
      const removedHabitId = id.slice(todayPrefix.length);
      setCompletedHabitIds((prevHabitIds) => {
        if (!prevHabitIds.includes(removedHabitId)) return prevHabitIds;
        const nextHabitIds = prevHabitIds.filter((hid) => hid !== removedHabitId);
        saveDailyHabitIds(nextHabitIds);
        return nextHabitIds;
      });
    }
  }, []);

  const handleUpdateFactors = useCallback((factors: EmissionFactors) => {
    setEmissionFactors(factors);
    saveEmissionFactors(factors);
  }, []);

  const handleChatMessagesChange = useCallback((next: ChatMessage[]) => {
    setChatMessages(next);
    saveChatHistory(next);
  }, []);

  const modalIsOpen = locationModalOpen || preferencesModalOpen;

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-[#1F2937] flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5 focus:rounded-xl focus:bg-[#2E7D62] focus:text-white focus:text-sm focus:font-medium focus:shadow-md"
      >
        Skip to main content
      </a>

      <div aria-hidden={modalIsOpen || undefined} className="flex flex-col flex-1">
        <Navbar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          cityLabel={preferences.city.name}
          onOpenLocationPicker={() => setLocationModalOpen(true)}
        />

        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 w-full max-w-[1100px] mx-auto px-4 sm:px-6 pt-5 sm:pt-8 pb-24 md:pb-12 focus:outline-none"
        >
          {activeTab === 'home' && (
            <HomePage
              preferences={preferences}
              aqiData={aqiData}
              aqiLoading={aqiLoading}
              aqiError={aqiError}
              advice={advice}
              adviceLoading={adviceLoading}
              demoMode={demoMode}
              onRefreshAqi={() =>
                fetchAqi(preferences.city, preferences.preferredScale, demoMode)
              }
              onChangeScale={handleChangeScale}
              onOpenLocationPicker={() => setLocationModalOpen(true)}
              onOpenPreferences={() => setPreferencesModalOpen(true)}
              onUpdatePreferences={handleUpdatePreferences}
              onEnableDemoMode={() => handleToggleDemoMode(true)}
              onOpenAssistant={() => setActiveTab('assistant')}
              onOpenDailyTips={() => setActiveTab('tips')}
            />
          )}

          {activeTab === 'assistant' && (
            <AssistantPage
              aqiData={aqiData}
              preferences={preferences}
              impactActions={impactActions}
              messages={chatMessages}
              onMessagesChange={handleChatMessagesChange}
            />
          )}

          {activeTab === 'tips' && (
            <DailyTipsPage
              aqiData={aqiData}
              preferences={preferences}
              completedIds={completedHabitIds}
              onToggleHabit={handleToggleHabit}
            />
          )}

          {activeTab === 'impact' && (
            <ImpactPage
              actions={impactActions}
              emissionFactors={emissionFactors}
              onAddAction={handleAddImpactAction}
              onRemoveAction={handleRemoveImpactAction}
              onUpdateFactors={handleUpdateFactors}
            />
          )}
        </main>
      </div>

      <LocationModal
        open={locationModalOpen}
        currentCity={preferences.city}
        demoMode={demoMode}
        onClose={() => setLocationModalOpen(false)}
        onSelectCity={handleSelectCity}
        onToggleDemoMode={handleToggleDemoMode}
      />

      <PreferencesModal
        open={preferencesModalOpen}
        preferences={preferences}
        onClose={() => setPreferencesModalOpen(false)}
        onSave={handleUpdatePreferences}
        onOpenLocationPicker={() => setLocationModalOpen(true)}
      />
    </div>
  );
}
