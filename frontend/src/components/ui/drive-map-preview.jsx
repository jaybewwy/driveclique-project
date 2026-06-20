import { MapContainer, TileLayer, Marker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { pinIcon } from "../../lib/leafletIcon";

/**
 * DriveMapPreview — read-only meeting-point map shown to members on the
 * drive detail modal (UC-23). No drag, no zoom/scroll interaction — just a
 * pinned location, matching the static-thumbnail look without depending on
 * a third-party static-image service.
 *
 * Props
 *   lat, lng  number — pin position
 */
export function DriveMapPreview({ lat, lng }) {
  return (
    <div className="rounded-xl overflow-hidden border border-zinc-800 h-40">
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        dragging={false}
        touchZoom={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={[lat, lng]} icon={pinIcon} />
      </MapContainer>
    </div>
  );
}
