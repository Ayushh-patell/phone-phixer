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

    const uploadDir = path.join(process.cwd(), "uploads");

    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

      const fileName = `invoice_${purchase._id}.pdf`;
      const filePath = path.join("uploads", fileName);

      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);
// Branding Header
      doc.fillColor("#2d3436").fontSize(20).text("PHONE PHIXER", { align: "left" });
      doc.fontSize(10).fillColor("#636e72");
      doc.text("139, Avadhpuri - II, Near Mahesh Nagar Phatak");
      doc.text("Jaipur - 302015");
      doc.text("Email: phonephixerr@gmail.com");
      
      // Right-aligned Invoice Title
      doc.fillColor("#000000").fontSize(24).text("INVOICE", 400, 50, { align: "right" });
      doc.fontSize(10).text(`ID: ${purchase._id}`, { align: "right" });
      doc.text(`Date: ${new Date().toLocaleDateString()}`, { align: "right" });

      doc.moveDown(2);
      doc.moveTo(50, 130).lineTo(550, 130).stroke(); // Horizontal Line
      doc.moveDown(1);

      // Bill To & Service Info Columns
      const startY = doc.y;
      doc.fontSize(12).fillColor("#2d3436").text("BILL TO:", 50, startY, { underline: true });
      doc.fontSize(11).fillColor("#000000");
      doc.text(user.name);
      doc.text(user.email);
      doc.text(user.phone || "-");

      doc.fontSize(12).fillColor("#2d3436").text("SERVICE DETAILS:", 300, startY, { underline: true });
      doc.fontSize(11).fillColor("#000000");
      doc.text(`Item: ${service.name}`, 300);
      doc.text(`Method: ${purchase.paymentMethod}`, 300);

      doc.moveDown(3);

      // Pricing Table/Summary
      const tableTop = doc.y;
      doc.moveTo(50, tableTop).lineTo(550, tableTop).stroke();
      
      doc.moveDown(0.5);
      doc.fontSize(11).text("Description", 50);
      doc.text("Amount", 450, doc.y, { align: "right" });
      
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke("#ecf0f1");
      
      doc.moveDown(1);
      doc.text(service.name, 50);
      doc.text(`₹${service.price.toFixed(2)}`, 450, doc.y, { align: "right" });
      
      doc.text("GST (Tax)", 50);
      doc.text(`₹${tax.toFixed(2)}`, 450, doc.y, { align: "right" });

      doc.moveDown(1);
      doc.fontSize(14).fillColor("#2d3436").text("Total Amount Paid", 50);
      doc.text(`₹${purchase.amountPaid.toFixed(2)}`, 450, doc.y, { align: "right" });

      // Footer
      doc.moveDown(4);
      doc.fontSize(10).fillColor("#636e72").text("Thank you for choosing Phone Phixer!", { align: "center" });
      doc.text("Please keep this invoice for warranty purposes.", { align: "center" });

      doc.end();

      stream.on("finish", () => resolve(filePath));
      stream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
};