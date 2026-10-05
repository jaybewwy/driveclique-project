import { Crown, Lock, Settings, Trash2 } from "lucide-react";
import GeneralSection from "./GeneralSection";
import PrivacySection from "./PrivacySection";
import OwnershipSection from "./OwnershipSection";
import DangerZoneSection from "./DangerZoneSection";

// The Club Settings page's sections, in nav order. Each one has its own URL,
// /club/:clubId/settings/<id>, so adding a section means adding an entry here.
// Every Component is rendered with the same props (see pages/ClubSettings.jsx).
export const CLUB_SETTINGS_SECTIONS = [
  { id: "general", label: "General", icon: Settings, Component: GeneralSection },
  { id: "privacy", label: "Privacy", icon: Lock, Component: PrivacySection },
  { id: "ownership", label: "Ownership", icon: Crown, Component: OwnershipSection },
  { id: "danger-zone", label: "Danger Zone", icon: Trash2, Component: DangerZoneSection },
];

export const DEFAULT_CLUB_SETTINGS_SECTION = CLUB_SETTINGS_SECTIONS[0].id;
