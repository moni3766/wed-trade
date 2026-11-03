import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';

import { OrderBook } from './OrderBook';
import { RedisPublisher, localPubSub } from './RedisPublisher';
import { RealtimeWSServer } from './WebSocketServer';

import { register, login, getProfile } from './controllers/authController';
import { authenticateToken } from './middleware/auth';

dotenv.config();

// ==========================================
// 1. EXPRESS REST API SERVER
// ==========================================
const app = express();
app.use(cors());
app.use(express.json());

// Public Routes
app.post('/api/auth/register', register);
app.post('/api/auth/login', login);

// Private Route
app.get('/api/auth/profile', authenticateToken, getProfile);

const API_PORT = process.env.PORT || 3001;
app.listen(API_PORT, () => {
  console.log(`🚀 Express Auth REST API đang chạy tại http://localhost:${API_PORT}`);
});

// ==========================================
// 2. MATCHING ENGINE & WEBSOCKET SERVER
// ==========================================
const wssInstance = new RealtimeWSServer(8080);
const redisPub = new RedisPublisher();
const btcOrderBook = new OrderBook('BTC/USDT', redisPub);

let currentOkxPrice = 83600;

async function fetchOkxPrice() {
  try {
    const res = await fetch('https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT');
    const data = await res.json();
    if (data.code === '0' && data.data?.[0]?.last) {
      currentOkxPrice = parseFloat(data.data[0].last);
    }
  } catch (err) {
    console.error('Lỗi sync giá OKX:', err);
  }
}

fetchOkxPrice();
setInterval(fetchOkxPrice, 5000);

console.log('✅ CEX Matching Engine & WebSocket Server đang chạy ở cổng 8080...');

localPubSub.on('message', (channel: string, message: string) => {
  try {
    const data = JSON.parse(message);
    const broadcastPayload = JSON.stringify({
      channel: channel,
      payload: data
    });

    if (wssInstance && (wssInstance as any).wss) {
      const wss: WebSocketServer = (wssInstance as any).wss;
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(broadcastPayload);
        }
      });
    }
  } catch (err) {
    console.error('Lỗi broadcast dữ liệu localPubSub:', err);
  }
});

if (wssInstance && (wssInstance as any).wss) {
  const wss: WebSocketServer = (wssInstance as any).wss;

  wss.on('connection', (ws: WebSocket) => {
    ws.on('message', (rawMessage: string) => {
      try {
        const message = JSON.parse(rawMessage.toString());
        if (message.type === 'CREATE_ORDER' || message.action === 'CREATE_ORDER' || message.type === 'PLACE_ORDER') {
          const orderData = message.payload || message.data;

          btcOrderBook.processOrder({
            id: orderData.id || `ORD-${Date.now()}`,
            userId: orderData.userId || 'frontend-user',
            symbol: 'BTC/USDT',
            side: orderData.side,
            type: orderData.type || 'LIMIT',
            price: Number(orderData.price),
            quantity: Number(orderData.quantity),
            filledQuantity: 0,
            createdAt: Date.now(),
          });
        }
      } catch (err) {
        console.error('Lỗi xử lý order:', err);
      }
    });
  });
}

setInterval(() => {
  const isBuy = Math.random() > 0.5;
  const offset = (Math.random() - 0.5) * 300; 
  const price = Math.floor(currentOkxPrice + offset);
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
}, 1500);