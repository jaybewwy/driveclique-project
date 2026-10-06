import { NavLink } from "react-router-dom";

/**
 * Links to each Club Settings section the viewer may open (`sections`, from
 * clubSettingsSectionsFor): a column beside the section on wide screens, and
 * rows above it on narrow ones (wrapping, so none is hidden off-screen).
 * NavLink marks the current section with aria-current="page".
 */
const ClubSettingsNav = ({ clubId, sections }) => (
  <nav
    aria-label="Club settings"
    className="flex flex-wrap gap-1 lg:flex-col lg:flex-nowrap lg:flex-none lg:w-48 lg:self-start"
  >
    {sections.map(({ id, label, icon: Icon }) => (
      <NavLink
        key={id}
        to={`/club/${clubId}/settings/${id}`}
        className={({ isActive }) =>
          `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm whitespace-nowrap transition-all duration-200 ${
            isActive
              ? "bg-zinc-800 text-white font-semibold"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
          }`
        }
      >
        <Icon className="w-[18px] h-[18px]" />
        {label}
      </NavLink>
    ))}
  </nav>
);

export default ClubSettingsNav;
