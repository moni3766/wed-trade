import React from 'react';

export default function TradeHistory({ trades }) {
  return (
    <div style={{ backgroundColor: '#1f2937', padding: '16px', borderRadius: '8px', color: '#fff', height: '100%' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 'bold', color: '#e5e7eb' }}>
        Lịch Sử Khớp Lệnh (Market Trades)
      </h3>
      <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
          <thead>
            <tr style={{ color: '#9ca3af', borderBottom: '1px solid #374151' }}>
              <th style={{ padding: '8px 4px' }}>Thời gian</th>
              <th style={{ padding: '8px 4px' }}>Giá (USDT)</th>
              <th style={{ padding: '8px 4px', textAlign: 'right' }}>Khối lượng (BTC)</th>
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 ? (
              <tr>
                <td colSpan="3" style={{ textAlign: 'center', color: '#6b7280', padding: '16px' }}>
                  Chưa có giao dịch khớp
                </td>
              </tr>
            ) : (
              trades.map((trade) => {
                const isBuy = trade.side === 'BUY';
                return (
                  <tr key={trade.id} style={{ borderBottom: '1px solid #111827' }}>
                    <td style={{ padding: '6px 4px', color: '#9ca3af' }}>
                      {new Date(trade.timestamp).toLocaleTimeString()}
                    </td>
                    <td style={{ padding: '6px 4px', fontWeight: 'bold', color: isBuy ? '#10b981' : '#ef4444' }}>
                      {Number(trade.price).toLocaleString()}
                    </td>
                    <td style={{ padding: '6px 4px', textAlign: 'right', color: '#e5e7eb' }}>
                      {Number(trade.quantity).toFixed(4)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}