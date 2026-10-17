import type { QueryDocumentSnapshot, Timestamp } from 'firebase/firestore';
import type { QueueRow, SubmissionStatus } from './types';

export type QueueMode = 'review' | 'history';
export interface QueueScope {
  mode: QueueMode;
  siteId: string;
  collectorUid: string;
  status: SubmissionStatus | '';
}
export interface ReviewerDisplayProfile {
  uid: string;
  display_name: string;
  identity_verified: true;
  updated_at?: Timestamp;
}
export interface HistoryQueueRow extends QueueRow {
  collectorProfile: ReviewerDisplayProfile | null;
}
export interface QueuePage {
  rows: HistoryQueueRow[];
  cursor: QueryDocumentSnapshot | null;
  hasMore: boolean;
}
export interface QueueQueryOptions extends Partial<QueueScope> {
  cursor?: QueryDocumentSnapshot | null;
  pageSize?: number;
}
export type QueueSort = 'wait' | 'submitted-desc' | 'submitted-asc' | 'collected-desc' | 'collected-asc' | 'site' | 'collector' | 'quality';
export type QueueAttention = 'attention' | 'alerts' | 'clean';
export interface QueueFilters {
  query: string;
  watershed: string;
  stream: string;
  labStage: string;
  dateBasis: 'collected' | 'submitted';
  dateFrom: string;
  dateTo: string;
  attention: QueueAttention[];
}
