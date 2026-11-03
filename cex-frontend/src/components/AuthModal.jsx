import React, { useState } from 'react';

export default function AuthModal({ isOpen, onClose, onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const bodyData = isLogin
      ? { email: formData.email, password: formData.password }
      : { username: formData.username, email: formData.email, password: formData.password };

    try {
      const res = await fetch(`http://localhost:3001${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      });

      const data = await res.json();

      // Kiểm tra HTTP Status Code thay vì bắt buộc thuộc tính data.success
      if (!res.ok) {
        setError(data.message || 'Thao tác thất bại');
        return;
      }

      // Xử lý khi Đăng nhập HOẶC Đăng ký thành công
      if (data.user || data.token) {
        // Lưu token và thông tin user vào LocalStorage
        if (data.token) localStorage.setItem('token', data.token);
        if (data.user) localStorage.setItem('user', JSON.stringify(data.user));

        // Thông báo cập nhật phiên làm việc lên App.jsx
        onLoginSuccess(data.user || { email: formData.email });
        onClose();
      } else {
        setError('Server không trả về dữ liệu tài khoản hợp lệ');
      }

    } catch (err) {
      console.error('Lỗi AuthModal:', err);
      setError('Không thể kết nối tới server (kiểm tra Backend port 3001)');
    }
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <h2>{isLogin ? 'Đăng Nhập' : 'Đăng Ký Tài Khoản'}</h2>
        
        {error && <p style={{ color: '#ff4d4f', fontSize: '14px', marginBottom: '8px' }}>{error}</p>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {!isLogin && (
            <input
              type="text"
              placeholder="Tên người dùng"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
              style={inputStyle}
            />
          )}

          <input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            style={inputStyle}
          />

          <input
            type="password"
            placeholder="Mật khẩu"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
            style={inputStyle}
          />

          <button type="submit" style={submitButtonStyle}>
            {isLogin ? 'Đăng Nhập' : 'Đăng Ký & Đăng Nhập'}
          </button>
        </form>

        <p style={{ marginTop: '16px', fontSize: '13px', textAlign: 'center', cursor: 'pointer', color: '#1677ff' }}
           onClick={() => { setError(''); setIsLogin(!isLogin); }}>
          {isLogin ? 'Chưa có tài khoản? Đăng ký ngay' : 'Đã có tài khoản? Đăng nhập'}
        </p>

        <button onClick={onClose} style={closeButtonStyle}>Đóng</button>
      </div>
    </div>
  );
}

const modalOverlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex',
  justifyContent: 'center', alignItems: 'center', zIndex: 1000
};

const modalContentStyle = {
  backgroundColor: '#1f2937', color: '#fff', padding: '24px',
  borderRadius: '8px', width: '360px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
};

const inputStyle = {
  padding: '10px', borderRadius: '4px', border: '1px solid #374151',
  backgroundColor: '#111827', color: '#fff', fontSize: '14px'
};

const submitButtonStyle = {
  padding: '10px', backgroundColor: '#1677ff', color: '#fff',
  border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
};

const closeButtonStyle = {
  marginTop: '8px', width: '100%', padding: '6px',
  backgroundColor: 'transparent', color: '#9ca3af', border: 'none', cursor: 'pointer'
};