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

export type SyncFolderReviewCounts = {
  ready: number;
  risk: number;
  stale: number;
  blocked: number;
  checkpointRisk: number;
  invalid: number;
};

export type SyncFolderAssistedPreviewDecision =
  | {
      kind: 'auto-preview';
      candidate: SyncFolderPacketReview;
      counts: SyncFolderReviewCounts;
    }
  | {
      kind: 'choose';
      counts: SyncFolderReviewCounts;
    }
  | {
      kind: 'no-action';
      counts: SyncFolderReviewCounts;
    };

export function isBlockedSyncFolderPacketReview(review: SyncFolderPacketReview) {
  return review.status === 'blocked' || review.status === 'checkpoint-risk' || review.status === 'invalid';
}

export function countSyncFolderPacketReviews(reviews: SyncFolderPacketReview[]): SyncFolderReviewCounts {
  return reviews.reduce<SyncFolderReviewCounts>(
    (counts, review) => {
      if (review.status === 'checkpoint-risk') {
        counts.checkpointRisk += 1;
      } else {
        counts[review.status] += 1;
      }

      return counts;
    },
    {
      ready: 0,
      risk: 0,
      stale: 0,
      blocked: 0,
      checkpointRisk: 0,
      invalid: 0,
    },
  );
}

export function chooseAssistedSyncFolderPreview(
  reviews: SyncFolderPacketReview[],
): SyncFolderAssistedPreviewDecision {
  const counts = countSyncFolderPacketReviews(reviews);
  const readyReviews = reviews.filter((review) => review.status === 'ready');
  const unsafeCount = counts.risk + counts.blocked + counts.checkpointRisk + counts.invalid;

  if (readyReviews.length === 1 && unsafeCount === 0) {
    return {
      kind: 'auto-preview',
      candidate: readyReviews[0],
      counts,
    };
  }

  if (readyReviews.length > 0 || counts.risk > 0) {
    return {
      kind: 'choose',
      counts,
    };
  }

  return {
    kind: 'no-action',
    counts,
  };
}
