import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";
import userRoutes from "./routes/userRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import referralRoutes from "./routes/referralRoutes.js";
import settingsRoutes from "./routes/universalSettingsRoutes.js";
import checkRoutes from "./routes/checkRoutes.js";



// Initialize App
const app = express();

// Connect MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json()); // parse JSON body

// Test Route
app.get("/", (req, res) => {
  res.send("Backend is running...");
});

app.use("/api/users", userRoutes);
app.use("/api/service", serviceRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/referrals", referralRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/checks", checkRoutes);


// Start Server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
