import { CheckSquare, Home, Leaf, MessageCircle } from 'lucide-react';

export type NavTab = 'home' | 'assistant' | 'tips' | 'impact';

interface NavbarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  cityLabel: string;
  onOpenLocationPicker: () => void;
}

const NAV_ITEMS: Array<{
  id: NavTab;
  label: string;
  Icon: typeof Home;
}> = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'assistant', label: 'AI Assistant', Icon: MessageCircle },
  { id: 'tips', label: 'Daily Tips', Icon: CheckSquare },
  { id: 'impact', label: 'My Impact', Icon: Leaf },
];

export function Navbar({
  activeTab,
  onSelectTab,
  cityLabel,
  onOpenLocationPicker,
}: NavbarProps) {
  return (
    <>
      {/* Desktop Top Navigation Bar */}
      <header className="hidden md:block sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E5E7EB]">
        <div className="max-w-[1100px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => onSelectTab('home')}
            className="min-h-[44px] text-lg font-bold tracking-tight text-[#1F2937] whitespace-nowrap shrink-0 flex items-center gap-2"
          >
            <Leaf className="w-5 h-5 text-[#2E7D62]" aria-hidden="true" />
            <span>AirWise</span>
          </button>

          <nav
            aria-label="Primary navigation"
            className="flex items-center gap-7"
          >
            {NAV_ITEMS.map(({ id, label }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectTab(id)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative min-h-[44px] flex items-center text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'text-[#23634D]'
                      : 'text-[#4B5563] hover:text-[#1F2937]'
                  }`}
                >
                  {label}
                  {active && (
                    <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-[#2E7D62] rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={onOpenLocationPicker}
            aria-label={`Change location, currently ${cityLabel}`}
            className="min-h-[44px] px-3.5 py-1.5 rounded-xl border border-[#E5E7EB] bg-[#F8FAF9] hover:border-[#2E7D62] text-xs font-medium text-[#1F2937] whitespace-nowrap shrink-0 max-w-[180px] truncate transition-colors"
          >
            {cityLabel}
          </button>
        </div>
      </header>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E5E7EB] pb-safe"
      >
        <div className="grid grid-cols-4 h-16">
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectTab(id)}
                aria-current={active ? 'page' : undefined}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-1 transition-colors ${
                  active
                    ? 'text-[#23634D]'
                    : 'text-[#4B5563] hover:text-[#1F2937]'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'stroke-[2.25]' : ''}`} aria-hidden="true" />
                <span className="text-[11px] font-medium leading-none whitespace-nowrap">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
