import type { SyncPacketCheckpointStatus } from './sync';
import type { SyncFolderPacketFile } from './storage';

export type SyncFolderPacketReviewStatus =
  | 'ready'
  | 'risk'
  | 'stale'
  | 'blocked'
  | 'checkpoint-risk'
  | 'invalid';

export type SyncFolderPacketReview = SyncFolderPacketFile & {
  status: SyncFolderPacketReviewStatus;
  reason: string;
  sourceDeviceId?: string;
  sourceDeviceName?: string;
  createdAt?: string;
  records?: number;
  destructiveChanges?: number;
  timestampTies?: number;
  checkpointStatus?: SyncPacketCheckpointStatus;
};

export function isBlockedSyncFolderPacketReview(review: SyncFolderPacketReview) {
  return review.status === 'blocked' || review.status === 'checkpoint-risk' || review.status === 'invalid';
}
