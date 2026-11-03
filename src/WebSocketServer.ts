import { WebSocketServer as WSServer, WebSocket } from 'ws';
import Redis from 'ioredis';

export class RealtimeWSServer {
  public wss: WSServer; // Chuyển public để server.ts có thể truy cập nếu cần
  private redisSub: Redis;

  constructor(port: number) {
    this.wss = new WSServer({ port });
    
    // Cấu hình Redis Subscriber chống sập app khi Redis offline
    this.redisSub = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
      maxRetriesPerRequest: null, // Chặn MaxRetriesPerRequestError
      enableOfflineQueue: false,  // Không lưu hàng chờ khi mất kết nối
      retryStrategy() {
        return null; // Tắt tự động thử lại liên tục
      }
    });

    // Bắt sự kiện error để chặn Unhandled Error Event
    this.redisSub.on('error', () => {
      // Bỏ qua log lỗi kết nối Redis khi chạy chế độ local fallback
    });

    this.init();
  }

  private init() {
    // Chỉ đăng ký channel nếu Redis thực sự kết nối thành công
    this.redisSub.on('connect', () => {
      this.redisSub.psubscribe('orderbook:*', 'trades:*');
    });

    this.redisSub.on('pmessage', (pattern, channel, message) => {
      this.broadcast(channel, message);
    });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('⚡ Client đã kết nối WebSocket!');
    });

    console.log(`🚀 WebSocket Server đang chạy trên port :${this.wss.options.port}`);
  }

  public broadcast(channel: string, payload: string) {
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        const parsedPayload = typeof payload === 'string' ? JSON.parse(payload) : payload;
        client.send(JSON.stringify({ channel, payload: parsedPayload }));
      }
    });
  }
}