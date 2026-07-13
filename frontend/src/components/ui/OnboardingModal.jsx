import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Calendar, Bell, ArrowRight } from 'lucide-react';
import Modal from '../Modal';

const STEPS = [
  {
    icon: Users,
    title: 'Find or Create a Club',
    body: "Car clubs are where the action happens. Browse public clubs near you, join with an invite code, or start your own to bring your crew together.",
  },
  {
    icon: Calendar,
    title: 'RSVP to a Drive',
    body: "Once you're in a club, keep an eye out for scheduled drives. RSVP going, maybe, or not-going so the leader knows who to expect.",
  },
  {
    icon: Bell,
    title: 'Get Notified',
    body: "The bell icon in the top nav keeps you in the loop — announcements, drive reminders, and waitlist updates land there and in your email.",
  },
];

/**
 * Full-screen 3-step welcome tour shown once, immediately after registration.
 * Dismissible at any point via Skip, the close button, or the overlay — UC-26.
 */
const OnboardingModal = ({ onClose }) => {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const isLast = step === STEPS.length - 1;
  const { icon: Icon, title, body } = STEPS[step];

  const goTo = (path) => {
    onClose();
    navigate(path);
  };

  return (
    <Modal isOpen onClose={onClose} size="md">
      <div className="text-center">
        <div className="w-14 h-14 mx-auto mb-4 bg-gradient-to-br from-red-600 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-500/25">
          <Icon className="w-7 h-7 text-white" />
        </div>
        <h2 id="modal-title" className="text-xl font-bold text-white mb-2">{title}</h2>
        <p className="text-sm text-zinc-400 leading-relaxed mb-6">{body}</p>

        {step === 0 && (
          <div className="flex gap-2.5 mb-6">
            <button type="button" onClick={() => goTo('/find-club')} className="flex-1 btn-primary py-2.5 text-sm">
              Find a Club
            </button>
            <button type="button" onClick={() => goTo('/create-club')} className="flex-1 btn-ghost py-2.5 text-sm">
              Create a Club
            </button>
          </div>
        )}

        <div className="flex items-center justify-center gap-1.5 mb-5">
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === step ? 'w-6 bg-red-500' : 'w-1.5 bg-white/[0.12]'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={onClose} className="text-xs text-zinc-400 hover:text-white transition-colors">
            Skip for now
          </button>
          <button
            type="button"
            onClick={() => (isLast ? onClose() : setStep((s) => s + 1))}
            className="btn-primary px-5 py-2 text-sm flex items-center gap-1.5"
          >
            {isLast ? 'Get Started' : 'Next'} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default OnboardingModal;
