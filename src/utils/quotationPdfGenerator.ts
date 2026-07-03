import { jsPDF } from "jspdf";

const fmt = (n: number) =>
    (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

interface PDFOptions {
    projectName: string;
    projectDate?: string;
    customer: {
        name: string;
        phonenumber?: string | null;
        email?: string | null;
        address?: string | null;
    };
    creatorName: string;
    products: Array<{
        productName: string;
        brandName?: string;
        area: number;
        unit: string;
        rate: number;
        total: number;
    }>;
    summary: {
        subtotal: number;
        tax: number; // percentage
        taxAmount: number;
        discount: number;
        discountType: "amount" | "percent";
        discountAmount: number;
        agreedPrice: number;
    };
}

export function generateQuotationPDF(options: PDFOptions) {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
    });

    const pageW = 210;
    const pageH = 297;
    const margin = 15;
    const contentW = pageW - margin * 2; // 180mm

    let pageNum = 1;

    const drawHeader = (doc: jsPDF) => {
        // Company Title
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text("SAHANI PAINTS", margin, 22);

        // Company Subtitle
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105); // slate-600
        doc.text("Premium Paint Solutions & Decorators", margin, 27);

        // Document Type
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(14, 165, 233); // sky-500
        doc.text("QUOTATION", pageW - margin, 22, { align: "right" });

        // Divider
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.setLineWidth(0.4);
        doc.line(margin, 31, pageW - margin, 31);
    };

    const drawFooter = (doc: jsPDF, isLastPage = false) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text("Sahani Paints · Confidential Quotation", margin, pageH - 10);
        doc.text(`Page ${pageNum}`, pageW - margin, pageH - 10, { align: "right" });

        if (isLastPage) {
            doc.setFont("helvetica", "italic");
            doc.text("Thank you for choosing Sahani Paints!", pageW / 2, pageH - 15, { align: "center" });
        }
    };

    drawHeader(doc);
    drawFooter(doc);

    let currentY = 38;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text("QUOTED TO:", margin, currentY);
    doc.text("DETAILS:", 125, currentY);

    currentY += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);

    // Quote To column
    doc.setFont("helvetica", "bold");
    doc.text(options.customer.name, margin, currentY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);

    let phoneY = currentY + 4.5;
    if (options.customer.phonenumber) {
        doc.text(`Phone: +91 ${options.customer.phonenumber}`, margin, phoneY);
        phoneY += 4.5;
    }
    if (options.customer.address) {
        const addrLines = doc.splitTextToSize(options.customer.address, 80);
        addrLines.forEach((ln: string) => {
            doc.text(ln, margin, phoneY);
            phoneY += 4.5;
        });
    }

    // Details Column
    doc.text("Project:", 125, currentY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(options.projectName, pageW - margin, currentY, { align: "right" });
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text("Date:", 125, currentY + 4.5);
    const dateStr = options.projectDate
        ? new Date(options.projectDate).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        })
        : new Date().toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    doc.setTextColor(15, 23, 42);
    doc.text(dateStr, pageW - margin, currentY + 4.5, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text("Created By:", 125, currentY + 9);
    doc.setTextColor(15, 23, 42);
    doc.text(options.creatorName || "Sales Executive", pageW - margin, currentY + 9, { align: "right" });

    // Position Y for the table
    currentY = Math.max(phoneY + 5, currentY + 18);

    // Draw table header
    doc.setFillColor(248, 250, 252); // slate-50
    doc.rect(margin, currentY, contentW, 8, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    
    doc.text("Product Description", margin + 3, currentY + 5.5);
    doc.text("Area", margin + 85, currentY + 5.5, { align: "right" });
    doc.text("Unit", margin + 110, currentY + 5.5, { align: "right" });
    doc.text("Rate", margin + 140, currentY + 5.5, { align: "right" });
    doc.text("Total", margin + 175, currentY + 5.5, { align: "right" });

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, currentY + 8, pageW - margin, currentY + 8);

    currentY += 8;

    // Table rows
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);

    options.products.forEach((p, idx) => {
        // Page overflow check
        if (currentY > pageH - 45) {
            drawFooter(doc);
            doc.addPage();
            pageNum++;
            drawHeader(doc);
            currentY = 38;

            // Redraw table header on new page
            doc.setFillColor(248, 250, 252);
            doc.rect(margin, currentY, contentW, 8, "F");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(71, 85, 105);
            
            doc.text("Product Description", margin + 3, currentY + 5.5);
            doc.text("Area", margin + 85, currentY + 5.5, { align: "right" });
            doc.text("Unit", margin + 110, currentY + 5.5, { align: "right" });
            doc.text("Rate", margin + 140, currentY + 5.5, { align: "right" });
            doc.text("Total", margin + 175, currentY + 5.5, { align: "right" });

            doc.setDrawColor(226, 232, 240);
            doc.line(margin, currentY + 8, pageW - margin, currentY + 8);

            currentY += 8;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(15, 23, 42);
        }

        const nameStr = p.brandName ? `[${p.brandName}] ${p.productName}` : p.productName;
        
        doc.text(nameStr, margin + 3, currentY + 5);
        doc.text(fmt(p.area), margin + 85, currentY + 5, { align: "right" });
        doc.text(p.unit, margin + 110, currentY + 5, { align: "right" });
        doc.text(p.rate != null ? `₹${fmt(p.rate)}` : "—", margin + 140, currentY + 5, { align: "right" });
        doc.text(`₹${fmt(p.total)}`, margin + 175, currentY + 5, { align: "right" });

        doc.line(margin, currentY + 8, pageW - margin, currentY + 8);
        currentY += 8;
    });

    // Summary Section
    currentY += 4;
    
    // Draw summary container box on the right
    const summaryX = 110;
    const summaryW = pageW - margin - summaryX;

    // Check if summary fits, otherwise page break
    if (currentY > pageH - 55) {
        drawFooter(doc);
        doc.addPage();
        pageNum++;
        drawHeader(doc);
        currentY = 38;
    }

    doc.setDrawColor(241, 245, 249);
    doc.setFillColor(250, 250, 250);
    doc.rect(summaryX, currentY, summaryW, 35, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);

    let sY = currentY + 5;
    doc.text("Subtotal (Total Charges):", summaryX + 3, sY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`₹${fmt(options.summary.subtotal)}`, pageW - margin - 3, sY, { align: "right" });

    sY += 5.5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`Tax (${options.summary.tax}%):`, summaryX + 3, sY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`+ ₹${fmt(options.summary.taxAmount)}`, pageW - margin - 3, sY, { align: "right" });

    sY += 5.5;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    const discLabel = options.summary.discountType === "percent" ? `Discount (${options.summary.discount}%):` : "Discount:";
    doc.text(discLabel, summaryX + 3, sY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 38, 38); // red-600
    doc.text(`- ₹${fmt(options.summary.discountAmount)}`, pageW - margin - 3, sY, { align: "right" });

    sY += 6.5;
    doc.setDrawColor(226, 232, 240);
    doc.line(summaryX + 2, sY - 2, pageW - margin - 2, sY - 2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(79, 70, 229); // indigo-600
    doc.text("Total Agreed Price:", summaryX + 3, sY + 2);
    doc.text(`₹${fmt(options.summary.agreedPrice)}`, pageW - margin - 3, sY + 2, { align: "right" });

    drawFooter(doc, true);

    const safeName = options.projectName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    doc.save(`quotation_${safeName}.pdf`);
}
