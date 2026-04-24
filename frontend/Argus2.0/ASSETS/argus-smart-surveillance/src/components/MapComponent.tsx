import React, { useMemo } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { cn } from '../lib/utils';
import type { Incident } from '../types';

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;

const createCustomIcon = (color: string) =>
  L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color:${color};width:12px;height:12px;border-radius:50%;border:3px solid rgba(255,255,255,0.2);box-shadow:0 0 15px ${color};"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });

const redIcon = createCustomIcon('#ff4d4d');
const amberIcon = createCustomIcon('#ff9933');
const greenIcon = createCustomIcon('#2ecc71');

interface MapComponentProps {
  incidents: Incident[];
  onSelectIncident: (incident: Incident) => void;
  showHeatmap: boolean;
}

function MapViewport({ incidents }: { incidents: Incident[] }) {
  const map = useMap();

  useMemo(() => {
    const valid = incidents.filter(
      (incident) =>
        Number.isFinite(incident.location.lat) &&
        Number.isFinite(incident.location.lng) &&
        !(incident.location.lat === 0 && incident.location.lng === 0)
    );

    if (!valid.length) {
      map.setView([28.6139, 77.209], 12);
      return;
    }

    if (valid.length === 1) {
      map.setView([valid[0].location.lat, valid[0].location.lng], 13);
      return;
    }

    const bounds = L.latLngBounds(valid.map((incident) => [incident.location.lat, incident.location.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [60, 60] });
  }, [incidents, map]);

  return null;
}

export default function MapComponent({ incidents, onSelectIncident, showHeatmap }: MapComponentProps) {
  const center = useMemo<[number, number]>(() => {
    const firstValid = incidents.find(
      (incident) => !(incident.location.lat === 0 && incident.location.lng === 0)
    );
    return firstValid ? [firstValid.location.lat, firstValid.location.lng] : [28.6139, 77.209];
  }, [incidents]);

  return (
    <div className="h-full w-full relative z-0">
      <MapContainer center={center} zoom={13} scrollWheelZoom className="w-full h-full" zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <MapViewport incidents={incidents} />

        {incidents.map((incident) => {
          const icon =
            incident.alertLevel === 'CRITICAL'
              ? redIcon
              : incident.alertLevel === 'REVIEW'
                ? amberIcon
                : greenIcon;

          return (
            <React.Fragment key={incident.id}>
              <Marker
                position={[incident.location.lat, incident.location.lng]}
                icon={icon}
                eventHandlers={{
                  click: () => onSelectIncident(incident),
                }}
              >
                <Popup className="custom-leaflet-popup">
                  <div className="text-white p-3 bg-brand-surface rounded-xl border border-brand-border shadow-2xl min-w-[200px]">
                    <div className="font-bold flex items-center justify-between mb-2">
                      <span className="text-xs uppercase tracking-widest">{incident.type}</span>
                      <div
                        className={cn(
                          'w-1.5 h-1.5 rounded-full animate-pulse',
                          incident.alertLevel === 'CRITICAL'
                            ? 'bg-brand-red'
                            : incident.alertLevel === 'REVIEW'
                              ? 'bg-brand-amber'
                              : 'bg-brand-green'
                        )}
                      />
                    </div>
                    <div className="text-[10px] text-white/40 font-mono mb-2">{incident.location.address}</div>
                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <span className="text-[10px] font-bold text-white/60">CONFIDENCE</span>
                      <span className="text-[10px] font-mono text-brand-blue">{incident.confidence}%</span>
                    </div>
                  </div>
                </Popup>
              </Marker>

              {showHeatmap && (
                <Circle
                  center={[incident.location.lat, incident.location.lng]}
                  pathOptions={{
                    fillColor:
                      incident.alertLevel === 'CRITICAL'
                        ? '#ff4d4d'
                        : incident.alertLevel === 'REVIEW'
                          ? '#ff9933'
                          : '#2ecc71',
                    color: 'transparent',
                    fillOpacity: 0.18,
                  }}
                  radius={250 + Math.max(incident.confidence, 25) * 6}
                />
              )}
            </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}
