import { Crown, Flag, Lock, Settings, Trash2 } from "lucide-react";
import GeneralSection from "./GeneralSection";
import PrivacySection from "./PrivacySection";
import ReportsSection from "./ReportsSection";
import OwnershipSection from "./OwnershipSection";
import DangerZoneSection from "./DangerZoneSection";

// The Club Settings page's sections, in nav order. Each one has its own URL,
// /club/:clubId/settings/<id>, so adding a section means adding an entry here.
// Every Component is rendered with the same props (see pages/ClubSettings.jsx).
// A section is the leader's alone unless it sets `coLeaders: true`.
export const CLUB_SETTINGS_SECTIONS = [
  { id: "general", label: "General", icon: Settings, Component: GeneralSection },
  { id: "privacy", label: "Privacy", icon: Lock, Component: PrivacySection },
  { id: "reports", label: "Reports", icon: Flag, Component: ReportsSection, coLeaders: true },
  { id: "ownership", label: "Ownership", icon: Crown, Component: OwnershipSection },
  { id: "danger-zone", label: "Danger Zone", icon: Trash2, Component: DangerZoneSection },
];

/**
 * The sections a viewer may open, given their getClubRole() result: all of
 * them for the leader, the `coLeaders` ones for a co-leader, none otherwise.
 */
export const clubSettingsSectionsFor = (role) =>
  CLUB_SETTINGS_SECTIONS.filter((section) => role.isLeader || (role.isCoLeader && section.coLeaders));
