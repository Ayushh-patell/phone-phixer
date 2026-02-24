import nodemailer from "nodemailer";

export const sendInvoiceEmail = async ({
  to,
  name,
  invoicePath,
}) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: `"Support" <${process.env.SMTP_USER}>`,
    to,
    subject: "Your Invoice",
    html: `<p>Hello ${name},</p>
           <p>Please find your invoice attached.</p>`,
    attachments: [
      {
        filename: "invoice.pdf",
        path: invoicePath,
      },
    ],
  });
};