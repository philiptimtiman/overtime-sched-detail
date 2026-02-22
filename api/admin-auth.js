// api/admin-auth.js
// Simple serverless admin auth using a server-side password (stored in Vercel env var).
// POST { password } -> sets an HttpOnly cookie on success
// GET -> returns { admin: true|false } based on cookie
// DELETE -> clears the cookie (logout)

export default async function handler(req, res) {
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: "Server not configured" });
  }

  if (req.method === "POST") {
    try {
      const { password } = req.body || {};
      if (!password) return res.status(400).json({ error: "Missing password" });

      if (password === ADMIN_PASSWORD) {
        // Create a short-lived base64 token (for simplicity)
        const payload = { admin: true, iat: Date.now() };
        const token = Buffer.from(JSON.stringify(payload)).toString("base64");

        // Set HttpOnly cookie, 1 hour expiry
        const secureFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";
        res.setHeader(
          "Set-Cookie",
          `admin_token=${token}; HttpOnly; Path=/; Max-Age=3600; SameSite=Lax${secureFlag}`
        );

        return res.status(200).json({ ok: true });
      } else {
        return res.status(401).json({ error: "Invalid password" });
      }
    } catch (err) {
      console.error("POST /api/admin-auth error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }

  if (req.method === "DELETE") {
    const secureFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";
    res.setHeader(
      "Set-Cookie",
      `admin_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secureFlag}`
    );
    return res.status(200).json({ ok: true });
  }

  if (req.method === "GET") {
    try {
      const cookie = req.headers.cookie || "";
      const match = cookie.split(";").map(s => s.trim()).find(s => s.startsWith("admin_token="));
      if (!match) return res.status(200).json({ admin: false });

      const token = match.split("=")[1];
      const payload = JSON.parse(Buffer.from(token, "base64").toString("utf8"));
      // optional expiry check (1 hour)
      const ageSeconds = (Date.now() - (payload.iat || 0)) / 1000;
      if (ageSeconds > 3600) return res.status(200).json({ admin: false });

      return res.status(200).json({ admin: !!payload.admin });
    } catch (err) {
      return res.status(200).json({ admin: false });
    }
  }

  res.setHeader("Allow", "GET, POST, DELETE");
  res.status(405).end("Method Not Allowed");
}