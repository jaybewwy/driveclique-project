import { useNavigate } from 'react-router-dom';
import { X, Check } from 'lucide-react';

/**
 * Compact "Getting Started" checklist card for new users — UC-26.
 * Rendered on the Dashboard until all steps are complete or the user dismisses it.
 */
const OnboardingChecklist = ({ items, onDismiss }) => {
  const navigate = useNavigate();
  const doneCount = items.filter((i) => i.done).length;

  return (
    <div className="relative glass-card p-4 mb-6 animate-fade-slide-up">
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss getting started checklist"
        className="absolute top-3 right-3 text-zinc-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/[0.06]"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="mb-3 pr-6">
        <p className="section-label mb-0.5">Getting Started</p>
        <p className="text-xs text-zinc-400">{doneCount}/{items.length} complete</p>
      </div>

      <div className="space-y-1.5">
        {items.map((item) => (
          <button
            type="button"
            key={item.key}
            onClick={() => navigate(item.path)}
            disabled={item.done}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors duration-200 ${
              item.done ? 'cursor-default' : 'hover:bg-white/[0.05]'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border ${
                item.done
                  ? 'bg-gradient-to-br from-red-600 to-orange-600 border-transparent'
                  : 'border-white/[0.18]'
              }`}
            >
              {item.done && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className={`text-sm ${item.done ? 'text-zinc-400 line-through' : 'text-white'}`}>
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default OnboardingChecklist;
