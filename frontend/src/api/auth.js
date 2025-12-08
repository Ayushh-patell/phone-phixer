// src/api/auth.js
const BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

async function handleResponse(res, defaultMessage) {
  if (!res.ok) {
    let message = defaultMessage;
    try {
      const data = await res.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(message);
  }
  return res.json();
}

export async function login(email, password) {
  const res = await fetch(`${BASE_URL}/users/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  return handleResponse(res, "Login failed");
}

export async function verifyToken(token) {
  const res = await fetch(`${BASE_URL}/users/verify-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse(res, "Token verification failed");
}

// 🔹 REGISTER USER → /users/register
// Now supports phone, address, deviceBrand, deviceModel, deviceImei, referralCode
export async function registerUser({
  name,
  email,
  password,
  referralCode,
  phone,
  address,
  deviceBrand,
  deviceModel,
  deviceImei,
}) {
  const body = {
    name,
    email,
    password,
  };

  if (referralCode) body.referralCode = referralCode;
  if (phone) body.phone = phone;
  if (address) body.address = address;
  if (deviceBrand) body.deviceBrand = deviceBrand;
  if (deviceModel) body.deviceModel = deviceModel;
  if (deviceImei) body.deviceImei = deviceImei;

  const res = await fetch(`${BASE_URL}/users/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  // Backend returns: { message: "User created", userId: "<id>" }
  return handleResponse(res, "Registration failed");
}

// 🔹 SEND EMAIL VERIFICATION → /users/send-email-verification
export async function sendEmailVerification(userId) {
  const res = await fetch(`${BASE_URL}/users/send-email-verification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });

  return handleResponse(res, "Failed to send verification email");
}

// 🔹 VERIFY EMAIL CODE → /users/verify-code
export async function verifyEmailCode({ userId, code }) {
  const res = await fetch(`${BASE_URL}/users/verify-code`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, code }),
  });

  return handleResponse(res, "Verification failed");
}

// 🔹 SEND AADHAAR OTP → /users/aadhaar/send-otp
export async function sendAadhaarOtp({ userId, aadhaarNumber }) {
  const res = await fetch(`${BASE_URL}/users/aadhaar/send-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, aadhaarNumber }),
  });

  return handleResponse(res, "Failed to send Aadhaar OTP");
}

// 🔹 VERIFY AADHAAR OTP → /users/aadhaar/verify-otp
export async function verifyAadhaarOtp({ userId, otp }) {
  const res = await fetch(`${BASE_URL}/users/aadhaar/verify-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, otp }),
  });

  return handleResponse(res, "Failed to verify Aadhaar OTP");
}
