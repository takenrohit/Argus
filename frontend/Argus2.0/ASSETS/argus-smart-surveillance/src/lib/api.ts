import type { BackendIncidentPayload, ClustersResponse, DashboardStats, Incident, IncidentSeverity } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const WS_BASE_URL  = (import.meta.env.VITE_WS_BASE_URL  || '').replace(/\/$/, '');

function getApiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

function inferSeverity(payload: BackendIncidentPayload): IncidentSeverity {
  return payload.alert_level || payload.threat_level || 'SYSTEM';
}

function formatIncidentType(rawType?: string) {
  if (!rawType) return 'Unknown incident';
  return rawType
    .toLowerCase()
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function toUiStatus(sourceStatus: string | undefined, severity: IncidentSeverity): Incident['status'] {
  switch (sourceStatus) {
    case 'resolved':       return 'resolved';
    case 'false_positive': return 'dismissed';
    case 'acknowledged':   return 'dispatching';
    default:               return severity === 'CRITICAL' ? 'reviewing' : 'active';
  }
}

function formatTimestamp(timestamp?: string) {
  if (!timestamp) return new Date().toLocaleString();
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleString();
}

function toConfidencePercent(confidence?: number) {
  if (typeof confidence !== 'number' || Number.isNaN(confidence)) return 0;
  return confidence <= 1 ? Math.round(confidence * 100) : Math.round(confidence);
}

export function normalizeIncident(payload: BackendIncidentPayload): Incident {
  const alertLevel = inferSeverity(payload);
  const id = payload.id || payload.incident_id || `incident-${Date.now()}`;
  return {
    id,
    type:       formatIncidentType(payload.incident_type || payload.type),
    confidence: toConfidencePercent(payload.confidence),
    timestamp:  formatTimestamp(payload.timestamp || payload.created_at || payload.updated_at),
    location: {
      lat:     payload.latitude  ?? 0,
      lng:     payload.longitude ?? 0,
      address: payload.location  || 'Unknown location',
    },
    status:      toUiStatus(payload.status, alertLevel),
    alertLevel,
    cameraId:    payload.camera_id || 'CAM-01',
    description: payload.description,
    evidenceUrl: payload.frame_b64
      ? `data:image/jpeg;base64,${payload.frame_b64}`
      : undefined,
    sourceStatus: payload.status,
  };
}

export async function fetchIncidents() {
  const response = await fetch(getApiUrl('/api/incidents'));
  if (!response.ok) throw new Error(`Failed to fetch incidents (${response.status})`);
  const payload = await response.json();
  return {
    incidents: Array.isArray(payload.incidents)
      ? payload.incidents.map((incident: BackendIncidentPayload) => normalizeIncident(incident))
      : [],
    total: payload.total ?? 0,
    note:  payload.note as string | undefined,
  };
}

export async function fetchStats(): Promise<DashboardStats> {
  const response = await fetch(getApiUrl('/api/stats'));
  if (!response.ok) throw new Error(`Failed to fetch stats (${response.status})`);
  return response.json();
}

export async function updateIncidentStatus(
  incidentId: string,
  status: 'acknowledged' | 'resolved' | 'false_positive'
) {
  const response = await fetch(getApiUrl(`/api/incidents/${incidentId}`), {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ status }),
  });
  if (!response.ok) throw new Error(`Failed to update incident (${response.status})`);
  return response.json();
}

// ─────────────────────────────────────────────
//  WEBSOCKET URL BUILDER
// ─────────────────────────────────────────────

export function buildAlertsWebSocketUrl(): string {
  // 1. Explicit env var set (production deployment)
  if (WS_BASE_URL) {
    return `${WS_BASE_URL}/ws/alerts`;
  }

  // 2. Dev mode — Vite proxy rewrites /ws → ws://127.0.0.1:8000
  //    Use relative path so it works on any port/host
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host     = window.location.host;   // e.g. localhost:3000 in dev
  return `${protocol}//${host}/ws/alerts`;
}

// ─────────────────────────────────────────────
//  FIGHT CLUSTERS
// ─────────────────────────────────────────────

export async function fetchClusters(cameraId: string): Promise<ClustersResponse> {
  const response = await fetch(getApiUrl(`/api/clusters/${cameraId}`));
  if (!response.ok) {
    throw new Error(`Failed to fetch clusters for ${cameraId} (${response.status})`);
  }
  return response.json();
}