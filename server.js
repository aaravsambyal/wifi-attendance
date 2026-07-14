// Core Dependencies and Models
require("dotenv").config();
const express = require("express");
const mongoose = require("./lib/mongoose-mock");
const os = require("os");

function getNetworkInterfaces() {
  const interfaces = os.networkInterfaces();
  const list = [];
  if (process.env.HOST_IP) {
    list.push({
      name: "Host WiFi",
      address: process.env.HOST_IP,
      internal: false,
    });
  }
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4") {
        if (
          iface.address !== "127.0.0.1" &&
          iface.address !== process.env.HOST_IP
        ) {
          list.push({
            name: name,
            address: iface.address,
            internal: iface.internal,
          });
        }
      }
    }
  }
  return list;
}

function getWifiDetails() {
  try {
    const { execSync } = require("child_process");
    const output = execSync(
      "nmcli -t -f active,ssid,bssid dev wifi | grep '^yes'",
      { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] },
    ).trim();
    if (output) {
      // Split on colon ONLY if not escaped/not inside BSSID part (negative lookbehind check)
      // Matches colons not preceded by a backslash or within hex pairs of BSSID
      const parts = output.split(/(?<!\\):/);
      if (parts.length >= 2) {
        const ssid = parts[1].replace(/\\:/g, ":");
        // Reconstruct bssid from remainder parts
        const bssid = parts.slice(2).join(":").replace(/\\/g, "");
        return { ssid, bssid };
      }
    }
  } catch (e) {}
  return { ssid: "WiFi Network", bssid: "Active" };
}

function getFirstNetworkIp() {
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

function isSameNetwork(ipA, ipB) {
  if (!ipA || !ipB) return false;
  const cleanA = ipA.replace("::ffff:", "").trim();
  const cleanB = ipB.replace("::ffff:", "").trim();
  if (cleanA === cleanB) return true;

  // Local loopback checks
  const isLoopback = (ip) => ip === "127.0.0.1" || ip === "localhost";
  if (isLoopback(cleanA) && isLoopback(cleanB)) return true;

  // Verify they belong to the same IPv4 /24 subnet (matching first 3 octets)
  const partsA = cleanA.split(".");
  const partsB = cleanB.split(".");
  if (partsA.length === 4 && partsB.length === 4) {
    return (
      partsA[0] === partsB[0] &&
      partsA[1] === partsB[1] &&
      partsA[2] === partsB[2]
    );
  }
  return false;
}
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const QRCode = require("qrcode");
const path = require("path");

const JWT_SECRET =
  process.env.JWT_SECRET || "supersecretjwtkey_replace_in_prod";

const User = require("./models/User");
const Attendance = require("./models/Attendance");
const Poll = require("./models/Poll");
const Meeting = require("./models/Meeting");
const { authMiddleware, adminMiddleware } = require("./middleware/auth");

// App Initialization and Configuration
const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Enable trust proxy ONLY if environment variable is set to true
if (process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", true);
} else {
  app.set("trust proxy", false);
}

// Connect to MongoDB Database
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://mongodb:27017/attendance_db", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Error connecting to MongoDB:", err));

// Helper function to extract user IP safely
function getClientIp(req) {
  if (process.env.TRUST_PROXY === "true" && req.headers["x-forwarded-for"]) {
    return req.headers["x-forwarded-for"].split(",")[0].trim();
  }
  return req.socket.remoteAddress || req.ip;
}

// Authentication Routes (Login, Signup, Logout)
app.get("/", (req, res) => {
  if (req.cookies.jwt) return res.redirect("/dashboard");
  res.redirect("/login");
});

app.get("/login", (req, res) => res.render("login", { error: null }));
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await user.comparePassword(password))) {
      return res.render("login", { error: "Invalid user or password" });
    }
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "24h",
    });
    res.cookie("jwt", token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    res.redirect("/dashboard");
  } catch (err) {
    res.render("login", { error: "An error occurred" });
  }
});

