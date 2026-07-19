import { CLUB_TAGS } from "../../lib/clubTags";

// Multi-select toggle-pill picker shared by CreateClub.jsx and ClubDetail.jsx's Edit
// Club modal (a club's own tags, capped at `max`) and FindClub.jsx (a filter row, no cap).
const ClubTagPicker = ({ selected, onChange, max }) => {
  const toggle = (tag) => {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag));
    } else if (!max || selected.length < max) {
      onChange([...selected, tag]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {CLUB_TAGS.map((tag) => {
        const active = selected.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            aria-pressed={active}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${
              active
                ? "border-red-600 bg-red-600/10 text-white"
                : "border-zinc-700 bg-black text-zinc-400 hover:border-zinc-500"
            }`}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
};

export default ClubTagPicker;
