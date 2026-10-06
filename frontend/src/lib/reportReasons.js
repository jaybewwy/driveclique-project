// Why something was reported. Values must match REPORT_REASONS in
// backend/models/report.js.
export const REPORT_REASONS = [
  { value: 'harassment', label: 'Harassment or hate speech' },
  { value: 'spam',       label: 'Spam or fake content' },
  { value: 'dangerous',  label: 'Dangerous or illegal activity' },
  { value: 'other',      label: 'Other' },
];

export const reportReasonLabel = (value) =>
  REPORT_REASONS.find((reason) => reason.value === value)?.label || value;
