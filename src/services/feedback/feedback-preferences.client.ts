export type FeedbackSettings = {
  soundEnabled: boolean;
  hapticEnabled: boolean;
};

export const DEFAULT_FEEDBACK_SETTINGS: FeedbackSettings = {
  soundEnabled: true,
  hapticEnabled: true,
};

const STORAGE_KEY = "sat-tutor-feedback-settings";
const EVENT_NAME = "sat-tutor-feedback-settings-changed";

function normalizeSettings(value: unknown): FeedbackSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_FEEDBACK_SETTINGS;
  }

  const candidate = value as Partial<FeedbackSettings>;

  return {
    soundEnabled:
      typeof candidate.soundEnabled === "boolean"
        ? candidate.soundEnabled
        : DEFAULT_FEEDBACK_SETTINGS.soundEnabled,
    hapticEnabled:
      typeof candidate.hapticEnabled === "boolean"
        ? candidate.hapticEnabled
        : DEFAULT_FEEDBACK_SETTINGS.hapticEnabled,
  };
}

export function readFeedbackSettings(): FeedbackSettings {
  if (typeof window === "undefined") {
    return DEFAULT_FEEDBACK_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeSettings(JSON.parse(raw)) : DEFAULT_FEEDBACK_SETTINGS;
  } catch {
    return DEFAULT_FEEDBACK_SETTINGS;
  }
}

export function writeFeedbackSettings(next: FeedbackSettings) {
  if (typeof window === "undefined") {
    return next;
  }

  const normalized = normalizeSettings(next);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, {
        detail: normalized,
      })
    );
  } catch {
    return normalized;
  }

  return normalized;
}

export function updateFeedbackSettings(patch: Partial<FeedbackSettings>) {
  const current = readFeedbackSettings();
  return writeFeedbackSettings({
    ...current,
    ...patch,
  });
}

export function subscribeToFeedbackSettings(
  callback: (settings: FeedbackSettings) => void
) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key && event.key !== STORAGE_KEY) {
      return;
    }

    callback(readFeedbackSettings());
  };

  const handleCustomEvent = (event: Event) => {
    const detail = (event as CustomEvent<FeedbackSettings>).detail;
    callback(normalizeSettings(detail));
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(EVENT_NAME, handleCustomEvent);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(EVENT_NAME, handleCustomEvent);
  };
}
