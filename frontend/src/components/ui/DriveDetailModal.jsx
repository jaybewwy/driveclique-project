import { useNavigate } from "react-router-dom";
import { X, Calendar, Clock, MapPin, Navigation, CheckCircle, CalendarDays, ChevronDown, Star } from "lucide-react";
import { DriveMapPreview } from "./drive-map-preview";

// Purely presentational: all state (RSVP, check-in, attendees, rating) and every handler
// stay owned by ClubDetail.jsx, since `selectedDrive` is also shared with the separate
// Edit Drive modal there and the RSVP/rating data is pre-fetched by ClubDetail.jsx's
// handleDriveClick *before* this modal ever mounts (so there's no loading flash to manage
// here). This component only renders what it's given and reports interactions back up.
const DriveDetailModal = ({ drive, isMember, isLeader, onClose, rsvp, checkin, attendees, rating }) => {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="drive-detail-modal-title" tabIndex={-1} className="bg-zinc-900 rounded-3xl p-8 max-w-lg w-full border border-zinc-800 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 id="drive-detail-modal-title" className="text-2xl font-bold">{drive.name}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss drive details panel"
            className="text-zinc-400 hover:text-white transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Drive Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-zinc-300">
              <Calendar size={18} className="text-red-500" />
              <span>
                {new Date(drive.date).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>

            {drive.time && (
              <div className="flex items-center gap-3 text-zinc-300">
                <Clock size={18} className="text-red-500" />
                <span>{drive.time}</span>
              </div>
            )}

            {drive.location && (
              <div className="flex items-center gap-3 text-zinc-300">
                <MapPin size={18} className="text-red-500" />
                <span>{drive.location}</span>
              </div>
            )}
          </div>

          {drive.coordinates?.lat && (
            <div className="space-y-2">
              <DriveMapPreview lat={drive.coordinates.lat} lng={drive.coordinates.lng} />
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${drive.coordinates.lat},${drive.coordinates.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 py-2.5 rounded-xl text-sm font-medium transition"
              >
                <Navigation size={16} /> Get Directions
              </a>
            </div>
          )}

          {drive.image && (
            <img
              src={drive.image}
              alt="Drive route"
              className="w-full h-40 object-cover rounded-xl border border-zinc-800"
            />
          )}

          {drive.description && (
            <div className="bg-black rounded-xl p-4">
              <h3 className="text-sm font-medium text-zinc-400 mb-2">Description</h3>
              <p className="text-zinc-300 text-sm whitespace-pre-wrap">{drive.description}</p>
            </div>
          )}

          {/* RSVP Section - Members and leaders only */}
          {new Date(drive.date) >= new Date() && !drive.isCompleted && (
            <div className="border-t border-zinc-700 pt-6">
              {!(isMember || isLeader) ? (
                <p className="text-sm text-zinc-400 text-center py-2">
                  Join this club to RSVP to drives.
                </p>
              ) : (
                <>
                  <h3 className="text-lg font-semibold mb-4">
                    {isLeader ? 'Mark your attendance' : 'Are you going?'}
                  </h3>

                  {/* State 1 — user is on the waitlist */}
                  {rsvp.status === 'waitlisted' ? (
                    <div className="mb-4 bg-amber-900/20 border border-amber-600/40 rounded-2xl p-4 text-center">
                      <Clock className="w-5 h-5 text-amber-400 mx-auto mb-2" />
                      <p className="text-amber-400 font-semibold">You are #{rsvp.waitlistPosition} on the waitlist</p>
                      <p className="text-xs text-zinc-400 mt-1">You'll be automatically confirmed when a spot opens up</p>
                      <button
                        type="button"
                        onClick={() => rsvp.onSubmit('not-going')}
                        disabled={rsvp.isLoading}
                        className="mt-3 text-sm text-zinc-400 hover:text-red-400 transition disabled:opacity-50"
                      >
                        Leave Waitlist
                      </button>
                    </div>
                  ) : (
                    /* State 2 (drive full) or State 3 (normal) */
                    <div className="flex gap-3 mb-4">
                      {/* Going — or Join Waitlist when drive is at capacity */}
                      {rsvp.counts.going >= (drive?.maxAttendees ?? Infinity) && rsvp.status !== 'going' ? (
                        <button
                          type="button"
                          onClick={() => rsvp.onSubmit('going')}
                          disabled={rsvp.isLoading}
                          className="flex-1 py-3 rounded-2xl font-medium transition flex items-center justify-center gap-2 bg-zinc-800 hover:bg-amber-900/30 text-white hover:text-amber-400 border border-zinc-700 hover:border-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Clock size={18} />
                          Join Waitlist
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => rsvp.onSubmit('going')}
                          disabled={rsvp.isLoading}
                          className={`flex-1 py-3 rounded-2xl font-medium transition flex items-center justify-center gap-2 ${
                            rsvp.status === 'going'
                              ? 'bg-green-600 text-white'
                              : 'bg-zinc-800 hover:bg-green-900/30 text-white hover:text-green-400 border border-zinc-700 hover:border-green-600'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          <CheckCircle size={18} />
                          Going
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => rsvp.onSubmit('maybe')}
                        disabled={rsvp.isLoading}
                        className={`flex-1 py-3 rounded-2xl font-medium transition flex items-center justify-center gap-2 ${
                          rsvp.status === 'maybe'
                            ? 'bg-yellow-600 text-white'
                            : 'bg-zinc-800 hover:bg-yellow-900/30 text-white hover:text-yellow-400 border border-zinc-700 hover:border-yellow-600'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <CalendarDays size={18} />
                        Maybe
                      </button>
                      <button
                        type="button"
                        onClick={() => rsvp.onSubmit('not-going')}
                        disabled={rsvp.isLoading}
                        className={`flex-1 py-3 rounded-2xl font-medium transition flex items-center justify-center gap-2 ${
                          rsvp.status === 'not-going'
                            ? 'bg-red-600 text-white'
                            : 'bg-zinc-800 hover:bg-red-900/30 text-white hover:text-red-400 border border-zinc-700 hover:border-red-600'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <X size={18} />
                        Not Going
                      </button>
                    </div>
                  )}

                  {/* RSVP Message */}
                  {rsvp.message && (
                    <div className="mb-4 p-3 bg-green-900/30 border border-green-600 rounded-xl">
                      <p className="text-green-400 text-sm text-center">{rsvp.message}</p>
                    </div>
                  )}

                  {/* RSVP Counts */}
                  <div className="border-t border-zinc-700/50 pt-4">
                    <h4 className="text-sm font-semibold mb-3 text-zinc-400">
                      {isLeader ? 'RSVP Summary' : 'Current RSVPs'}
                    </h4>
                    <div className="flex gap-4">
                      <div className="flex-1 bg-black rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-green-400">{rsvp.counts.going}</p>
                        <p className="text-xs text-zinc-400">Going</p>
                      </div>
                      <div className="flex-1 bg-black rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-yellow-400">{rsvp.counts.maybe}</p>
                        <p className="text-xs text-zinc-400">Maybe</p>
                      </div>
                      <div className="flex-1 bg-black rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-red-400">{rsvp.counts.notGoing}</p>
                        <p className="text-xs text-zinc-400">Not Going</p>
                      </div>
                      {rsvp.counts.waitlisted > 0 && (
                        <div className="flex-1 bg-black rounded-xl p-3 text-center">
                          <p className="text-2xl font-bold text-amber-400">{rsvp.counts.waitlisted}</p>
                          <p className="text-xs text-zinc-400">Waitlisted</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Attendee List (leader-only) — the full per-member breakdown behind the counts above */}
                  {isLeader && (
                    <div className="border-t border-zinc-700/50 pt-4 mt-4">
                      <button
                        type="button"
                        onClick={attendees.onToggle}
                        aria-expanded={attendees.show}
                        className="w-full flex items-center justify-between text-sm font-semibold text-zinc-400 hover:text-white transition"
                      >
                        <span>Attendee List</span>
                        <ChevronDown
                          size={16}
                          className={`transition-transform ${attendees.show ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {attendees.show && (
                        <div className="mt-3">
                          {attendees.isLoading && (
                            <p className="text-sm text-zinc-400 text-center py-2">Loading attendees...</p>
                          )}
                          {attendees.error && (
                            <p className="text-sm text-red-400 text-center py-2">{attendees.error}</p>
                          )}
                          {attendees.data && (
                            attendees.data.rsvps.length === 0 ? (
                              <p className="text-sm text-zinc-400 text-center py-2">No RSVPs yet.</p>
                            ) : (
                              <div className="space-y-2 max-h-64 overflow-y-auto">
                                {attendees.data.rsvps.map((attendeeRsvp) => (
                                  <div
                                    key={attendeeRsvp._id}
                                    className="flex items-center justify-between bg-black rounded-xl px-3 py-2"
                                  >
                                    <span className="text-sm text-white truncate">
                                      {attendeeRsvp.user?.username || 'Unknown member'}
                                    </span>
                                    <span
                                      className={`text-xs font-medium uppercase tracking-wide whitespace-nowrap ml-3 ${
                                        attendeeRsvp.status === 'going'
                                          ? 'text-green-400'
                                          : attendeeRsvp.status === 'maybe'
                                          ? 'text-yellow-400'
                                          : attendeeRsvp.status === 'waitlisted'
                                          ? 'text-amber-400'
                                          : 'text-red-400'
                                      }`}
                                    >
                                      {attendeeRsvp.status.replace('-', ' ')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Check-In Section (UC-08) — optional; leader can send/resend anytime, members with a "going"
              RSVP can self check-in any time too (covers missed push notifications). Stays open until
              the leader marks the drive completed. */}
          {!drive.isCompleted && (isLeader || rsvp.status === 'going') && (
            <div className="border-t border-zinc-700 pt-6">
              {isLeader ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold">Drive Check-In</h3>
                    {rsvp.counts.going >= 40 && (
                      <span className="text-[11px] uppercase tracking-wide bg-sky-900/30 text-sky-400 border border-sky-700/40 rounded-full px-2 py-0.5">
                        Recommended for large groups
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-400 mb-4">
                    Optional — ask members who RSVPed "going" to confirm they showed up. Stays open until you mark this drive completed.
                  </p>
                  <button
                    type="button"
                    onClick={checkin.onSend}
                    disabled={checkin.isSending}
                    className="w-full bg-zinc-800 hover:bg-sky-900/30 text-white hover:text-sky-400 border border-zinc-700 hover:border-sky-600 py-3 rounded-2xl font-medium transition disabled:opacity-50 mb-4"
                  >
                    {checkin.isSending ? 'Sending...' : checkin.requestedAt ? 'Resend Check-In Notification' : 'Send Check-In Notification'}
                  </button>
                  {checkin.sentMessage && (
                    <p className="text-sm text-zinc-400 text-center mb-4">{checkin.sentMessage}</p>
                  )}
                  {checkin.requestedAt && (
                    <div className="flex gap-4">
                      <div className="flex-1 bg-black rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-green-400">{checkin.counts.present}</p>
                        <p className="text-xs text-zinc-400">Present</p>
                      </div>
                      <div className="flex-1 bg-black rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-zinc-400">{checkin.counts.notPresent}</p>
                        <p className="text-xs text-zinc-400">Not Present</p>
                      </div>
                      <div className="flex-1 bg-black rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold text-amber-400">{checkin.counts.pending}</p>
                        <p className="text-xs text-zinc-400">Pending</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate(`/drive/${drive._id}/checkin`)}
                  className="w-full bg-zinc-800 hover:bg-sky-900/30 text-white hover:text-sky-400 border border-zinc-700 hover:border-sky-600 py-3 rounded-2xl font-medium transition"
                >
                  Check In to This Drive
                </button>
              )}
            </div>
          )}

          {/* Rate this Drive (UC-25) — attendees can rate once the drive is completed;
              the average is visible to all club members. */}
          {drive.isCompleted && (
            <div className="border-t border-zinc-700 pt-6">
              <h3 className="text-lg font-semibold mb-3">Rate this Drive</h3>

              {rating.summary.count > 0 && (
                <div className="flex items-center gap-2 mb-4 text-zinc-300">
                  <Star size={18} className="text-yellow-400 fill-yellow-400" />
                  <span className="font-semibold">{rating.summary.average}</span>
                  <span className="text-xs text-zinc-400">
                    ({rating.summary.count} rating{rating.summary.count === 1 ? '' : 's'})
                  </span>
                </div>
              )}

              {rsvp.status === 'going' ? (
                <>
                  <div className="flex items-center gap-1 mb-4">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => rating.setStars(value)}
                        onMouseEnter={() => rating.setHoverStars(value)}
                        onMouseLeave={() => rating.setHoverStars(0)}
                        className="transition"
                      >
                        <Star
                          size={28}
                          className={
                            value <= (rating.hoverStars || rating.stars)
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-zinc-700'
                          }
                        />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={rating.comment}
                    onChange={(e) => rating.setComment(e.target.value.slice(0, 200))}
                    placeholder="Add an optional comment (max 200 characters)"
                    className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-sm text-zinc-300 resize-none mb-1"
                    rows={3}
                    maxLength={200}
                  />
                  <p className="text-xs text-zinc-400 text-right mb-4">{rating.comment.length}/200</p>
                  <button
                    type="button"
                    onClick={rating.onSubmit}
                    disabled={rating.isSubmitting || rating.stars === 0}
                    className="w-full bg-zinc-800 hover:bg-yellow-900/30 text-white hover:text-yellow-400 border border-zinc-700 hover:border-yellow-600 py-3 rounded-2xl font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {rating.isSubmitting ? 'Submitting...' : 'Submit Rating'}
                  </button>
                  {rating.message && (
                    <p className="text-sm text-zinc-400 text-center mt-3">{rating.message}</p>
                  )}
                </>
              ) : (
                rating.summary.count === 0 && (
                  <p className="text-sm text-zinc-400">No ratings yet for this drive.</p>
                )
              )}
            </div>
          )}

          <div className="pt-4">
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-zinc-800 hover:bg-zinc-700 py-3 rounded-2xl font-medium transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriveDetailModal;
