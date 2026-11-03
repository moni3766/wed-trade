"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisPublisher = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
class RedisPublisher {
    client;
    constructor() {
        this.client = new ioredis_1.default({
            host: process.env.REDIS_HOST || '127.0.0.1',
            port: Number(process.env.REDIS_PORT) || 6379,
        });
    }
    publishDepthUpdate(symbol, depthData) {
        const channel = `orderbook:${symbol}`;
        this.client.publish(channel, JSON.stringify({ type: 'DEPTH_UPDATE', data: depthData }));
    }
    publishTrades(symbol, trades) {
        if (trades.length === 0)
            return;
        const channel = `trades:${symbol}`;
        this.client.publish(channel, JSON.stringify({ type: 'NEW_TRADES', data: trades }));
    }
}
exports.RedisPublisher = RedisPublisher;
