import jwt from 'jsonwebtoken';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_change_me";

export default async function handler(req, res) {
  const isProd = process.env.NODE_ENV === "production";
  const cookieOptions = `HttpOnly; Path=/; Max-Age=3600; SameSite=Lax${isProd ? "; Secure" : ""}`;

  // 登入 (POST)
  if (req.method === "POST") {
    const { password } = req.body || {};
    if (password === ADMIN_PASSWORD) {
      const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '1h' });
      res.setHeader("Set-Cookie", `admin_token=${token}; ${cookieOptions}`);
      return res.status(200).json({ ok: true });
    }
    return res.status(401).json({ error: "密碼錯誤" });
  }

  // 檢查 Session (GET)
  if (req.method === "GET") {
    const cookie = req.headers.cookie || "";
    const token = cookie.split("; ").find(row => row.startsWith("admin_token="))?.split("=")[1];
    if (!token) return res.status(200).json({ admin: false });

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      return res.status(200).json({ admin: !!decoded.admin });
    } catch {
      return res.status(200).json({ admin: false });
    }
  }

  // 登出 (DELETE)
  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", `admin_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${isProd ? "; Secure" : ""}`);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
