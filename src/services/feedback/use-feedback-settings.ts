"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_FEEDBACK_SETTINGS,
  readFeedbackSettings,
  subscribeToFeedbackSettings,
  updateFeedbackSettings,
  type FeedbackSettings,
} from "./feedback-preferences.client";

export function useFeedbackSettings() {
  const [settings, setSettings] = useState<FeedbackSettings>(DEFAULT_FEEDBACK_SETTINGS);

  useEffect(() => {
    setSettings(readFeedbackSettings());
    return subscribeToFeedbackSettings(setSettings);
  }, []);

  return {
    settings,
    updateSettings: (patch: Partial<FeedbackSettings>) => updateFeedbackSettings(patch),
  };
}
