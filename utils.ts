
export const toDateTimeLocal = (isoString: string | undefined) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return ''; // Check validity
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  try {
    return date.toISOString().slice(0, 16);
  } catch (e) {
    return '';
  }
};

export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};
