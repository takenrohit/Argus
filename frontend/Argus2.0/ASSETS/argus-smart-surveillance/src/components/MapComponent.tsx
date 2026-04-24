import React, { useEffect, useMemo, useState } from 'react';
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

const redIcon = createCustomIcon('#ff6b3d');
const amberIcon = createCustomIcon('#ffb36b');
const greenIcon = createCustomIcon('#e8e8e8');
const searchIcon = createCustomIcon('#ff6b3d');
const cameraIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color:#ef4444;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 0 15px #ef4444, 0 0 30px rgba(239,68,68,0.4);"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const cityCoordinates: Record<string, [number, number]> = {
  mumbai: [19.076, 72.8777],
  bombay: [19.076, 72.8777],
  delhi: [28.6139, 77.209],
  'new delhi': [28.6139, 77.209],
  bengaluru: [12.9716, 77.5946],
  bangalore: [12.9716, 77.5946],
  chennai: [13.0827, 80.2707],
  hyderabad: [17.385, 78.4867],
  pune: [18.5204, 73.8567],
  kolkata: [22.5726, 88.3639],
  ahmedabad: [23.0225, 72.5714],
  jaipur: [26.9124, 75.7873],
  lucknow: [26.8467, 80.9462],
  surat: [21.1702, 72.8311],
  indore: [22.7196, 75.8577],
};

interface MapComponentProps {
  incidents: Incident[];
  cameras?: any[];
  onSelectIncident: (incident: Incident) => void;
  showHeatmap: boolean;
  searchQuery?: string;
}

interface SearchResult {
  label: string;
  position: [number, number];
}

function MapViewport({
  incidents,
  searchQuery,
  onSearchResult,
}: {
  incidents: Incident[];
  searchQuery?: string;
  onSearchResult: (result: SearchResult | null) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const query = searchQuery?.trim();

    if (query) {
      const normalizedQuery = query.toLowerCase();
      const knownCityEntry = Object.entries(cityCoordinates).find(([key]) => normalizedQuery.includes(key));

      if (knownCityEntry) {
        map.flyTo(knownCityEntry[1], 11, { duration: 0.8 });
        onSearchResult({ label: query, position: knownCityEntry[1] });
        return;
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => {
        void (async () => {
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=${encodeURIComponent(query)}`,
              { signal: controller.signal }
            );
            if (!response.ok) {
              return;
            }

            const data = (await response.json()) as Array<{ lat: string; lon: string; display_name?: string }>;
            if (!Array.isArray(data) || !data.length) {
              onSearchResult(null);
              return;
            }

            const lat = Number(data[0].lat);
            const lng = Number(data[0].lon);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              const position: [number, number] = [lat, lng];
              map.flyTo(position, 11, { duration: 0.8 });
              onSearchResult({ label: data[0].display_name || query, position });
            }
          } catch {
            // Keep the current viewport if the geocoder is unavailable.
          }
        })();
      }, 450);

      return () => {
        window.clearTimeout(timeoutId);
        controller.abort();
      };
    }

    onSearchResult(null);

    const valid = incidents.filter(
      (incident) =>
        Number.isFinite(incident.location.lat) &&
        Number.isFinite(incident.location.lng) &&
        !(incident.location.lat === 0 && incident.location.lng === 0)
    );

    if (!valid.length) {
      map.setView([12.9716, 77.5946], 11);
      return;
    }

    if (valid.length === 1) {
      map.setView([valid[0].location.lat, valid[0].location.lng], 13);
      return;
    }

    const bounds = L.latLngBounds(valid.map((incident) => [incident.location.lat, incident.location.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [60, 60] });
  }, [incidents, map, onSearchResult, searchQuery]);

  return null;
}

export default function MapComponent({ incidents, cameras = [], onSelectIncident, showHeatmap, searchQuery = '' }: MapComponentProps) {
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const center = useMemo<[number, number]>(() => {
    const firstValid = incidents.find(
      (incident) => !(incident.location.lat === 0 && incident.location.lng === 0)
    );
    return firstValid ? [firstValid.location.lat, firstValid.location.lng] : [12.9716, 77.5946];
  }, [incidents]);

  return (
    <div className="h-full w-full relative z-0">
      <MapContainer center={center} zoom={13} scrollWheelZoom className="w-full h-full" zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <MapViewport incidents={incidents} searchQuery={searchQuery} onSearchResult={setSearchResult} />

        {searchResult && (
          <Marker position={searchResult.position} icon={searchIcon}>
            <Popup className="custom-leaflet-popup">
              <div className="text-white p-3 bg-brand-surface rounded-xl border border-brand-border shadow-2xl min-w-[220px]">
                <div className="text-xs uppercase tracking-widest text-brand-blue font-bold mb-2">Search Location</div>
                <div className="text-[11px] text-white/60 leading-relaxed">{searchResult.label}</div>
              </div>
            </Popup>
          </Marker>
        )}

        {cameras.map((camera) => (
          <Marker
            key={camera.id}
            position={[camera.latitude, camera.longitude]}
            icon={cameraIcon}
          >
            <Popup className="custom-leaflet-popup">
              <div className="text-white p-3 bg-brand-surface rounded-xl border border-brand-border shadow-2xl min-w-[180px]">
                <div className="font-bold flex items-center justify-between mb-1">
                  <span className="text-xs uppercase tracking-widest text-brand-blue">{camera.id}</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-blue animate-pulse" />
                </div>
                <div className="text-[10px] text-white/70 font-medium mb-1">{camera.name}</div>
                <div className="text-[9px] text-white/40 italic">{camera.location}</div>
              </div>
            </Popup>
          </Marker>
        ))}

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
                        ? '#ff6b3d'
                        : incident.alertLevel === 'REVIEW'
                          ? '#ffb36b'
                          : '#e8e8e8',
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
