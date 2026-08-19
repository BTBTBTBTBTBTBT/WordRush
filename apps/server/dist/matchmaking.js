"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchmakingQueue = void 0;
/**
 * Public matchmaking queue, bucketed by (mode, dailySeed-or-random).
 *
 * Daily-VS players must only pair with other daily players on the SAME seed
 * (same local calendar day), and random players only with random players —
 * otherwise an iOS daily player and a web random player in the same mode
 * could be spliced together with mismatched puzzles (the old behaviour:
 * queues were keyed by mode alone and `findMatch` paired the first two
 * entries regardless of seed).
 */
class MatchmakingQueue {
    constructor() {
        this.queues = new Map();
    }
    key(mode, dailySeed) {
        return `${mode}:${dailySeed ?? 'random'}`;
    }
    bucket(mode, dailySeed) {
        const k = this.key(mode, dailySeed);
        let q = this.queues.get(k);
        if (!q) {
            q = [];
            this.queues.set(k, q);
        }
        // Prune entries whose sockets went away without a clean leave_queue,
        // so a stale ghost can't absorb one side of a real pairing.
        const cutoff = Date.now() - MatchmakingQueue.STALE_MS;
        for (let i = q.length - 1; i >= 0; i--) {
            if (q[i].joinedAt < cutoff)
                q.splice(i, 1);
        }
        return q;
    }
    addToQueue(player, mode, dailySeed) {
        const queue = this.bucket(mode, dailySeed);
        const existing = queue.findIndex(e => e.player.id === player.id);
        if (existing !== -1) {
            return existing;
        }
        // Drop any stale entry from the same PERSON (reconnect → new socket, so a
        // new playerId): their ghost's socket is gone, and a third player pairing
        // against it would land in a dead match.
        if (player.presence != null) {
            const ghost = queue.findIndex(e => e.player.presence === player.presence);
            if (ghost !== -1)
                queue.splice(ghost, 1);
        }
        queue.push({
            player,
            mode,
            joinedAt: Date.now(),
            dailySeed,
        });
        return queue.length - 1;
    }
    removeFromQueue(playerId) {
        for (const queue of this.queues.values()) {
            const index = queue.findIndex(e => e.player.id === playerId);
            if (index !== -1) {
                queue.splice(index, 1);
                return;
            }
        }
    }
    findMatch(mode, dailySeed) {
        const queue = this.bucket(mode, dailySeed);
        if (queue.length < 2) {
            return null;
        }
        // Never pair two entries belonging to the same person (same handshake
        // presence id) — two tabs / a reconnected socket used to get matched
        // against themselves. Take the earliest compatible pair.
        for (let i = 0; i < queue.length - 1; i++) {
            for (let j = i + 1; j < queue.length; j++) {
                const a = queue[i];
                const b = queue[j];
                if (a.player.presence != null && a.player.presence === b.player.presence)
                    continue;
                queue.splice(j, 1); // j > i, so remove j first to keep i stable
                queue.splice(i, 1);
                return [a, b];
            }
        }
        return null;
    }
    getPosition(playerId, mode, dailySeed) {
        return this.bucket(mode, dailySeed).findIndex(e => e.player.id === playerId);
    }
    getQueueSize(mode, dailySeed) {
        return this.bucket(mode, dailySeed).length;
    }
    /** Temporary diagnostic: dump non-empty buckets and their waiting players. */
    snapshot() {
        const out = {};
        for (const [k, q] of this.queues) {
            if (q.length)
                out[k] = q.map(e => ({ playerId: e.player.id, joinedAt: e.joinedAt }));
        }
        return out;
    }
}
exports.MatchmakingQueue = MatchmakingQueue;
/** Entries older than this are dropped on the next queue touch. */
MatchmakingQueue.STALE_MS = 10 * 60 * 1000;
