"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeWSServer = void 0;
const ws_1 = require("ws");
const ioredis_1 = __importDefault(require("ioredis"));
class RealtimeWSServer {
    wss;
    redisSub;
    constructor(port) {
        this.wss = new ws_1.WebSocketServer({ port });
        this.redisSub = new ioredis_1.default({
            host: process.env.REDIS_HOST || '127.0.0.1',
            port: Number(process.env.REDIS_PORT) || 6379,
        });
        this.init();
    }
    init() {
        this.redisSub.psubscribe('orderbook:*', 'trades:*');
        this.redisSub.on('pmessage', (pattern, channel, message) => {
            this.broadcast(channel, message);
        });
        this.wss.on('connection', (ws) => {
            console.log('⚡ Client đã kết nối WebSocket!');
        });
        console.log(`🚀 WebSocket Server đang chạy trên port :${this.wss.options.port}`);
    }
    broadcast(channel, payload) {
        this.wss.clients.forEach(client => {
            if (client.readyState === ws_1.WebSocket.OPEN) {
                client.send(JSON.stringify({ channel, payload: JSON.parse(payload) }));
            }
        });
    }
}
exports.RealtimeWSServer = RealtimeWSServer;