app.get("/signup", (req, res) => res.render("signup", { error: null }));
app.post("/signup", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !username.trim() || !password || !password.trim()) {
      return res.render("signup", {
        error: "Username and password are required",
      });
    }
    const existingUser = await User.findOne({ username: username.trim() });
    if (existingUser) {
      return res.render("signup", { error: "Username exists or invalid" });
    }
    // Anyone can sign up and start meetings, removing optional admin role
    const user = new User({
      username: username.trim(),
      password,
      role: "user",
    });
    await user.save();
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "24h",
    });
    res.cookie("jwt", token, { httpOnly: true });
    res.redirect("/dashboard");
  } catch (err) {
    res.render("signup", { error: "Username exists or invalid" });
  }
});

// Handle User Logout
app.get("/logout", (req, res) => {
  res.clearCookie("jwt");
  res.redirect("/login");
});

// User Dashboard
app.get("/dashboard", authMiddleware, async (req, res) => {
  const hostedMeetings = await Meeting.find({ hostId: req.user._id }).sort({
    createdAt: -1,
  });
  const attendancesDoc = await Attendance.find({ userId: req.user._id })
    .populate("meetingId")
    .sort({ date: -1 });
  const attendedHistory = attendancesDoc
    .map((a) => ({
      meeting: a.meetingId,
      attendanceId: a._id,
    }))
    .filter((h) => h.meeting);

  const visitedHost = req.headers.host
    ? req.headers.host.split(":")[0]
    : "localhost";

  res.render("dashboard", {
    user: req.user,
    hostedMeetings,
    attendedHistory,
    message: req.query.message,
    error: req.query.error,
    clientIp: getClientIp(req),
    interfaces: getNetworkInterfaces(),
    visitedHost,
    wifi: getWifiDetails(),
  });
});

// Create a New Meeting Session
app.post("/meeting/create", authMiddleware, async (req, res) => {
  try {
    const title = req.body.title || "Untitled Meeting";
    let hostIp = req.body.hostIp;
    if (!hostIp || hostIp === "dynamic") {
      hostIp = getClientIp(req);
    }
    const meeting = new Meeting({ title, hostId: req.user._id, hostIp });
    await meeting.save();
    res.redirect("/meeting/" + meeting._id);
  } catch (err) {
    res.redirect("/dashboard?error=Failed to create meeting");
  }
});

app.get("/meeting/:id", authMiddleware, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id).populate(
      "hostId",
      "username",
    );
    if (!meeting) return res.redirect("/dashboard?error=Meeting not found");

    const attendances = await Attendance.find({
      meetingId: meeting._id,
    }).populate("userId", "username");
    const polls = await Poll.find({ meetingId: meeting._id })
      .sort({ createdAt: -1 })
      .populate(
        "votedUsers.userId",
        "username",
      );

    const isHost = meeting.hostId._id.toString() === req.user._id.toString();
    let userAttendance = attendances.find(
      (a) => {
        const aUid = (a.userId && (a.userId._id || a.userId)).toString();
        return aUid === req.user._id.toString();
      }
    );

    // Auto-mark attendance for non-host users entering the meeting room
    if (!isHost && !userAttendance && meeting.active) {
      const clientIpRaw = getClientIp(req) || "";
      const cleanClientIp = clientIpRaw.split(",")[0].trim();
      const cleanHostIp = (meeting.hostIp || "").split(",")[0].trim();

      if (isSameNetwork(cleanClientIp, cleanHostIp)) {
        const attendance = new Attendance({
          userId: req.user._id,
          meetingId: meeting._id,
          method: "wifi",
          ipAddress: clientIpRaw,
          log: [{ type: "join", timestamp: new Date() }],
        });
        await attendance.save();
        attendance.userId = { _id: req.user._id, username: req.user.username };
        attendances.push(attendance);
        userAttendance = attendance;
      }
    }

    // Access Control Check: Direct access to /meeting/:id by non-hosts requires recorded attendance
    if (!isHost && !userAttendance) {
      return res.redirect(
        `/dashboard?error=Attendance Denied! You are not on the same WiFi network as the Host or have not checked in.`
      );
    }

    // Generate QR for inline display
    const host = req.get("host");
    const qrUrl = `${req.protocol}://${host}/join/${meeting._id}`;
    const qrImage = await QRCode.toDataURL(qrUrl);

    res.render("meeting_room", {
      user: req.user,
      meeting,
      isHost,
      attendances,
      polls,
      userAttendance,
      message: req.query.message,
      error: req.query.error,
      clientIp: getClientIp(req),
      url_origin: `${req.protocol}://${req.get("host")}`,
      qrImage,
      qrUrl,
    });
  } catch (err) {
    res.redirect("/dashboard?error=Invalid Meeting");
  }
});

