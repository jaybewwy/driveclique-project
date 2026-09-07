import { useState } from "react";
import { Plus, X, Trash2 } from "lucide-react";
import { clubsAPI } from "../../services/api";

const AnnouncementsSection = ({ clubId, announcements, setAnnouncements, canModerate }) => {
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({ title: '', body: '' });
  const [announcementError, setAnnouncementError] = useState('');
  const [isPostingAnnouncement, setIsPostingAnnouncement] = useState(null); // announcementId being deleted, or 'posting'

  const handlePostAnnouncement = async () => {
    if (!announcementForm.body.trim()) {
      setAnnouncementError('Announcement cannot be empty.');
      return;
    }
    setIsPostingAnnouncement('posting');
    try {
      const res = await clubsAPI.postAnnouncement(clubId, {
        title: announcementForm.title.trim(),
        body: announcementForm.body.trim()
      });
      if (res.data?.success) {
        setAnnouncements(prev => [res.data.announcement, ...prev]);
        setAnnouncementForm({ title: '', body: '' });
        setShowAnnouncementForm(false);
      }
    } catch {
      setAnnouncementError('Failed to post announcement. Please try again.');
    } finally {
      setIsPostingAnnouncement(null);
    }
  };

  const handleDeleteAnnouncement = async (announcementId) => {
    setIsPostingAnnouncement(announcementId);
    setAnnouncementError('');
    try {
      await clubsAPI.deleteAnnouncement(clubId, announcementId);
      setAnnouncements(prev => prev.filter(x => x._id !== announcementId));
    } catch (error) {
      setAnnouncementError(error.response?.data?.message || 'Failed to delete announcement. Please try again.');
    } finally {
      setIsPostingAnnouncement(null);
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold">Announcements</h3>
            <p className="text-xs text-zinc-400">Updates from the club leader</p>
          </div>
        </div>
        {canModerate && (
          <button
            onClick={() => { setShowAnnouncementForm(v => !v); setAnnouncementError(''); }}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-xl text-sm font-medium transition"
          >
            {showAnnouncementForm ? <X size={15} /> : <Plus size={15} />}
            {showAnnouncementForm ? 'Cancel' : 'Post Announcement'}
          </button>
        )}
      </div>

      {/* Post Announcement Form */}
      {canModerate && showAnnouncementForm && (
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5 mb-4">
          <div className="space-y-3">
            <input
              type="text"
              placeholder=""
              value={announcementForm.title}
              maxLength={100}
              onChange={e => setAnnouncementForm(f => ({ ...f, title: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition"
            />
            <div className="relative">
              <textarea
                placeholder=""
                value={announcementForm.body}
                maxLength={1000}
                rows={4}
                onChange={e => { setAnnouncementForm(f => ({ ...f, body: e.target.value })); setAnnouncementError(''); }}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition resize-none"
              />
              <span className="absolute bottom-2 right-3 text-xs text-zinc-400">{announcementForm.body.length}/1000</span>
            </div>
            {announcementError && <p className="text-red-400 text-sm">{announcementError}</p>}
            <div className="flex justify-end">
              <button
                disabled={isPostingAnnouncement === 'posting'}
                onClick={handlePostAnnouncement}
                className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 px-6 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPostingAnnouncement === 'posting' ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Announcement Cards */}
      {announcementError && !showAnnouncementForm && (
        <p className="text-red-400 text-sm mb-3">{announcementError}</p>
      )}
      {announcements.length === 0 ? (
        <div className="bg-zinc-900/30 border border-zinc-800/30 rounded-2xl p-6 text-center">
          <p className="text-zinc-400 text-sm">No announcements yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div key={a._id} className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5 transition-all duration-300 hover:border-zinc-700/50">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {a.title && <p className="font-semibold text-white mb-1">{a.title}</p>}
                  <p className="text-zinc-300 text-sm whitespace-pre-wrap break-words">{a.body}</p>
                  <p className="text-zinc-400 text-xs mt-2">
                    {new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    {' · '}
                    {new Date(a.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
                {canModerate && (
                  <button
                    disabled={isPostingAnnouncement === a._id}
                    onClick={() => handleDeleteAnnouncement(a._id)}
                    className="text-zinc-400 hover:text-red-400 transition flex-shrink-0 disabled:opacity-40"
                    title="Delete announcement"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AnnouncementsSection;
