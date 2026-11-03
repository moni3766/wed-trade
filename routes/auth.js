const express = require('express');
const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin!" });
    }

    const newUser = {
      id: "USR_" + Date.now(),
      username,
      email,
      usdtBalance: 100000.00,
      btcBalance: 1.50
    };

    return res.status(200).json({
      message: "Đăng ký thành công!",
      user: newUser,
      token: "jwt-token-example"
    });
  } catch (error) {
    console.error("Lỗi đăng ký:", error);
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;