export interface Trade {
  id: string;
  symbol: string;
  buyOrderId: string;
  sellOrderId: string;
  makerUserId: string;
  takerUserId: string;
  side?: 'BUY' | 'SELL'; // Hoặc side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  timestamp: number;
}