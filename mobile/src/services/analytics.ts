import { getApp } from '@react-native-firebase/app';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';

export type ProductEventName =
  | 'collector_sign_in'
  | 'collector_sign_out'
  | 'draft_created'
  | 'draft_resumed'
  | 'submission_attempted'
  | 'submission_synced'
  | 'submission_failed'
  | 'correction_opened'
  | 'correction_resubmitted';

export type ProductScreenName =
  | 'sign_in'
  | 'home'
  | 'account'
  | 'site'
  | 'visit'
  | 'method'
  | 'measurements'
  | 'review'
  | 'submission_detail'
  | 'revision_detail';

export async function trackProductEvent(name: ProductEventName): Promise<void> {
  try {
    await logEvent(getAnalytics(getApp()), name);
  } catch {
    // Analytics must never block field collection.
  }
}

export async function trackScreenView(screen: ProductScreenName): Promise<void> {
  try {
    await logEvent(getAnalytics(getApp()), 'screen_viewed', { screen_name: screen });
  } catch {
    // Analytics must never block field collection.
  }
}
