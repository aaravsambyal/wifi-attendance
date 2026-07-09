const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET =
  process.env.JWT_SECRET || "supersecretjwtkey_replace_in_prod";

const authMiddleware = async (req, res, next) => {
  try {
    const token =
      req.cookies.jwt || req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      if (req.path.startsWith("/api")) {
        return res.status(401).json({ error: "Authentication required" });
      }
      return res.redirect("/login");
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      throw new Error();
    }

    req.token = token;
    req.user = user;

    res.locals.user = user;

    next();
  } catch (error) {
    if (req.path.startsWith("/api")) {
      return res.status(401).json({ error: "Please authenticate." });
    }
    res.redirect("/login");
  }
};

const adminMiddleware = async (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).send("Access denied. Admin only.");
  }
};

module.exports = { authMiddleware, adminMiddleware };
