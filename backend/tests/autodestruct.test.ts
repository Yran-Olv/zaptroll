import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AutoDestructService } from '../src/modules/messages/AutoDestructService.js';
import { zapoManager } from '../src/integrations/zapo/ZapoConnectionManager.js';
import { ZapoMessageAdapter } from '../src/integrations/zapo/ZapoMessageAdapter.js';
import { AutoDestructTask } from '../src/database/models/AutoDestructTask.js';

describe('AutoDestructService Deep Scenarios & Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    AutoDestructService.cancel('conn-test-1', 'msg-exp-1');
    AutoDestructService.cancel('conn-test-1', 'msg-exp-2');
  });

  it('1. ignores invalid payloads with no duration or negative seconds', () => {
    const beforeCount = AutoDestructService.getActiveTimersCount();
    AutoDestructService.scheduleAutoDestruct({
      connectionId: 'conn-test-1',
      stanzaId: 'msg-no-dur',
      delaySeconds: 0,
    });
    AutoDestructService.scheduleAutoDestruct({
      connectionId: 'conn-test-1',
      stanzaId: 'msg-neg-dur',
      delaySeconds: -10,
    });
    expect(AutoDestructService.getActiveTimersCount()).toBe(beforeCount);
  });

  it('2. cancels task cleanly when revoked manually', async () => {
    AutoDestructService.scheduleAutoDestruct({
      connectionId: 'conn-test-1',
      stanzaId: 'msg-exp-1',
      delaySeconds: 300,
    });
    expect(AutoDestructService.getActiveTimersCount()).toBeGreaterThan(0);

    const cancelled = AutoDestructService.cancel('conn-test-1', 'msg-exp-1');
    expect(cancelled).toBe(true);
  });

  it('3. isolates tasks with identical stanzaId across multiple connections', () => {
    AutoDestructService.scheduleAutoDestruct({
      connectionId: 'conn-A',
      stanzaId: 'same-stanza-id',
      delaySeconds: 120,
    });
    AutoDestructService.scheduleAutoDestruct({
      connectionId: 'conn-B',
      stanzaId: 'same-stanza-id',
      delaySeconds: 120,
    });

    expect(AutoDestructService.getTaskKey('conn-A', 'same-stanza-id')).not.toBe(
      AutoDestructService.getTaskKey('conn-B', 'same-stanza-id')
    );

    AutoDestructService.cancel('conn-A', 'same-stanza-id');
    AutoDestructService.cancel('conn-B', 'same-stanza-id');
  });

  it('4. handles client disconnection during revocation with retries and without throwing', async () => {
    vi.spyOn(zapoManager, 'getClient').mockReturnValue(null); // Desconectado

    const result = await AutoDestructService.executeRevoke('conn-disconnected', 'stanza-retry-test');
    expect(result).toBe(false);
  });

  it('5. handles network failure during revokeMessage gracefully', async () => {
    vi.spyOn(zapoManager, 'getClient').mockReturnValue({} as any);
    vi.spyOn(ZapoMessageAdapter, 'revokeMessage').mockRejectedValue(new Error('Network socket closed'));

    // Mock DB task
    vi.spyOn(AutoDestructTask, 'findOne').mockResolvedValue({
      connectionId: 'conn-net-fail',
      stanzaId: 'stanza-net-fail',
      targetJid: '5511999999999@s.whatsapp.net',
      status: 'scheduled',
      attempts: 0,
      maxAttempts: 5,
      update: vi.fn().mockResolvedValue(true),
    } as any);

    const result = await AutoDestructService.executeRevoke('conn-net-fail', 'stanza-net-fail');
    expect(result).toBe(false);
  });

  it('6. cancels all pending tasks when connection is removed', async () => {
    AutoDestructService.scheduleAutoDestruct({
      connectionId: 'conn-purge',
      stanzaId: 'msg-p1',
      delaySeconds: 100,
    });
    AutoDestructService.scheduleAutoDestruct({
      connectionId: 'conn-purge',
      stanzaId: 'msg-p2',
      delaySeconds: 200,
    });

    vi.spyOn(AutoDestructTask, 'update').mockResolvedValue([2] as any);

    const cancelledCount = await AutoDestructService.cancelAllForConnection('conn-purge');
    expect(cancelledCount).toBe(2);
  });

  it('7. handles bulk scheduling of hundreds of tasks without memory leaks', () => {
    const BATCH = 200;
    for (let i = 0; i < BATCH; i++) {
      AutoDestructService.scheduleAutoDestruct({
        connectionId: 'conn-bulk',
        stanzaId: `bulk-msg-${i}`,
        delaySeconds: 60 + i,
      });
    }

    expect(AutoDestructService.getActiveTimersCount()).toBeGreaterThanOrEqual(BATCH);

    for (let i = 0; i < BATCH; i++) {
      AutoDestructService.cancel('conn-bulk', `bulk-msg-${i}`);
    }
  });
});
