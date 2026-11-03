import React, { useState, useEffect, useRef } from 'react';
import { 
  Wifi, WifiOff, BarChart2, Wallet, Trash2, CheckCircle2, Clock, DollarSign, User, LogOut, TrendingUp, TrendingDown, Minus
} from 'lucide-react';
import TradingChart from './components/TradingChart';
import AuthModal from './components/AuthModal';

export default function App() {
  const DEFAULT_OKX_PRICE = 83600.00;

  // State Quản lý Người dùng & Auth Modal
  const [user, setUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // State Toast Notification
  const [toast, setToast] = useState(null);

  // Realtime States
  const [bids, setBids] = useState([]);
  const [asks, setAsks] = useState([]);
  const [trades, setTrades] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastPrice, setLastPrice] = useState(DEFAULT_OKX_PRICE);

  // User Wallet & Orders State
  const [balance, setBalance] = useState({ usdt: 100000.00, btc: 1.50 });
  const [myOrders, setMyOrders] = useState([]); // Lệnh LIMIT đang chờ
  const [positions, setPositions] = useState([]); // Lệnh đã khớp (Vị thế Lãi/Lỗ kèm TP/SL)
  const [activeTab, setActiveTab] = useState('OPEN_ORDERS'); 

  // Form Lệnh & TP/SL mở rộng
  const [orderSide, setOrderSide] = useState('BUY');
  const [orderType, setOrderType] = useState('LIMIT');
  const [priceInput, setPriceInput] = useState(DEFAULT_OKX_PRICE.toFixed(2));
  const [qtyInput, setQtyInput] = useState('0.1');
  const [tpInput, setTpInput] = useState(''); // Take Profit
  const [slInput, setSlInput] = useState(''); // Stop Loss

  const wsRef = useRef(null);

  // Hiển thị Toast Notification
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 1. Phục hồi phiên làm việc từ LocalStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (savedUser && token) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setBalance({
          usdt: Number(parsedUser.usdtBalance || 100000.00),
          btc: Number(parsedUser.btcBalance || 1.50)
        });
      } catch (e) {
        console.error("Lỗi đọc thông tin user từ localStorage:", e);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setBalance({ usdt: 100000.00, btc: 1.50 });
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setBalance({
      usdt: Number(userData.usdtBalance || 100000.00),
      btc: Number(userData.btcBalance || 1.50)
    });
  };

  // 2. Kết nối WebSocket Engine
  useEffect(() => {
    let ws;
    const connectWS = () => {
      ws = new WebSocket('ws://localhost:8080');
      wsRef.current = ws;

      ws.onopen = () => setIsConnected(true);

      ws.onmessage = (event) => {
        setIsConnected(true);

        try {
          const res = JSON.parse(event.data);
          
          if (res.channel && res.channel.startsWith('orderbook:')) {
            const depth = res.payload?.data || res.payload;
            if (depth) {
              if (depth.bids) setBids(depth.bids);
              if (depth.asks) setAsks(depth.asks);
            }
          }

          if (res.channel && res.channel.startsWith('trades:')) {
            const newTrades = res.payload?.data || res.payload;
            if (Array.isArray(newTrades) && newTrades.length > 0) {
              setTrades((prev) => [...newTrades, ...prev].slice(0, 30));
              
              const currentTrade = newTrades[0];
              const currentTradePrice = Number(currentTrade.price);
              if (!isNaN(currentTradePrice)) {
                setLastPrice(currentTradePrice);
              }
            }
          }
        } catch (e) {
          console.error("Lỗi parse WebSocket data:", e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setTimeout(connectWS, 3000);
      };

      ws.onerror = () => setIsConnected(false);
    };

    connectWS();
    return () => ws && ws.close();
  }, []);

  // 3. Quét khớp lệnh LIMIT & Tự động kích hoạt TP/SL cho các Vị thế
  useEffect(() => {
    // A. Quét khớp lệnh LIMIT đang chờ
    if (myOrders.length > 0) {
      setMyOrders((prevOrders) => {
        const matchedList = [];
        const remainingList = [];

        prevOrders.forEach((order) => {
          let isMatched = false;
          if (order.type === 'LIMIT') {
            if (order.side === 'BUY' && lastPrice <= order.price) {
              isMatched = true;
            } else if (order.side === 'SELL' && lastPrice >= order.price) {
              isMatched = true;
            }
          }

          if (isMatched) {
            matchedList.push({
              ...order,
              entryPrice: order.price,
              filledTime: new Date().toLocaleTimeString()
            });
          } else {
            remainingList.push(order);
          }
        });

        if (matchedList.length > 0) {
          setPositions((prevPos) => [...matchedList, ...prevPos]);
          showToast(`⚡ Lệnh LIMIT ${matchedList[0].side} đã khớp tại giá $${lastPrice.toLocaleString()}!`, "success");
        }

        return remainingList;
      });
    }

    // B. Quét kiểm tra TP/SL cho các vị thế đang mở
    if (positions.length > 0) {
      setPositions((prevPositions) => {
        const activePositions = [];

        prevPositions.forEach((pos) => {
          let shouldClose = false;
          let closeReason = '';

          const tp = pos.takeProfit ? parseFloat(pos.takeProfit) : null;
          const sl = pos.stopLoss ? parseFloat(pos.stopLoss) : null;

          if (pos.side === 'BUY') {
            if (tp && lastPrice >= tp) {
              shouldClose = true;
              closeReason = 'Chốt lời (TP)';
            } else if (sl && lastPrice <= sl) {
              shouldClose = true;
              closeReason = 'Cắt lỗ (SL)';
            }
          } else { // SELL position
            if (tp && lastPrice <= tp) {
              shouldClose = true;
              closeReason = 'Chốt lời (TP)';
            } else if (sl && lastPrice >= sl) {
              shouldClose = true;
              closeReason = 'Cắt lỗ (SL)';
            }
          }

          if (shouldClose) {
            const pnl = pos.side === 'BUY'
              ? (lastPrice - pos.entryPrice) * pos.quantity
              : (pos.entryPrice - lastPrice) * pos.quantity;

            setBalance((prevBal) => ({
              ...prevBal,
              usdt: prevBal.usdt + (pos.side === 'BUY' ? (pos.quantity * lastPrice) : (pos.entryPrice * pos.quantity) + pnl)
            }));

            showToast(`🎯 Vị thế đã chạm mức ${closeReason}! Đã tự động chốt tại $${lastPrice.toLocaleString()} (PnL: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT)`, pnl >= 0 ? 'success' : 'error');
          } else {
            activePositions.push(pos);
          }
        });

        return activePositions;
      });
    }
  }, [lastPrice]);

  // Cập nhật giá khi kéo thả đường line trên biểu đồ
  const handleUpdateOrderPrice = (orderId, newPrice) => {
    setMyOrders(prevOrders => 
      prevOrders.map(ord => 
        ord.id === orderId ? { ...ord, price: newPrice } : ord
      )
    );
  };

  // 4. Đặt lệnh Mua / Bán tích hợp TP/SL
  const handlePlaceOrder = () => {
    if (!user) {
      showToast("Vui lòng đăng nhập trước khi đặt lệnh!", "error");
      setIsAuthOpen(true);
      return;
    }

    const cleanPriceStr = String(priceInput).replace(',', '.');
    const cleanQtyStr = String(qtyInput).replace(',', '.');

    const qty = parseFloat(cleanQtyStr);
    if (isNaN(qty) || qty <= 0) {
      showToast("Vui lòng nhập số lượng hợp lệ!", "error");
      return;
    }

    const tpVal = tpInput ? parseFloat(String(tpInput).replace(',', '.')) : null;
    const slVal = slInput ? parseFloat(String(slInput).replace(',', '.')) : null;

    if (orderType === 'MARKET') {
      const totalCost = lastPrice * qty;

      if (orderSide === 'BUY' && balance.usdt < totalCost) {
        showToast(`Số dư USDT không đủ! Cần ${totalCost.toLocaleString()} USDT`, "error");
        return;
      }
      if (orderSide === 'SELL' && balance.btc < qty) {
        showToast(`Số dư BTC không đủ! Cần ${qty} BTC`, "error");
        return;
      }

      if (orderSide === 'BUY') {
        setBalance(prev => ({ ...prev, usdt: prev.usdt - totalCost }));
      } else {
        setBalance(prev => ({ ...prev, btc: prev.btc - qty }));
      }

      const marketOrder = {
        id: "ORD_M_" + Math.floor(Math.random() * 1000000),
        userId: user.id || user._id || "USER_1",
        side: orderSide,
        type: 'MARKET',
        price: lastPrice,
        entryPrice: lastPrice,
        quantity: qty,
        takeProfit: tpVal,
        stopLoss: slVal,
        filledTime: new Date().toLocaleTimeString()
      };

      setPositions(prev => [marketOrder, ...prev]);
      showToast(`⚡ Khớp ngay Lệnh MARKET ${orderSide} tại $${lastPrice.toLocaleString()}!`, "success");

    } else {
      const price = parseFloat(cleanPriceStr);
      if (isNaN(price) || price <= 0) {
        showToast("Vui lòng nhập mức giá Limit hợp lệ!", "error");
        return;
      }

      const totalCost = price * qty;

      if (orderSide === 'BUY' && balance.usdt < totalCost) {
        showToast(`Số dư USDT không đủ! Cần ${totalCost.toLocaleString()} USDT`, "error");
        return;
      }
      if (orderSide === 'SELL' && balance.btc < qty) {
        showToast(`Số dư BTC không đủ! Cần ${qty} BTC`, "error");
        return;
      }

      if (orderSide === 'BUY') {
        setBalance(prev => ({ ...prev, usdt: prev.usdt - totalCost }));
      } else {
        setBalance(prev => ({ ...prev, btc: prev.btc - qty }));
      }

      const limitOrder = {
        id: "ORD_L_" + Math.floor(Math.random() * 1000000),
        userId: user.id || user._id || "USER_1",
        side: orderSide,
        type: 'LIMIT',
        price: price,
        quantity: qty,
        takeProfit: tpVal,
        stopLoss: slVal,
        filled: 0,
        status: 'OPEN',
        time: new Date().toLocaleTimeString()
      };

      setMyOrders(prev => [limitOrder, ...prev]);
      showToast(`Đã đặt Lệnh LIMIT ${orderSide} thành công tại $${price.toLocaleString()}!`, "success");

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "CREATE_ORDER",
          payload: limitOrder
        }));
      }
    }
  };

  // Hủy lệnh chờ
  const handleCancelOrder = (order) => {
    if (order.side === 'BUY') {
      setBalance(prev => ({ ...prev, usdt: prev.usdt + (order.price * order.quantity) }));
    } else {
      setBalance(prev => ({ ...prev, btc: prev.btc + order.quantity }));
    }

    setMyOrders(prev => prev.filter(o => o.id !== order.id));
    showToast("Đã hủy lệnh chờ thành công!", "success");
  };

  // Đóng vị thế thủ công
  const handleClosePosition = (pos) => {
    const pnl = pos.side === 'BUY'
      ? (lastPrice - pos.entryPrice) * pos.quantity
      : (pos.entryPrice - lastPrice) * pos.quantity;

    if (pos.side === 'BUY') {
      setBalance(prev => ({ ...prev, usdt: prev.usdt + (pos.quantity * lastPrice) }));
    } else {
      setBalance(prev => ({ ...prev, usdt: prev.usdt + (pos.entryPrice * pos.quantity) + pnl }));
    }

    setPositions(prev => prev.filter(p => p.id !== pos.id));
    showToast(`Đã đóng vị thế! PnL: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT`, pnl >= 0 ? 'success' : 'error');
  };

  return (
    <div className="min-h-screen bg-[#0b0e11] text-gray-200 font-sans flex flex-col relative">
      {/* Navigation Bar */}
      <header className="border-b border-gray-800 bg-[#12161c] px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-black text-xl">
              X
            </div>
            <span className="text-xl font-bold tracking-wide text-white">CEX Pro</span>
          </div>
          <div className="flex gap-6 text-sm font-medium text-gray-400">
            <span className="text-emerald-400 border-b-2 border-emerald-400 pb-1">Giao dịch Spot</span>
            <span className="hover:text-white cursor-pointer">Futures</span>
            <span className="hover:text-white cursor-pointer">Thị trường</span>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm">
          {/* Trạng thái ví */}
          <div className="flex items-center gap-4 bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-lg text-xs font-mono">
            <div><span className="text-gray-500">USDT:</span> <span className="text-white font-bold">{balance.usdt.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
            <div className="w-px h-3 bg-gray-700"></div>
            <div><span className="text-gray-500">BTC:</span> <span className="text-emerald-400 font-bold">{balance.btc.toFixed(4)}</span></div>
          </div>

          {/* User Auth Info */}
          {user ? (
            <div className="flex items-center gap-3 bg-gray-800/60 px-3 py-1 rounded-lg border border-gray-700">
              <User className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-white">{user.username}</span>
              <button 
                onClick={handleLogout}
                className="text-gray-400 hover:text-rose-400 ml-1"
                title="Đăng xuất"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthOpen(true)}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-3 py-1.5 rounded text-xs transition-all"
            >
              Đăng Nhập / Đăng Ký
            </button>
          )}

          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            isConnected ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50' : 'bg-rose-950/80 text-rose-400 border border-rose-800/50'
          }`}>
            {isConnected ? <Wifi className="w-3.5 h-3.5 animate-pulse" /> : <WifiOff className="w-3.5 h-3.5" />}
            {isConnected ? 'Real-time Connected' : 'Disconnected'}
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-12 gap-1 p-2 bg-black">
        {/* Left Section: Chart + Order Form */}
        <div className="col-span-12 lg:col-span-6 flex flex-col gap-1">
          {/* Ticker Banner */}
          <div className="bg-[#12161c] p-3 rounded flex justify-between items-center border border-gray-800/60">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-lg font-bold text-white">BTC/USDT <span className="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded ml-1">Spot</span></h1>
                <p className="text-xl font-bold text-emerald-400 font-mono mt-0.5">${lastPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-6 text-right text-xs">
              <div><p className="text-gray-500">Biến động 24h</p><p className="text-emerald-400 font-semibold">+2.45%</p></div>
              <div><p className="text-gray-500">Cao nhất 24h</p><p className="text-white font-semibold">{(lastPrice + 1000).toLocaleString(undefined, {minimumFractionDigits: 2})}</p></div>
              <div><p className="text-gray-500">Khối lượng 24h</p><p className="text-white font-semibold">1,248.5 BTC</p></div>
            </div>
          </div>

          {/* Chart Section */}
          <div className="bg-[#12161c] rounded p-4 border border-gray-800/60 flex flex-col h-[380px]">
            <div className="flex justify-between items-center text-xs text-gray-400 border-b border-gray-800 pb-2 mb-2">
              <span className="text-emerald-400 font-bold border-b-2 border-emerald-400 pb-2 -mb-2">TradingView Chart (OKX)</span>
              <div className="flex gap-2">
                {['1m', '15m', '1h', '4h', '1D'].map((time) => (
                  <button key={time} className="hover:text-white px-2 py-0.5 rounded bg-gray-800/50">{time}</button>
                ))}
              </div>
            </div>
            
            <div className="flex-1 w-full h-full overflow-hidden relative">
              <TradingChart 
                activeOrders={myOrders} 
                activePositions={positions}
                onUpdateOrderPrice={handleUpdateOrderPrice} 
              />
            </div>
          </div>

          {/* Form Đặt Lệnh + TP / SL */}
          <div className="bg-[#12161c] p-4 rounded border border-gray-800/60">
            <div className="flex gap-2 mb-3">
              <button 
                onClick={() => setOrderSide('BUY')}
                className={`flex-1 py-2 rounded font-bold text-sm transition-all ${
                  orderSide === 'BUY' ? 'bg-emerald-500 text-black' : 'bg-gray-800 text-gray-400'
                }`}
              >
                Mua BTC
              </button>
              <button 
                onClick={() => setOrderSide('SELL')}
                className={`flex-1 py-2 rounded font-bold text-sm transition-all ${
                  orderSide === 'SELL' ? 'bg-rose-500 text-white' : 'bg-gray-800 text-gray-400'
                }`}
              >
                Bán BTC
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-semibold mb-3">
              <button onClick={() => setOrderType('LIMIT')} className={`py-1.5 rounded border ${orderType === 'LIMIT' ? 'border-emerald-500 text-emerald-400' : 'border-gray-800 text-gray-500'}`}>
                Lệnh Giới hạn (Limit)
              </button>
              <button onClick={() => setOrderType('MARKET')} className={`py-1.5 rounded border ${orderType === 'MARKET' ? 'border-emerald-500 text-emerald-400' : 'border-gray-800 text-gray-500'}`}>
                Lệnh Thị trường (Market)
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="text-gray-400 block mb-1">Giá đặt (USDT)</label>
                <input 
                  type="text" 
                  value={orderType === 'MARKET' ? 'Giá thị trường (Market)' : priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  disabled={orderType === 'MARKET'}
                  className="w-full bg-gray-900 border border-gray-800 rounded px-3 py-2 text-white font-mono focus:border-emerald-500 outline-none disabled:text-gray-500"
                />
              </div>
              <div>
                <label className="text-gray-400 block mb-1">Số lượng (BTC)</label>
                <input 
                  type="text" 
                  value={qtyInput}
                  onChange={(e) => setQtyInput(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded px-3 py-2 text-white font-mono focus:border-emerald-500 outline-none"
                />
              </div>

              {/* Ô nhập Chốt lời (TP) và Cắt lỗ (SL) */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-emerald-400 block mb-1">Chốt lời (TP)</label>
                  <input 
                    type="text" 
                    placeholder="VD: 88000"
                    value={tpInput}
                    onChange={(e) => setTpInput(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-800 rounded px-3 py-1.5 text-white font-mono focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-rose-400 block mb-1">Cắt lỗ (SL)</label>
                  <input 
                    type="text" 
                    placeholder="VD: 80000"
                    value={slInput}
                    onChange={(e) => setSlInput(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-800 rounded px-3 py-1.5 text-white font-mono focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-between text-[11px] text-gray-500 pt-1">
                <span>Ước tính giá trị:</span>
                <span className="font-mono text-gray-300 font-bold">
                  {(
                    (orderType === 'MARKET' ? lastPrice : parseFloat(String(priceInput).replace(',', '.') || 0)) * 
                    parseFloat(String(qtyInput).replace(',', '.') || 0)
                  ).toLocaleString()} USDT
                </span>
              </div>

              <button 
                onClick={handlePlaceOrder}
                className={`w-full py-2.5 rounded font-bold text-sm transition-all ${
                  orderSide === 'BUY' ? 'bg-emerald-500 hover:bg-emerald-400 text-black' : 'bg-rose-500 hover:bg-rose-400 text-white'
                }`}
              >
                {orderSide === 'BUY' ? `Đặt Lệnh Mua (BUY BTC)` : `Đặt Lệnh Bán (SELL BTC)`}
              </button>
            </div>
          </div>
        </div>

        {/* Middle Section: Orderbook */}
        <div className="col-span-12 lg:col-span-3 bg-[#12161c] p-3 rounded border border-gray-800/60 flex flex-col h-full">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Sổ Lệnh (Orderbook)</h2>
          <div className="grid grid-cols-2 text-[11px] text-gray-500 pb-2 border-b border-gray-800">
            <span>Giá (USDT)</span>
            <span className="text-right">Số lượng (BTC)</span>
          </div>

          <div className="flex-1 flex flex-col justify-end space-y-0.5 my-2 overflow-hidden font-mono text-xs">
            {asks.slice(0, 12).map((ask, idx) => (
              <div key={idx} className="grid grid-cols-2 py-0.5 px-1 hover:bg-rose-950/30 rounded text-rose-400">
                <span>{Number(ask.price).toFixed(2)}</span>
                <span className="text-right text-gray-300">{Number(ask.quantity).toFixed(4)}</span>
              </div>
            ))}
          </div>

          <div className="py-2 my-1 border-y border-gray-800 flex justify-between items-center px-1 bg-gray-900/40">
            <span className="text-base font-bold text-emerald-400 font-mono">${lastPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            <span className="text-[10px] text-gray-500">Giá gần nhất</span>
          </div>

          <div className="flex-1 space-y-0.5 my-2 overflow-hidden font-mono text-xs">
            {bids.slice(0, 12).map((bid, idx) => (
              <div key={idx} className="grid grid-cols-2 py-0.5 px-1 hover:bg-emerald-950/30 rounded text-emerald-400">
                <span>{Number(bid.price).toFixed(2)}</span>
                <span className="text-right text-gray-300">{Number(bid.quantity).toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Section: Recent Trades */}
        <div className="col-span-12 lg:col-span-3 bg-[#12161c] p-3 rounded border border-gray-800/60 flex flex-col h-full">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Khớp Lệnh Real-time</h2>
          <div className="grid grid-cols-3 text-[11px] text-gray-500 pb-2 border-b border-gray-800">
            <span>Giá (USDT)</span>
            <span className="text-center">Số lượng</span>
            <span className="text-right">Thời gian</span>
          </div>

          <div className="flex-1 space-y-1 my-2 overflow-y-auto font-mono text-xs">
            {trades.map((t, idx) => (
              <div key={idx} className="grid grid-cols-3 py-0.5 px-1 hover:bg-gray-800/40 rounded">
                <span className={t.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}>
                  {Number(t.price).toFixed(2)}
                </span>
                <span className="text-center text-gray-300">{Number(t.quantity).toFixed(4)}</span>
                <span className="text-right text-gray-500">
                  {new Date(t.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Panel: Open Orders & Positions (PnL + TP/SL) */}
        <div className="col-span-12 bg-[#12161c] p-4 rounded border border-gray-800/60 mt-1">
          <div className="flex gap-6 border-b border-gray-800 pb-2 text-xs font-bold">
            <button 
              onClick={() => setActiveTab('OPEN_ORDERS')}
              className={`pb-2 -mb-2 ${activeTab === 'OPEN_ORDERS' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-gray-500 hover:text-white'}`}
            >
              Lệnh đang chờ ({myOrders.length})
            </button>
            <button 
              onClick={() => setActiveTab('POSITIONS')}
              className={`pb-2 -mb-2 ${activeTab === 'POSITIONS' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-gray-500 hover:text-white'}`}
            >
              Lệnh đã khớp & Lãi/Lỗ Realtime ({positions.length})
            </button>
          </div>

          <div className="mt-3 overflow-x-auto">
            {activeTab === 'OPEN_ORDERS' ? (
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800/80 pb-2">
                    <th className="py-2">Mã Lệnh</th>
                    <th>Loại</th>
                    <th>Phe</th>
                    <th>Giá đặt (USDT)</th>
                    <th>Số lượng (BTC)</th>
                    <th>TP / SL</th>
                    <th>Thời gian</th>
                    <th className="text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40">
                  {myOrders.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-6 text-gray-600">
                        Chưa có lệnh đang chờ nào
                      </td>
                    </tr>
                  ) : (
                    myOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-800/30">
                        <td className="py-2.5 text-gray-400">{order.id}</td>
                        <td><span className="bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded text-[10px]">{order.type}</span></td>
                        <td className={order.side === 'BUY' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                          {order.side}
                        </td>
                        <td className="text-white">${order.price.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        <td className="text-gray-300">{order.quantity}</td>
                        <td className="text-gray-400 text-[11px]">
                          <span className="text-emerald-400">TP: {order.takeProfit ? `$${order.takeProfit}` : '---'}</span> / <span className="text-rose-400">SL: {order.stopLoss ? `$${order.stopLoss}` : '---'}</span>
                        </td>
                        <td className="text-gray-500">{order.time}</td>
                        <td className="text-right">
                          <button 
                            onClick={() => handleCancelOrder(order)}
                            className="text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 p-1.5 rounded transition-all"
                            title="Hủy lệnh"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              /* Tab Lãi / Lỗ Real-time & TP/SL */
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800/80 pb-2">
                    <th className="py-2">Mã Vị Thế</th>
                    <th>Phe</th>
                    <th>Giá Khớp (Entry)</th>
                    <th>Giá Thị Trường</th>
                    <th>TP / SL</th>
                    <th>Số lượng</th>
                    <th>Lãi / Lỗ (PnL)</th>
                    <th className="text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40">
                  {positions.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-6 text-gray-600">
                        Chưa có vị thế khớp lệnh nào
                      </td>
                    </tr>
                  ) : (
                    positions.map((pos) => {
                      const pnl = pos.side === 'BUY'
                        ? (lastPrice - pos.entryPrice) * pos.quantity
                        : (pos.entryPrice - lastPrice) * pos.quantity;
                      
                      const pnlPercentage = pos.side === 'BUY'
                        ? ((lastPrice - pos.entryPrice) / pos.entryPrice) * 100
                        : ((pos.entryPrice - lastPrice) / pos.entryPrice) * 100;

                      const isProfit = pnl >= 0;

                      return (
                        <tr key={pos.id} className="hover:bg-gray-800/30">
                          <td className="py-2.5 text-gray-400">{pos.id}</td>
                          <td className={pos.side === 'BUY' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                            {pos.side}
                          </td>
                          <td className="text-white">${pos.entryPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td className="text-emerald-400 font-bold">${lastPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td className="text-gray-400 text-[11px]">
                            <span className="text-emerald-400">TP: {pos.takeProfit ? `$${pos.takeProfit}` : '---'}</span> / <span className="text-rose-400">SL: {pos.stopLoss ? `$${pos.stopLoss}` : '---'}</span>
                          </td>
                          <td className="text-gray-300">{pos.quantity} BTC</td>
                          <td>
                            <div className={`font-bold flex items-center gap-1 ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isProfit ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                              <span>{isProfit ? '+' : ''}{pnl.toFixed(2)} USDT ({pnlPercentage.toFixed(2)}%)</span>
                            </div>
                          </td>
                          <td className="text-right">
                            <button 
                              onClick={() => handleClosePosition(pos)}
                              className="bg-gray-800 hover:bg-gray-700 text-white font-bold px-2.5 py-1 rounded text-[11px] transition-all"
                            >
                              Chốt vị thế
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-xl font-semibold text-sm flex items-center gap-2 border transition-all animate-bounce ${
          toast.type === 'success' 
            ? 'bg-emerald-950 text-emerald-300 border-emerald-600' 
            : 'bg-rose-950 text-rose-300 border-rose-600'
        }`}>
          <span>{toast.type === 'success' ? '✅' : '⚠️'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Auth Modal Component */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}