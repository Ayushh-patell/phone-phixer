import nodemailer from "nodemailer";

// export const transporter = nodemailer.createTransport({
//   host: process.env.SMTP_HOST,
//   port: parseInt(process.env.SMTP_PORT),  // 465
//   secure: true,                           // true for 465
//   auth: {
//     user: process.env.SMTP_USER,
//     pass: process.env.SMTP_PASS
//   },
// });
export const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.FROM, pass: process.env.FROMPASSWORD },
});