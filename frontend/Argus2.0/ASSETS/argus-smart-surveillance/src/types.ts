export type IncidentSeverity = 'CRITICAL' | 'REVIEW' | 'MONITOR' | 'SYSTEM';
export type IncidentStatus = 'active' | 'reviewing' | 'dispatching' | 'resolved' | 'dismissed';

export interface Incident {
  id: string;
  type: string;
  confidence: number;
  timestamp: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  status: IncidentStatus;
  alertLevel: IncidentSeverity;
  cameraId: string;
  description?: string;
  evidenceUrl?: string;
  keypoints?: number[][];
  sourceStatus?: string;
}

export interface DashboardStats {
  total: number;
  critical: number;
  review: number;
  monitor: number;
  open: number;
  acknowledged?: number;
  resolved: number;
  false_positive?: number;
  dashboard_clients?: number;
}

export interface CameraStream {
  id: string;
  name: string;
  status: 'active' | 'tracking' | 'offline';
  location: string;
  feedUrl: string;
}

export interface BackendIncidentPayload {
  id?: string;
  incident_id?: string;
  incident_type?: string;
  type?: string;
  alert_level?: IncidentSeverity;
  threat_level?: IncidentSeverity;
  confidence?: number;
  timestamp?: string;
  created_at?: string;
  updated_at?: string;
  camera_id?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  status?: string;
  description?: string;
  frame_b64?: string;
}
