import { Request, Response } from 'express';

// 1. Định nghĩa kiểu dữ liệu User cho TypeScript
interface User {
  id: string;
  username: string;
  email: string;
  password?: string;
  usdtBalance: number;
  btcBalance: number;
}

// 2. Khai báo mảng users nằm ngoài hàm để lưu danh sách người dùng tạm thời
const users: User[] = [];

// ==========================================
// 3. EXPORT REGISTER CONTROLLER
// ==========================================
export const register = async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ 
        message: 'Vui lòng nhập đầy đủ Username, Email và Mật khẩu!' 
      });
    }

    const existingUser = users.find((u: User) => u.email === email || u.username === username);
    if (existingUser) {
      return res.status(400).json({ 
        message: 'Username hoặc Email đã tồn tại!' 
      });
    }

    const newUser: User = {
      id: `USR_${Date.now()}`,
      username,
      email,
      password, // Trong thực tế nên dùng bcrypt để mã hóa
      usdtBalance: 100000.00,
      btcBalance: 1.50,
    };

    users.push(newUser);

    // Chuẩn hóa dữ liệu trả về (ẩn mật khẩu)
    const { password: _, ...userWithoutPassword } = newUser;

    return res.status(200).json({
      message: 'Đăng ký thành công!',
      user: userWithoutPassword,
      token: `mock-jwt-token-${newUser.id}`
    });

  } catch (error: any) {
    console.error('Lỗi register:', error);
    return res.status(500).json({ 
      message: 'Lỗi Server khi đăng ký: ' + (error.message || 'Không xác định') 
    });
  }
};

// ==========================================
// 4. EXPORT LOGIN CONTROLLER
// ==========================================
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password, username } = req.body;
    const identity = email || username;

    if (!identity || !password) {
      return res.status(400).json({ 
        message: 'Vui lòng nhập đầy đủ Email/Username và Mật khẩu!' 
      });
    }

    const user = users.find((u: User) => u.email === identity || u.username === identity);

    if (!user) {
      return res.status(404).json({ 
        message: 'Tài khoản hoặc Email không tồn tại!' 
      });
    }

    if (user.password && user.password !== password) {
      return res.status(400).json({ 
        message: 'Mật khẩu không chính xác!' 
      });
    }

    const { password: _, ...userWithoutPassword } = user;

    return res.status(200).json({
      message: 'Đăng nhập thành công!',
      user: userWithoutPassword,
      token: `mock-jwt-token-${user.id}`
    });

  } catch (error: any) {
    console.error('Lỗi login:', error);
    return res.status(500).json({ 
      message: 'Lỗi Server khi đăng nhập: ' + (error.message || 'Không xác định') 
    });
  }
};

// ==========================================
// 5. EXPORT GETPROFILE CONTROLLER
// ==========================================
export const getProfile = async (req: Request, res: Response) => {
  try {
    // req.user thường được gắn từ middleware authenticateToken
    const userReq = (req as any).user;
    
    if (!userReq) {
      return res.status(401).json({ message: 'Không tìm thấy thông tin xác thực' });
    }

    const user = users.find((u: User) => u.id === userReq.id || u.email === userReq.email);

    if (!user) {
      return res.status(404).json({ message: 'Người dùng không tồn tại' });
    }

    const { password: _, ...userWithoutPassword } = user;
    return res.status(200).json({ user: userWithoutPassword });

  } catch (error: any) {
    return res.status(500).json({ message: 'Lỗi Server: ' + error.message });
  }
};