import { useState } from 'react';
import { X, Flag, AlertTriangle, CheckCircle } from 'lucide-react';
import { reportsAPI } from '../../services/api';

const REASONS = [
  { value: 'harassment', label: 'Harassment or hate speech' },
  { value: 'spam',       label: 'Spam or fake content' },
  { value: 'dangerous',  label: 'Dangerous or illegal activity' },
  { value: 'other',      label: 'Other' },
];

/**
 * ReportModal — reusable report dialog.
 *
 * Props:
 *   targetType  'user' | 'club' | 'drive'
 *   targetId    MongoDB ObjectId string
 *   targetName  Display name shown in the modal title
 *   onClose     Called when the modal should be dismissed
 */
const ReportModal = ({ targetType, targetId, targetName, onClose }) => {
  const [reason,  setReason]  = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason) { setError('Please select a reason.'); return; }
    setLoading(true);
    setError('');
    try {
      await reportsAPI.submit({ targetType, targetId, reason, details });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative glass-card w-full max-w-md p-6 rounded-3xl animate-fade-slide-up">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-500/15 border border-red-500/25 rounded-xl flex items-center justify-center shrink-0">
              <Flag className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Report Content</h2>
              <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-[220px]">{targetName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.07] rounded-lg transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success state */}
        {success ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-green-500/15 border border-green-500/25 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-green-400" />
            </div>
            <p className="text-white font-semibold mb-1">Report submitted</p>
            <p className="text-zinc-500 text-sm">Thank you — we'll review this content.</p>
            <button
              onClick={onClose}
              className="mt-5 btn-ghost px-5 py-2 text-sm"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Reason selector */}
            <div className="mb-4">
              <p className="section-label mb-3">Reason</p>
              <div className="space-y-2">
                {REASONS.map(({ value, label }) => (
                  <label
                    key={value}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150 ${
                      reason === value
                        ? 'bg-red-500/10 border-red-500/30 text-white'
                        : 'bg-white/[0.03] border-white/[0.07] text-zinc-400 hover:border-white/[0.12] hover:text-zinc-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={value}
                      checked={reason === value}
                      onChange={() => setReason(value)}
                      className="sr-only"
                    />
                    <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 transition-all ${
                      reason === value ? 'border-red-500 bg-red-500' : 'border-zinc-600'
                    }`} />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Optional details */}
            <div className="mb-5">
              <p className="section-label mb-2">Additional details <span className="normal-case font-normal text-zinc-600">(optional)</span></p>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Describe the issue…"
                className="w-full bg-white/[0.06] border border-white/[0.08] rounded-2xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 resize-none focus:outline-none focus:border-red-500/40 focus:ring-1 focus:ring-red-500/15 transition-all"
              />
              <p className="text-[11px] text-zinc-600 mt-1 text-right">{details.length}/500</p>
            </div>

            {/* Disclaimer */}
            <div className="flex items-start gap-2 p-3 bg-amber-500/8 border border-amber-500/20 rounded-xl mb-5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-400/80 leading-relaxed">
                False reports may result in action against your account. Only report content that genuinely violates community guidelines.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2.5">
              <button type="button" onClick={onClose} className="flex-1 btn-ghost py-2.5 text-sm">
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !reason}
                className="flex-1 bg-gradient-to-r from-red-600 to-red-500 text-white font-semibold py-2.5 rounded-2xl text-sm shadow-lg shadow-red-500/20 hover:shadow-red-500/35 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> Submitting…</>
                ) : (
                  <><Flag className="w-3.5 h-3.5" /> Submit Report</>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ReportModal;
