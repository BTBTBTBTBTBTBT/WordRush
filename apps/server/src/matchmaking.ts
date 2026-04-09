import { GameMode } from '@wordle-duel/core';
import { QueueEntry, Player } from './types';

export class MatchmakingQueue {
  private queues: Map<GameMode, QueueEntry[]> = new Map([
    [GameMode.DUEL, []],
    [GameMode.MULTI_DUEL, []],
    [GameMode.GAUNTLET, []],
    [GameMode.QUORDLE, []],
    [GameMode.OCTORDLE, []],
    [GameMode.SEQUENCE, []],
    [GameMode.RESCUE, []],
    [GameMode.TOURNAMENT, []],
    [GameMode.PROPERNOUNDLE, []]
  ]);

  addToQueue(player: Player, mode: GameMode): number {
    const queue = this.queues.get(mode)!;
    const existing = queue.findIndex(e => e.player.id === player.id);

    if (existing !== -1) {
      return existing;
    }

    queue.push({
      player,
      mode,
      joinedAt: Date.now()
    });

    return queue.length - 1;
  }

  removeFromQueue(playerId: string): void {
    for (const queue of this.queues.values()) {
      const index = queue.findIndex(e => e.player.id === playerId);
      if (index !== -1) {
        queue.splice(index, 1);
        return;
      }
    }
  }

  findMatch(mode: GameMode): [QueueEntry, QueueEntry] | null {
    const queue = this.queues.get(mode)!;

    if (queue.length < 2) {
      return null;
    }

    const [entry1, entry2] = queue.splice(0, 2);
    return [entry1, entry2];
  }

  getPosition(playerId: string, mode: GameMode): number {
    const queue = this.queues.get(mode)!;
    return queue.findIndex(e => e.player.id === playerId);
  }

  getQueueSize(mode: GameMode): number {
    return this.queues.get(mode)!.length;
  }
}
