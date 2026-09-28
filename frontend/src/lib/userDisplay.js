/**
 * The name to show for a user: their display name when they've opted into
 * showing it (and set one), otherwise their username.
 */
export const displayName = (user) =>
  user?.useDisplayName && user?.name ? user.name : user?.username;

/** A populated user/club reference or a bare id, as a string ('' if absent) */
export const idOf = (ref) => ref?._id?.toString() || ref?.toString() || '';
