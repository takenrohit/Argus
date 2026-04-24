import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import EvidenceModal from './components/EvidenceModal';
import DashboardPage from './app/page';
import IncidentsPage from './app/incidents/page';
import MapPage from './app/map/page';
import DevicesPage from './app/devices/page';
import AlertsPage from './app/alerts/page';
import HelpPage from './app/help/page';
import HeroPage from './app/HeroPage';
import LoadingPage from './app/LoadingPage';
import type { BackendIncidentPayload, DashboardStats, Incident, IncidentSeverity, IncidentStatus } from './types';
import { buildAlertsWebSocketUrl, fetchIncidents, fetchStats, normalizeIncident, toUiStatus, updateIncidentStatus } from './lib/api';
import { createReconnectingWs } from './lib/reconnectingWs';

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

  useEffect(() => {
    let isCancelled = false;

    async function loadDashboardData() {
      try {
        const [incidentData, statsData] = await Promise.all([fetchIncidents(), fetchStats()]);
        if (isCancelled) return;
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
    return () => { isCancelled = true; };
  }, []);

  useEffect(() => {
    const ws = createReconnectingWs(buildAlertsWebSocketUrl(), {
      onOpen: (socket) => { try { socket.send('ping'); } catch { /* noop */ } },
      onStatus: (status) => {
        if (status === 'closed') setBackendNote('Live connection dropped — reconnecting…');
        if (status === 'open') setBackendNote(null);
      },
      onMessage: (event) => {
        let payload: BackendIncidentPayload & { type?: string; incident_id?: string; status?: string };
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }

        if (payload.type === 'alert') {
          const nextIncident = normalizeIncident(payload);
          setIncidents((current) => {
            const deduped = current.filter((incident) => incident.id !== nextIncident.id);
            return [nextIncident, ...deduped];
          });
          return;
        }

        if (payload.type === 'incident_update' && payload.incident_id && payload.status) {
          const nextSourceStatus = payload.status;
          setIncidents((current) =>
            current.map((incident) =>
              incident.id === payload.incident_id
                ? {
                    ...incident,
                    status: toUiStatus(nextSourceStatus, incident.alertLevel),
                    sourceStatus: nextSourceStatus,
                  }
                : incident
            )
          );
        }
      },
    });

    return () => ws.close();
  }, []);

  const activeTab = location.pathname.split('/')[1] || 'dashboard';
  const filteredIncidents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return incidents.filter((incident) => {
      const matchesSeverity = selectedSeverities.includes(incident.alertLevel);
      const matchesStatus = selectedStatuses.includes(incident.status);
      if (!matchesSeverity || !matchesStatus) return false;
      if (!query) return true;
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
    if (action === 'esc