import React, { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries } from 'lightweight-charts';

export default function TradingChart({ activeOrders = [], activePositions = [], onUpdateOrderPrice }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const currentCandleRef = useRef(null);
  const priceLinesRef = useRef([]);

  const draggingOrderIdRef = useRef(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 1. Khởi tạo TradingView Chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight || 350,
      layout: {
        background: { color: '#12161c' },
        textColor: '#9CA3AF',
      },
      grid: {
        vertLines: { color: '#1F2937' },
        horzLines: { color: '#1F2937' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
      },
    });

    chartRef.current = chart;

    let candlestickSeries;
    if (typeof chart.addCandlestickSeries === 'function') {
      candlestickSeries = chart.addCandlestickSeries({
        upColor: '#10B981',
        downColor: '#EF4444',
        borderVisible: false,
        wickUpColor: '#10B981',
        wickDownColor: '#EF4444',
      });
    } else {
      candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#10B981',
        downColor: '#EF4444',
        borderVisible: false,
        wickUpColor: '#10B981',
        wickDownColor: '#EF4444',
      });
    }

    seriesRef.current = candlestickSeries;

    // 2. Lấy dữ liệu nến lịch sử từ OKX REST API
    async function fetchHistoricalData() {
      try {
        const res = await fetch('https://www.okx.com/api/v5/market/candles?instId=BTC-USDT&bar=1m&limit=100');
        const json = await res.json();
        
        if (json.code === '0' && json.data) {
          const formattedData = json.data.map(d => ({
            time: Math.floor(parseInt(d[0]) / 1000),
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
          })).reverse();

          candlestickSeries.setData(formattedData);

          if (formattedData.length > 0) {
            currentCandleRef.current = { ...formattedData[formattedData.length - 1] };
          }
        }
      } catch (err) {
        console.error('Lỗi lấy dữ liệu nến OKX:', err);
      }
    }

    fetchHistoricalData();

    // 3. Kết nối WebSocket nhận dữ liệu giá realtime
    const ws = new WebSocket('ws://localhost:8080');

    ws.onmessage = (event) => {
      try {
        const res = JSON.parse(event.data);
        if (res.channel && res.channel.startsWith('trades:')) {
          const trades = res.payload?.data || res.payload;
          if (Array.isArray(trades) && trades.length > 0) {
            const price = parseFloat(trades[0].price);
            const tradeTime = Math.floor((trades[0].timestamp || Date.now()) / 1000);
            const candleTime = Math.floor(tradeTime / 60) * 60;

            if (!currentCandleRef.current || currentCandleRef.current.time !== candleTime) {
              currentCandleRef.current = {
                time: candleTime,
                open: price,
                high: price,
                low: price,
                close: price,
              };
            } else {
              currentCandleRef.current.high = Math.max(currentCandleRef.current.high, price);
              currentCandleRef.current.low = Math.min(currentCandleRef.current.low, price);
              currentCandleRef.current.close = price;
            }

            seriesRef.current.update(currentCandleRef.current);
          }
        }
      } catch (e) {
        console.error('Lỗi parse WebSocket trong Chart:', e);
      }
    };

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      ws.close();
      chart.remove();
    };
  }, []);

  // 4. Vẽ / Cập nhật đường giá Lệnh chờ (Limit) & Vị thế đang mở (Entry, TP, SL)
  useEffect(() => {
    if (!seriesRef.current) return;

    // Xóa tất cả các đường cũ trước khi vẽ lại
    priceLinesRef.current.forEach((line) => {
      try {
        seriesRef.current.removePriceLine(line);
      } catch (e) {}
    });
    priceLinesRef.current = [];

    // A. Vẽ các lệnh Limit đang chờ
    activeOrders.forEach((order) => {
      const isBuy = order.side === 'BUY';
      const line = seriesRef.current.createPriceLine({
        price: Number(order.price),
        color: isBuy ? '#10B981' : '#EF4444',
        lineWidth: 1,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: `CHỜ ${order.side} @ $${order.price}`,
      });
      priceLinesRef.current.push(line);
    });

    // B. Vẽ các vị thế đã khớp (ENTRY, TP, SL)
    activePositions.forEach((pos) => {
      // Đường giá khớp (Entry Price)
      const entryLine = seriesRef.current.createPriceLine({
        price: Number(pos.entryPrice),
        color: '#F59E0B', // Màu vàng
        lineWidth: 2,
        lineStyle: 0, // Solid
        axisLabelVisible: true,
        title: `ENTRY ${pos.side} @ $${pos.entryPrice}`,
      });
      priceLinesRef.current.push(entryLine);

      // Đường Chốt lời (TP)
      if (pos.takeProfit) {
        const tpLine = seriesRef.current.createPriceLine({
          price: Number(pos.takeProfit),
          color: '#10B981', // Màu xanh lá
          lineWidth: 1,
          lineStyle: 2, // Dashed
          axisLabelVisible: true,
          title: `TP: $${pos.takeProfit}`,
        });
        priceLinesRef.current.push(tpLine);
      }

      // Đường Cắt lỗ (SL)
      if (pos.stopLoss) {
        const slLine = seriesRef.current.createPriceLine({
          price: Number(pos.stopLoss),
          color: '#EF4444', // Màu đỏ
          lineWidth: 1,
          lineStyle: 2, // Dashed
          axisLabelVisible: true,
          title: `SL: $${pos.stopLoss}`,
        });
        priceLinesRef.current.push(slLine);
      }
    });
  }, [activeOrders, activePositions]);

  return <div ref={chartContainerRef} className="w-full h-full min-h-[350px]" />;
}