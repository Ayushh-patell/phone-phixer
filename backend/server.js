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


// SANDBOX_API_KEY=key_live_56edec1c46d64864b2476e7772611d01
// SANDBOX_API_SECRET=secret_live_0d36edf5b93c43f48d85ef05d7eaf8ea

// SANDBOX_API_KEY=key_test_6ea009ecdf4d4d99948c03ca1f5c90c4
// SANDBOX_API_SECRET=secret_test_1dd21ee2ef514444b3c7138665aac10f