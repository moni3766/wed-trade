export interface Order {
  id: string;
  userId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'MARKET';
  price: number;
  quantity: number;
  filledQuantity: number;
  createdAt: number;
}

export interface Trade {
  id: string;
  symbol: string;
  buyOrderId: string;
  sellOrderId: string;
  makerUserId: string;
  takerUserId: string;
  side: 'BUY' | 'SELL'; // Trường 'side' giúp hết lỗi ts(2353) cũ
  price: number;
  quantity: number;
  timestamp: number;
}