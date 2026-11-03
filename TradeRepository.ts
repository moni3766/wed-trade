import { db } from './src/db';

export class TradeRepository {
  // Lưu giao dịch khớp lệnh mới
  static async saveTrade(trade: {
    id: string;
    symbol: string;
    price: number;
    quantity: number;
    buyerId?: string;
    sellerId?: string;
  }) {
    const query = `
      INSERT INTO trades (id, symbol, price, quantity, buyer_id, seller_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    try {
      await db.query(query, [
        trade.id,
        trade.symbol,
        trade.price,
        trade.quantity,
        trade.buyerId || 'system',
        trade.sellerId || 'system',
      ]);
    } catch (error) {
      console.error('❌ Lỗi lưu Trade vào DB:', error);
    }
  }

  // Lấy 50 lịch sử khớp lệnh gần nhất
  static async getRecentTrades(symbol: string, limit = 50) {
    const query = `
      SELECT id, symbol, price, quantity, created_at as timestamp
      FROM trades
      WHERE symbol = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    try {
      const res = await db.query(query, [symbol, limit]);
      return res.rows;
    } catch (error) {
      console.error('❌ Lỗi đọc lịch sử Trades từ DB:', error);
      return [];
    }
  }
}