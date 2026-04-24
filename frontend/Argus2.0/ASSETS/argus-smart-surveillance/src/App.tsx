import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import EvidenceModal from './components/EvidenceModal';
import CameraFeedModal from './components/CameraFeedModal';
import DashboardPage from './app/page';
import IncidentsPage from './app/incidents/page';
import MapPage from './app/map/page';
import DevicesPage from './app/devices/page';
import AlertsPage from './app/alerts/page';
import HelpPage from './app/help/page';
import AboutPage from './app/about/page';
import ReportsPage from './app/reports/page';
import HeroPage from './app/HeroPage';
import LoadingPage from './app/LoadingPage';
import type { BackendIncidentPayload, DashboardStats, Incident, IncidentSeverity, IncidentStatus } from './types';
import { buildAlertsWebSocketUrl, fetchIncidents, fetchStats, normalizeIncident, updateIncidentStatus } from './lib/api';

function MainContent() {
  const allSeverities: IncidentSeverity[] = ['CRITICAL', 'REVIEW', 'MONITOR', 'SYSTEM'];
  const allStatuses: IncidentStatus[] = ['active', 'reviewing', 'dispatching', 'resolved', 'dismissed'];
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [backendNote, setBackendNote] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedSeverities, setSelectedSeverities] = useState<IncidentSeverity[]>(allSeverities);
  const [selectedStatuses, setSelectedStatuses] = useState<IncidentStatus[]>(allStatuses);
  const navigate = useNavigate();
  const location = useLocation();
  const [cameraModalOpen, setCameraModalOpen] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function loadDashboardData() {
      try {
        const [incidentData, statsData] = await Promise.all([fetchIncidents(), fetchStats()]);
        if (isCancelled) {
          return;
        }

        setIncidents(incidentData.incidents);
        setStats(statsData);
        setBackendNote(incidentData.note || null);
      } catch (error) {
        if (!isCancelled) {
          setBackendNote(error instanceof Error ? error.message : 'Unable to connect to backend.');
        }
      }
    }

    loadDashboardData();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const socket = new WebSocket(buildAlertsWebSocketUrl());

    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data) as BackendIncidentPayload & {
        type?: string;
        incident_id?: string;
        status?: string;
      };

      if (payload.type === 'alert') {
        const nextIncident = normalizeIncident(payload);
        setIncidents((current) => {
          const deduped = current.filter((incident) => incident.id !== nextIncident.id);
          return [nextIncident, ...deduped];
        });
        return;
      }

      if (payload.type === 'incident_update' && payload.incident_id && payload.status) {
        setIncidents((current) =>
          current.map((incident) =>
            incident.id === payload.incident_id
              ? normalizeIncident({
                  ...incident,
                  id: incident.id,
                  type: incident.type,
                  alert_level: incident.alertLevel,
                  camera_id: incident.cameraId,
                  location: incident.location.address,
                  latitude: incident.location.lat,
                  longitude: incident.location.lng,
                  confidence: incident.confidence,
                  timestamp: incident.timestamp,
                  status: payload.status,
                  description: incident.description,
                })
              : incident
          )
        );
      }
    };

    socket.onopen = () => {
      socket.send('ping');
    };

    return () => {
      socket.close();
    };
  }, []);

  const activeTab = location.pathname.split('/')[1] || 'dashboard';
  const filteredIncidents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return incidents.filter((incident) => {
      const matchesSeverity = selectedSeverities.includes(incident.alertLevel);
      const matchesStatus = selectedStatuses.includes(incident.status);
      if (!matchesSeverity || !matchesStatus) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        incident.type.toLowerCase().includes(query) ||
        incident.cameraId.toLowerCase().includes(query) ||
        incident.location.address.toLowerCase().includes(query)
      );
    });
  }, [incidents, searchQuery, selectedSeverities, selectedStatuses]);

  const criticalAlert = useMemo(
    () =>
      filteredIncidents.find(
        (incident) => incident.alertLevel === 'CRITICAL' && incident.status !== 'resolved' && incident.status !== 'dismissed'
      ) || null,
    [filteredIncidents]
  );

  async function handleAction(id: string, action: 'dispatch' | 'dismiss' | 'escalate') {
    if (action === 'escalate') {
      setIncidents((current) =>
        current.map((incident) =>
          incident.id === id ? { ...incident, confidence: Math.min(100, incident.confidence + 5) } : incident
        )
      );
      return;
    }

    const status = action === 'dispatch' ? 'acknowledged' : 'false_positive';

    try {
      await updateIncidentStatus(id, status);
      setIncidents((current) =>
        current.map((incident) =>
          incident.id === id
            ? {
                ...incident,
                status: action === 'dispatch' ? 'dispatching' : 'dismissed',
                sourceStatus: status,
              }
            : incident
        )
      );
      setSelectedIncident(null);
    } catch (error) {
      setBackendNote(error instanceof Error ? error.message : 'Unable to update incident.');
    }
  }

  function handlePageChange(tab: string) {
    if (tab === 'cameras') {
      setCameraModalOpen(true);
      return;
    }
    navigate(`/${tab}`);
  }

  function handleToggleSeverity(severity: IncidentSeverity) {
    setSelectedSeverities((current) =>
      current.includes(severity) ? current.filter((item) => item !== severity) : [...current, severity]
    );
  }

  function handleToggleStatus(status: IncidentStatus) {
    setSelectedStatuses((current) =>
      current.includes(status) ? current.filter((item) => item !== status) : [...current, status]
    );
  }

  function handleClearAll() {
    setSearchQuery('');
    setSelectedSeverities(allSeverities);
    setSelectedStatuses(allStatuses);
    setFiltersOpen(false);
  }

  function handleSetupView() {
    navigate('/dashboard?panel=overview');
    setSearchQuery('');
    setSelectedSeverities(['CRITICAL', 'REVIEW']);
    setSelectedStatuses(['active', 'reviewing', 'dispatching']);
    setFiltersOpen(false);
  }

  return (
    <div className="flex h-screen bg-brand-dark overflow-hidden font-sans">
      <Sidebar activeTab={activeTab} setActiveTab={handlePageChange} />

      <main className="flex-1 flex flex-col min-w-0 relative h-full">
        <TopBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filtersOpen={filtersOpen}
          onToggleFilters={() => setFiltersOpen((open) => !open)}
          onClearAll={handleClearAll}
          onSetupView={handleSetupView}
          selectedSeverities={selectedSeverities}
          selectedStatuses={selectedStatuses}
          onToggleSeverity={handleToggleSeverity}
          onToggleStatus={handleToggleStatus}
        />

        {location.pathname !== '/dashboard' && (backendNote || criticalAlert || stats) && (
          <div className="px-6 py-3 border-b border-white/5 bg-brand-dark/70 text-xs text-white/60 flex flex-wrap items-center gap-4">
            {backendNote && <span>{backendNote}</span>}
            {stats && (
              <span>
                Live totals: {stats.total} incidents, {stats.critical} critical, {stats.resolved} resolved
              </span>
            )}
            {criticalAlert && <span>Highest priority: {criticalAlert.type} at {criticalAlert.location.address}</span>}
          </div>
        )}

        <div className="flex-1 relative overflow-hidden flex">
          <Routes>
            <Route
              path="/dashboard"
              element={<DashboardPage incidents={filteredIncidents} onSelectIncident={setSelectedIncident} searchQuery={searchQuery} />}
            />
            <Route
              path="/devices"
              element={<DevicesPage incidents={filteredIncidents} onSelectIncident={setSelectedIncident} searchQuery={searchQuery} />}
            />
            <Route path="/alerts" element={<AlertsPage incidents={filteredIncidents} onSelectIncident={setSelectedIncident} />} />
            <Route path="/incidents" element={<IncidentsPage incidents={filteredIncidents} onSelectIncident={setSelectedIncident} />} />
            <Route
              path="/analytics"
              element={<MapPage incidents={filteredIncidents} onSelectIncident={setSelectedIncident} searchQuery={searchQuery} />}
            />
            <Route
              path="/reports"
              element={<ReportsPage incidents={filteredIncidents} onSelect={setSelectedIncident} />}
            />
            <Route path="/help" element={<HelpPage incidents={filteredIncidents} onSelectIncident={setSelectedIncident} />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </main>

      <EvidenceModal incident={selectedIncident} onClose={() => setSelectedIncident(null)} onAction={handleAction} />
      <CameraFeedModal isOpen={cameraModalOpen} onClose={() => setCameraModalOpen(false)} />
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  const routeKey = location.pathname === '/' ? '/' : location.pathname === '/loading' ? '/loading' : '/app';

  return (
    <AnimatePresence>
      <motion.div key={routeKey} className="w-full h-full">
        <Routes location={location}>
          <Route path="/" element={<HeroPage />} />
          <Route path="/loading" element={<LoadingPage />} />
          <Route
            path="/*"
            element={
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1 }}
                className="w-full h-full"
              >
                <MainContent />
              </motion.div>
            }
          />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <Router>
      <AnimatedRoutes />
    </Router>
  );
}