// Delete an Entire Meeting
app.post("/meeting/:id/delete", authMiddleware, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.redirect("/dashboard?error=Meeting not found");
    if (meeting.hostId.toString() !== req.user._id.toString()) {
      return res.redirect("/dashboard?error=Unauthorized deletion");
    }

    await Attendance.deleteMany({ meetingId: meeting._id });
    await Poll.deleteMany({ meetingId: meeting._id });
    await Meeting.findByIdAndDelete(req.params.id);

    res.redirect("/dashboard?message=Meeting deleted successfully");
  } catch (err) {
    res.redirect("/dashboard?error=Failed to delete meeting");
  }
});

app.post("/attendance/:id/delete", authMiddleware, async (req, res) => {
  try {
    const att = await Attendance.findById(req.params.id);
    if (!att)
      return res.redirect("/dashboard?error=Attendance record not found");
    if (att.userId.toString() !== req.user._id.toString()) {
      return res.redirect("/dashboard?error=Unauthorized deletion");
    }

    await Attendance.findByIdAndDelete(req.params.id);
    res.redirect("/dashboard?message=Removed from your history");
  } catch (err) {
    res.redirect("/dashboard?error=Failed to remove history");
  }
});

// Generate Meeting QR Code
app.get("/meeting/:id/qr", authMiddleware, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).send("Meeting not found");

    // Dynamic Host QR Injection
    const host = req.get("host");
    const qrUrl = `${req.protocol}://${host}/join/${meeting._id}`;
    const qrImage = await QRCode.toDataURL(qrUrl);

    res.render("qr", { qrImage, meeting, qrUrl });
  } catch (err) {
    res.status(500).send("Error generating QR");
  }
});

// Join Meeting with WiFi Validation
app.get("/join/:id", authMiddleware, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.redirect("/dashboard?error=Meeting not found");
    if (!meeting.active)
      return res.redirect(
        "/dashboard?error=This meeting has ended and attendance is closed.",
      );

    const existing = await Attendance.findOne({
      userId: req.user._id,
      meetingId: meeting._id,
    });
    if (existing) {
      if (existing.leaveDate) {
        // Re-joining a meeting they left
        existing.leaveDate = undefined;
        existing.log.push({ type: "join", timestamp: new Date() });
        await existing.save();
        return res.redirect(
          `/meeting/${meeting._id}?message=Successfully Re-joined`,
        );
      }
      return res.redirect(
        `/meeting/${meeting._id}?message=Successfully Joined`,
      );
    }

    // Method selection (wifi default)
    const method = "wifi";
    const clientIpRaw = getClientIp(req) || "";
    const cleanClientIp = clientIpRaw.split(",")[0].trim();
    const cleanHostIp = (meeting.hostIp || "").split(",")[0].trim();

    // STRICT MATCHING for WiFi
    if (!isSameNetwork(cleanClientIp, cleanHostIp)) {
      return res.redirect(
        `/dashboard?error=Attendance Denied! You are not on the same WiFi network as the Host. (Host Network IP: ${cleanHostIp}, Your IP: ${cleanClientIp})`,
      );
    }

    const attendance = new Attendance({
      userId: req.user._id,
      meetingId: meeting._id,
      method: method,
      ipAddress: clientIpRaw,
      log: [{ type: "join", timestamp: new Date() }],
    });
    await attendance.save();

    res.redirect(`/meeting/${meeting._id}?message=Successfully Joined`);
  } catch (err) {
    res.redirect("/dashboard?error=Failed to join meeting");
  }
});

