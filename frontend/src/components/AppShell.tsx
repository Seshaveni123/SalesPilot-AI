import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  AudioWaveform,
  BarChart3,
  BookOpen,
  CalendarClock,
  ChevronRight,
  FileText,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  Mic,
  RefreshCw,
  Settings,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type { SystemHealth } from '../types';

interface AppShellProps {
  children: React.ReactNode;
  health: SystemHealth;
  checkingHealth: boolean;
  onRefreshHealth: () => void;
}

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  group: 'Command' | 'Revenue CRM' | 'Intelligence';
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', to: '/', icon: LayoutDashboard, group: 'Command' },
  { label: 'Voice Studio', to: '/voice-agent', icon: AudioWaveform, group: 'Command' },
  { label: 'Leads CRM', to: '/leads', icon: Users, group: 'Revenue CRM' },
  { label: 'Lead Dossier', to: '/lead-details', icon: UserCheck, group: 'Revenue CRM' },
  { label: 'Appointments', to: '/appointments', icon: CalendarClock, group: 'Revenue CRM' },
  { label: 'Conversations', to: '/conversations', icon: MessageSquareText, group: 'Intelligence' },
  { label: 'Call Summaries', to: '/summaries', icon: FileText, group: 'Intelligence' },
  { label: 'Knowledge Base', to: '/knowledge-base', icon: BookOpen, group: 'Intelligence' },
  { label: 'Analytics', to: '/analytics', icon: BarChart3, group: 'Intelligence' },
  { label: 'Settings', to: '/settings', icon: Settings, group: 'Intelligence' },
];

const GROUPS: Array<NavItem['group']> = ['Command', 'Revenue CRM', 'Intelligence'];

export const AppShell: React.FC<AppShellProps> = ({
  children,
  health,
  checkingHealth,
  onRefreshHealth,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const currentNav =
    NAV_ITEMS.find((item) =>
      item.to === '/'
        ? location.pathname === '/'
        : location.pathname.startsWith(item.to)
    ) || NAV_ITEMS[0];

  const renderRailContent = () => (
    <div className="flex h-full flex-col bg-white/95 backdrop-blur-xl">
      {/* Brand Lockup */}
      <div className="flex h-16 items-center justify-between border-b border-zinc-200/80 px-5">
        <button
          type="button"
          onClick={() => {
            navigate('/');
            setMobileOpen(false);
          }}
          className="flex items-center gap-2.5 text-left focus:outline-none"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-950 text-white shadow-sm">
            <AudioWaveform className="h-4 w-4 text-indigo-400" />
          </div>
          <div>
            <span className="block font-display text-sm font-bold tracking-tight text-zinc-950">
              SalesPilot
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-widest text-indigo-600">
              AI Revenue OS
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 lg:hidden"
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Primary CTA */}
      <div className="px-4 pt-4">
        <button
          type="button"
          onClick={() => {
            navigate('/voice-agent');
            setMobileOpen(false);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 px-3.5 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-zinc-800"
        >
          <Mic className="h-3.5 w-3.5 text-indigo-400" />
          <span>New Voice Session</span>
        </button>
      </div>

      {/* Grouped Navigation */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5" aria-label="Main navigation">
        {GROUPS.map((group) => (
          <div key={group}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              {group}
            </p>
            <div className="space-y-0.5">
              {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `group flex items-center justify-between rounded-xl px-3 py-2 text-[13px] font-medium transition-all ${
                        isActive
                          ? 'bg-indigo-50/90 font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200/70'
                          : 'text-zinc-600 hover:bg-zinc-100/80 hover:text-zinc-950'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className="flex items-center gap-2.5">
                          <Icon
                            className={`h-4 w-4 shrink-0 transition-colors ${
                              isActive
                                ? 'text-indigo-600'
                                : 'text-zinc-400 group-hover:text-zinc-700'
                            }`}
                          />
                          <span>{item.label}</span>
                        </div>
                        {isActive && (
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Live Telemetry Stack Card */}
      <div className="border-t border-zinc-200/80 p-3.5">
        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  health.status === 'online'
                    ? 'bg-emerald-500'
                    : health.status === 'degraded'
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
              />
              <span className="text-xs font-semibold text-zinc-900">
                {health.status === 'online' ? 'System Ready' : 'API Offline'}
              </span>
            </div>
            <button
              type="button"
              onClick={onRefreshHealth}
              disabled={checkingHealth}
              className="rounded-md p-1 text-zinc-400 hover:bg-white hover:text-zinc-700 disabled:opacity-50"
              title="Refresh system health"
              aria-label="Refresh system health"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${checkingHealth ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-[10px] font-medium">
            <div
              className={`rounded-md px-1.5 py-1 text-center ring-1 ring-inset ${
                health.gemini_configured
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/70'
                  : 'bg-white text-zinc-500 ring-zinc-200'
              }`}
            >
              Gemini
            </div>
            <div
              className={`rounded-md px-1.5 py-1 text-center ring-1 ring-inset ${
                health.rag_indexed
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/70'
                  : 'bg-white text-zinc-500 ring-zinc-200'
              }`}
            >
              FAISS
            </div>
            <div
              className={`rounded-md px-1.5 py-1 text-center ring-1 ring-inset ${
                health.database_connected
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/70'
                  : 'bg-white text-zinc-500 ring-zinc-200'
              }`}
            >
              SQLite
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop Light Studio Rail */}
      <aside className="hidden w-60 shrink-0 border-r border-zinc-200/80 lg:fixed lg:inset-y-0 lg:flex lg:flex-col">
        {renderRailContent()}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-zinc-950/35 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 w-64 max-w-[82vw] border-r border-zinc-200 shadow-2xl">
            {renderRailContent()}
          </aside>
        </div>
      )}

      {/* Workspace Area */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        {/* Translucent Top Command Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-200/80 bg-white/75 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5 text-xs">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-600 hover:bg-zinc-50 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>
            <span className="hidden font-medium text-zinc-400 sm:inline">
              SalesPilot AI
            </span>
            <ChevronRight className="hidden h-3.5 w-3.5 text-zinc-300 sm:inline" />
            <span className="font-display text-sm font-semibold text-zinc-900">
              {currentNav.label}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
                health.status === 'online'
                  ? 'bg-emerald-50/90 text-emerald-700 ring-emerald-200/80 hover:bg-emerald-100/70'
                  : 'bg-rose-50 text-rose-700 ring-rose-200 hover:bg-rose-100'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  health.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
              <span>
                {health.status === 'online'
                  ? health.gemini_configured
                    ? 'Live AI Connected'
                    : 'API Online · Key Missing'
                  : 'API Disconnected'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/voice-agent')}
              className="hidden items-center gap-1.5 rounded-full bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 sm:inline-flex"
            >
              <AudioWaveform className="h-3.5 w-3.5" />
              <span>Voice Studio</span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1380px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
};
