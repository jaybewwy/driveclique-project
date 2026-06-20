import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { pinIcon } from "../../lib/leafletIcon";

function Recenter({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng]);
  }, [lat, lng, map]);
  return null;
}

/**
 * DriveMapPicker — draggable pin for fine-tuning a drive's meeting point (UC-23).
 *
 * Props
 *   lat, lng  number       — current pin position
 *   onChange  ({lat,lng}) => void — fired when the pin is dropped after a drag
 */
export function DriveMapPicker({ lat, lng, onChange }) {
  return (
    <div className="rounded-xl overflow-hidden border border-zinc-700 h-[200px]">
      <MapContainer
        center={[lat, lng]}
        zoom={14}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter lat={lat} lng={lng} />
        <Marker
          position={[lat, lng]}
          icon={pinIcon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const { lat: newLat, lng: newLng } = e.target.getLatLng();
              onChange({ lat: newLat, lng: newLng });
            },
          }}
        />
      </MapContainer>
    </div>
  );
}
