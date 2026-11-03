import Redis from 'ioredis';
import { EventEmitter } from 'events';

export const localPubSub = new EventEmitter();

export class RedisPublisher {
  private client: Redis;

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      retryStrategy() {
        return null;
      }
    });

    this.client.on('error', () => {
      // Chặn Unhandled error event
    });
  }

  public publishDepthUpdate(symbol: string, depthData: any) {
    const channel = `orderbook:${symbol}`;
    const payload = JSON.stringify({ type: 'DEPTH_UPDATE', data: depthData });

    if (this.client.status === 'ready') {
      this.client.publish(channel, payload);
    } else {
      localPubSub.emit('message', channel, payload);
    }
  }

  public publishTrades(symbol: string, trades: any[]) {
    if (trades.length === 0) return;
    const channel = `trades:${symbol}`;
    const payload = JSON.stringify({ type: 'NEW_TRADES', data: trades });

    if (this.client.status === 'ready') {
      this.client.publish(channel, payload);
    } else {
      localPubSub.emit('message', channel, payload);
    }
  }
}