import { Pool } from 'pg';

export const db = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || '127.0.0.1',
  database: process.env.DB_NAME || 'cex_db',
  password: process.env.DB_PASSWORD || '111111', // 👈 Thay '111111' bằng mật khẩu đăng nhập pgAdmin
  port: Number(process.env.DB_PORT) || 5432,
  max: 20,
  idleTimeoutMillis: 30000,
});

db.on('connect', () => {
  console.log('🐘 Đã kết nối thành công tới CSDL PostgreSQL (cex_db)');
});

db.on('error', (err) => {
  console.error('❌ Lỗi kết nối PostgreSQL:', err);
});