import { useState } from "react";
import NavBar from "../components/NavBar";
import SettingsSidebar from "../components/settings/SettingsSidebar";
import PersonalAnalytics from "../components/settings/PersonalAnalytics";
import ClubsAnalytics from "../components/settings/ClubsAnalytics";
import ProfileSettings from "../components/settings/ProfileSettings";
import AppearanceSettings from "../components/settings/AppearanceSettings";

const UserSettings = ({ user, onLogout, onUpdateUser }) => {
  const [activeView, setActiveView] = useState("clubs");

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <NavBar user={user} onLogout={onLogout} />
      <div className="flex flex-1">
        <SettingsSidebar user={user} activeView={activeView} onViewChange={setActiveView} />
        <main id="main-content" className="flex-1 min-w-0 p-6 max-w-5xl mx-auto w-full">
          {activeView === "personal" && <PersonalAnalytics />}
          {activeView === "clubs"    && <ClubsAnalytics />}
          {activeView === "profile"  && <ProfileSettings onLogout={onLogout} onUpdateUser={onUpdateUser} />}
          {activeView === "appearance" && <AppearanceSettings onUpdateUser={onUpdateUser} />}
        </main>
      </div>
    </div>
  );
};

export default UserSettings;
