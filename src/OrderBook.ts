import { Order, Trade } from '../types';
import { RedisPublisher } from './RedisPublisher';
import { TradeRepository } from '../TradeRepository';

export class OrderBook {
  public symbol: string;
  public bids: Order[] = [];
  public asks: Order[] = [];
  private redisPub: RedisPublisher;

  constructor(symbol: string, redisPub: RedisPublisher) {
    this.symbol = symbol;
    this.redisPub = redisPub;
  }

  private addBid(order: Order): void {
    this.bids.push(order);
    this.bids.sort((a, b) => {
      if (b.price !== a.price) return b.price - a.price;
      return a.createdAt - b.createdAt;
    });
  }

  private addAsk(order: Order): void {
    this.asks.push(order);
    this.asks.sort((a, b) => {
      if (a.price !== b.price) return a.price - b.price;
      return a.createdAt - b.createdAt;
    });
  }

  public processOrder(incomingOrder: Order): Trade[] {
    const trades: Trade[] = [];

    if (incomingOrder.side === 'BUY') {
      while (this.asks.length > 0 && incomingOrder.filledQuantity < incomingOrder.quantity) {
        const bestAsk = this.asks[0];
        if (incomingOrder.type === 'LIMIT' && bestAsk.price > incomingOrder.price) break;

        const remainingIncoming = incomingOrder.quantity - incomingOrder.filledQuantity;
        const remainingAsk = bestAsk.quantity - bestAsk.filledQuantity;
        const matchQuantity = Math.min(remainingIncoming, remainingAsk);
        const matchPrice = bestAsk.price;

        incomingOrder.filledQuantity += matchQuantity;
        bestAsk.filledQuantity += matchQuantity;

        const trade: Trade = {
          id: `TRD-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          symbol: this.symbol,
          buyOrderId: incomingOrder.id,
          sellOrderId: bestAsk.id,
          makerUserId: bestAsk.userId,
          takerUserId: incomingOrder.userId,
          side: 'BUY',
          price: matchPrice,
          quantity: matchQuantity,
          timestamp: Date.now(),
        };

        trades.push(trade);

        // Lưu từng khớp lệnh vào DB
        TradeRepository.saveTrade({
          id: trade.id,
          symbol: trade.symbol,
          price: trade.price,
          quantity: trade.quantity,
          buyerId: trade.takerUserId,
          sellerId: trade.makerUserId,
        }).catch(err => console.error('Lỗi saveTrade:', err));

        if (bestAsk.filledQuantity === bestAsk.quantity) this.asks.shift();
      }

      if (incomingOrder.type === 'LIMIT' && incomingOrder.filledQuantity < incomingOrder.quantity) {
        this.addBid(incomingOrder);
      }
    } else {
      while (this.bids.length > 0 && incomingOrder.filledQuantity < incomingOrder.quantity) {
        const bestBid = this.bids[0];
        if (incomingOrder.type === 'LIMIT' && bestBid.price < incomingOrder.price) break;

        const remainingIncoming = incomingOrder.quantity - incomingOrder.filledQuantity;
        const remainingBid = bestBid.quantity - bestBid.filledQuantity;
        const matchQuantity = Math.min(remainingIncoming, remainingBid);
        const matchPrice = bestBid.price;

        incomingOrder.filledQuantity += matchQuantity;
        bestBid.filledQuantity += matchQuantity;

        const trade: Trade = {
          id: `TRD-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          symbol: this.symbol,
          buyOrderId: bestBid.id,
          sellOrderId: incomingOrder.id,
          makerUserId: bestBid.userId,
          takerUserId: incomingOrder.userId,
          side: 'SELL',
          price: matchPrice,
          quantity: matchQuantity,
          timestamp: Date.now(),
        };

        trades.push(trade);

        // Lưu từng khớp lệnh vào DB
        TradeRepository.saveTrade({
          id: trade.id,
          symbol: trade.symbol,
          price: trade.price,
          quantity: trade.quantity,
          buyerId: trade.makerUserId,
          sellerId: trade.takerUserId,
        }).catch(err => console.error('Lỗi saveTrade:', err));

        if (bestBid.filledQuantity === bestBid.quantity) this.bids.shift();
      }

      if (incomingOrder.type === 'LIMIT' && incomingOrder.filledQuantity < incomingOrder.quantity) {
        this.addAsk(incomingOrder);
      }
    }

    // Publish cập nhật Sổ lệnh (Depth) và Danh sách lệnh vừa Khớp (Trades) sang Redis WebSocket Server
    this.redisPub.publishDepthUpdate(this.symbol, this.getDepth(10));
    if (trades.length > 0) {
      this.redisPub.publishTrades(this.symbol, trades);
    }

    return trades;
  }

  public getDepth(depthLimit: number = 5) {
    return {
      bids: this.bids.slice(0, depthLimit).map(b => ({ price: b.price, quantity: b.quantity - b.filledQuantity })),
      asks: this.asks.slice(0, depthLimit).map(a => ({ price: a.price, quantity: a.quantity - a.filledQuantity })),
    };
  }
}