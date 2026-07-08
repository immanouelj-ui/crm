export function isMobileDevice() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768;
}

export function triggerCall(number, contactId) {
  if (!number) return;
  if (isMobileDevice()) {
    window.location.href = `tel:${number}`;
  } else {
    window.dispatchEvent(new CustomEvent('crm:call-number', { detail: { number, contactId } }));
  }
}
