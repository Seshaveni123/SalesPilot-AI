import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { useSystemHealth } from './hooks/useSystemHealth';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { CallSummariesPage } from './pages/CallSummariesPage';
import { ConversationsPage } from './pages/ConversationsPage';
import { KnowledgeBasePage } from './pages/KnowledgeBasePage';
import { LeadDetailsPage } from './pages/LeadDetailsPage';
import { LeadsPage } from './pages/LeadsPage';
import { OverviewPage } from './pages/OverviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { VoiceAgentPage } from './pages/VoiceAgentPage';

export const App: React.FC = () => {
  const { health, checking, refresh } = useSystemHealth();

  return (
    <BrowserRouter>
      <AppShell
        health={health}
        checkingHealth={checking}
        onRefreshHealth={() => void refresh()}
      >
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/voice-agent" element={<VoiceAgentPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/lead-details" element={<LeadDetailsPage />} />
          <Route path="/lead-details/:leadId" element={<LeadDetailsPage />} />
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/conversations" element={<ConversationsPage />} />
          <Route path="/summaries" element={<CallSummariesPage />} />
          <Route path="/knowledge-base" element={<KnowledgeBasePage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route
            path="/settings"
            element={
              <SettingsPage health={health} onRefreshHealth={() => void refresh()} />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
};

export default App;
