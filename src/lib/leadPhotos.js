export function getPhotoUrls(value) {
  const entries = Array.isArray(value) ? value : [value];
  const urls = new Set();
  for (const entry of entries) {
    if (typeof entry !== 'string') continue;
    for (const candidate of entry.split(/[,\s]+(?=https:\/\/)/i)) {
      try {
        const url = new URL(candidate.trim());
        if (url.origin === 'https://2cbbtu0mnx.ucarecd.net' && !url.username && !url.password) {
          urls.add(url.href);
        }
      } catch {
        // Ignore empty or invalid values.
      }
    }
  }
  return [...urls];
}

export function isPhotosField(field) {
  return [field.name, field.label].some(key => key?.trim().toLowerCase() === 'photos');
}
