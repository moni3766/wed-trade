"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const OrderBook_1 = require("./OrderBook");
const RedisPublisher_1 = require("./RedisPublisher");
const WebSocketServer_1 = require("./WebSocketServer");
new WebSocketServer_1.RealtimeWSServer(8080);
const redisPub = new RedisPublisher_1.RedisPublisher();
const btcOrderBook = new OrderBook_1.OrderBook('BTC/USDT', redisPub);
console.log('✅ Matching Engine đã sẵn sàng nhận lệnh...');
setInterval(() => {
    const isBuy = Math.random() > 0.5;
    const price = Math.floor(64000 + Math.random() * 2000);
    const quantity = parseFloat((Math.random() * 1.5).toFixed(2));
    btcOrderBook.processOrder({
        id: `ORD-${Date.now()}`,
        userId: `user-${Math.floor(Math.random() * 100)}`,
        symbol: 'BTC/USDT',
        side: isBuy ? 'BUY' : 'SELL',
        type: 'LIMIT',
        price,
        quantity,
        filledQuantity: 0,
        createdAt: Date.now(),
    });
}, 2000);
