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

      // --- COMPANY BRANDING & OFFICIAL INFO ---
      // Using the official name from the COI: PHONEPHIXER PRIVATE LIMITED
      doc.fillColor("#2d3436").fontSize(20).text("PHONEPHIXER PRIVATE LIMITED", { align: "left" }); // 
      
      doc.fontSize(9).fillColor("#636e72");
      // Official Registered Address from COI
      doc.text("24, Chetany Vihar, Trivani, 10B Scheme, Gopalpura,"); // 
      doc.text("Durgapura, Jaipur, Rajasthan - 302018"); // 
      
      doc.moveDown(0.5);
      // Legally required identifiers
      doc.text(`CIN: U95120RJ2026PTC110366`); // 
      doc.text(`PAN: AAQCP5502R`); // 
      doc.text("Email: phonephixerr@gmail.com");

      // --- INVOICE HEADER ---
      doc.fillColor("#000000").fontSize(24).text("TAX INVOICE", 400, 50, { align: "right" });
      doc.fontSize(10).text(`Invoice No: INV-${purchase._id.toString().slice(-6).toUpperCase()}`, { align: "right" });
      doc.text(`Date: ${new Date().toLocaleDateString()}`, { align: "right" });

      doc.moveDown(2);
      doc.moveTo(50, 160).lineTo(550, 160).stroke("#dfe6e9"); 
      doc.moveDown(1);

      // --- BILLING SECTION ---
      const startY = doc.y;
      doc.fontSize(11).fillColor("#2d3436").text("BILL TO:", 50, startY, { characterSpacing: 1 });
      doc.fontSize(11).fillColor("#000000").text(user.name || "Customer");
      doc.fontSize(10).fillColor("#636e72").text(user.email);
      doc.text(user.phone || "-");

      doc.fontSize(11).fillColor("#2d3436").text("TRANSACTION DETAILS:", 300, startY, { characterSpacing: 1 });
      doc.fontSize(10).fillColor("#000000").text(`Payment Method: ${purchase.paymentMethod}`, 300);
      doc.text(`Status: Paid`, 300);

      doc.moveDown(2);

      // --- ITEMS TABLE ---
      const tableHeaderY = doc.y;
      doc.rect(50, tableHeaderY, 500, 20).fill("#f8f9fa");
      doc.fillColor("#2d3436").fontSize(10).text("DESCRIPTION", 60, tableHeaderY + 6);
      doc.text("AMOUNT (INR)", 450, tableHeaderY + 6, { align: "right" });

      doc.moveDown(1);
      const itemY = doc.y + 5;
      doc.fillColor("#000000").text(service.name, 60, itemY);
      doc.text(`₹${service.price.toFixed(2)}`, 450, itemY, { align: "right" });
      
      doc.moveDown(1);
      doc.fillColor("#636e72").text("Tax / GST", 60);
      doc.text(`₹${tax.toFixed(2)}`, 450, doc.y, { align: "right" });

      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke("#dfe6e9");
      doc.moveDown(0.5);

      // --- TOTAL ---
      doc.fontSize(14).fillColor("#2d3436").text("TOTAL AMOUNT", 60);
      doc.fillColor("#000000").text(`₹${purchase.amountPaid.toFixed(2)}`, 450, doc.y, { align: "right" });

      // --- FOOTER & LEGAL ---
      doc.moveDown(5);
      doc.fontSize(10).fillColor("#2d3436").text("Terms & Conditions:", { underline: true });
      doc.fontSize(8).fillColor("#636e72").text("1. This is a computer-generated invoice and does not require a physical signature.");
      // Referencing the MOA objects for repair services
      doc.text("2. Warranty is valid only on serviced components as per company repair policy."); // [cite: 3]
      
      doc.moveDown(2);
      doc.fontSize(10).fillColor("#2d3436").text("Thank you for choosing Phonephixer Private Limited!", { align: "center" });

      doc.end();

      stream.on("finish", () => resolve(filePath));
      stream.on("error", reject);
    } catch (err) {
      reject(err);
    }
  });
};