import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

export const generateInvoicePDF = async ({
  purchase,
  tax,
  user,
  service,
}) => {
  return new Promise((resolve, reject) => {
    try {
      const fileName = `invoice_${purchase._id}.pdf`;
      const filePath = path.join("uploads", fileName);

      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      // Header
      doc.fontSize(20).text("INVOICE", { align: "center" });
      doc.moveDown();

      // User info
      doc.fontSize(12).text(`Customer: ${user.name}`);
      doc.text(`Email: ${user.email}`);
      doc.text(`Phone: ${user.phone || "-"}`);
      doc.moveDown();

      // Purchase info
      doc.text(`Invoice ID: ${purchase._id}`);
      doc.text(`Date: ${new Date().toLocaleDateString()}`);
      doc.moveDown();

      // Service table
      doc.text("Service Details", { underline: true });
      doc.moveDown(0.5);

      doc.text(`Service: ${service.name}`);
      doc.text(`Price: ₹${service.price}`);
      doc.text(`+GST: ₹${tax.toFixed(2)}`);
      doc.text(`Amount Paid: ₹${purchase.amountPaid.toFixed(2)}`);
      doc.text(`Payment Method: ${purchase.paymentMethod}`);

      doc.moveDown();
      doc.text("Thank you for your purchase!", { align: "center" });

      doc.end();

      stream.on("finish", () => resolve(filePath));
      stream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
};