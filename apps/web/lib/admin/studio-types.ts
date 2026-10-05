import type { AccountStatus } from './studio-db';
import type { Reviewer, SocialPost, SocialReview, SocialTarget } from './studio';

/** GET /api/admin/studio. Tokens never appear here: accounts carry status only. */
export interface StudioPayload {
  posts: SocialPost[];
  targets: SocialTarget[];
  reviews: SocialReview[];
  reviewers: Reviewer[];
  me: string | null;
  paused: boolean;
  accounts: AccountStatus[];
  /** media path -> URL the browser can show (signed for bucket objects). */
  urls: Record<string, string>;
  /** tracked-link slug -> clicks / signups. */
  links: Record<string, { clicks: number; signups: number }>;
  /** Open feedback on these posts (what Claude reads in the next drafting pass). */
  feedback: Array<{ id: string; post_id: string | null; author: string | null; body: string; created_at: string }>;
  fixture?: boolean;
}