// Mark Attendance Record as Left
app.post("/meeting/:id/leave", authMiddleware, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.redirect("/dashboard?error=Meeting not found");

    const attendance = await Attendance.findOne({
      userId: req.user._id,
      meetingId: meeting._id,
    });
    if (!attendance)
      return res.redirect(
        `/meeting/${meeting._id}?error=Attendance record not found`,
      );

    if (!attendance.leaveDate) {
      attendance.leaveDate = new Date();
      attendance.log.push({ type: "leave", timestamp: new Date() });
      await attendance.save();
      res.redirect(`/meeting/${meeting._id}?message=Successfully Left`);
    } else {
      res.redirect(`/meeting/${meeting._id}?error=Already left`);
    }
  } catch (err) {
    res.redirect(`/meeting/${meeting._id}?error=An error occurred`);
  }
});

app.post("/meeting/:id/poll", authMiddleware, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (meeting.hostId.toString() !== req.user._id.toString())
      return res.status(403).send("Unauthorized");

    const { question, options } = req.body;
    const optionsArray = options
      .split("\n")
      .map((opt) => ({ text: opt.trim(), votes: 0 }))
      .filter((opt) => opt.text);

    const poll = new Poll({
      meetingId: meeting._id,
      question,
      options: optionsArray,
      votedUsers: [],
    });
    await poll.save();
    res.redirect(`/meeting/${meeting._id}?message=Poll created`);
  } catch (err) {
    res.redirect(`/meeting/${req.params.id}?error=Error creating poll`);
  }
});

app.post("/vote", authMiddleware, async (req, res) => {
  try {
    const { pollId, optionId, meetingId } = req.body;
    const poll = await Poll.findById(pollId);
    if (!poll)
      return res.redirect(`/meeting/${meetingId}?error=Poll not found`);

    const hasVoted = (poll.votedUsers || []).some(
      (v) => v.userId.toString() === req.user._id.toString(),
    );
    if (hasVoted)
      return res.redirect(`/meeting/${meetingId}?error=Already voted`);

    const option = poll.options.id(optionId);
    if (!option)
      return res.redirect(`/meeting/${meetingId}?error=Option not valid`);

    option.votes += 1;
    if (!poll.votedUsers) poll.votedUsers = [];
    poll.votedUsers.push({ userId: req.user._id, optionId: optionId });
    await poll.save();
    res.redirect(`/meeting/${meetingId}?message=Vote Cast successfully`);
  } catch (err) {
    res.redirect("/dashboard?error=Failed to vote");
  }
});

app.post("/meeting/:id/end", authMiddleware, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (meeting.hostId.toString() !== req.user._id.toString())
      return res.status(403).send("Unauthorized");

    meeting.active = false;
    await meeting.save();
    res.redirect(`/meeting/${meeting._id}?message=Meeting ended successfully`);
  } catch (err) {
    res.redirect(`/meeting/${req.params.id}?error=Error ending meeting`);
  }
});

// Meeting Data API for Live Refresh
app.get("/meeting/:id/api/data", authMiddleware, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ error: "Not found" });

    const attendances = await Attendance.find({ meetingId: meeting._id })
      .populate("userId", "username")
      .sort({ date: -1 });
    const polls = await Poll.find({ meetingId: meeting._id })
      .sort({ createdAt: -1 })
      .populate(
        "votedUsers.userId",
        "username",
      );

    res.json({
      active: meeting.active,
      attendances,
      polls,
      userId: req.user._id,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Initialize Server and Listen
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log("\n==================================================");
  console.log("📶 WiFi Attendance System Access Links:");
  console.log(`  👉 Local Access:   http://localhost:${PORT}`);

  const networkIp = process.env.HOST_IP || getFirstNetworkIp();
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
  if (railwayDomain) {
    console.log(`  👉 Deployed URL:   https://${railwayDomain}`);
  } else {
    console.log(`  👉 Over WiFi:      http://${networkIp}:${PORT}`);
  }

  console.log("\n  💡 How to find your computer's WiFi IP:");
  console.log("     🐧 Linux:   Run 'ip addr'");
  console.log("     🍎 macOS:   Run 'ipconfig getifaddr en0'");
  console.log("     🪟 Windows: Run 'ipconfig' in CMD");
  console.log("==================================================\n");
});
