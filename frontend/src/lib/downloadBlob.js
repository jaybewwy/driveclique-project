/**
 * Trigger a browser save of an axios blob response (UC-33's .ics export).
 * Not a plain `<a href>` — that can't carry the Authorization header this
 * app authenticates with (no cookies), so the file has to be fetched via
 * axios first and handed to the browser as an object URL.
 */
export const downloadBlobResponse = (response, fallbackFilename) => {
  const disposition = response.headers?.['content-disposition'] || '';
  const match = disposition.match(/filename="?([^";]+)"?/);
  const filename = match ? match[1] : fallbackFilename;

  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
