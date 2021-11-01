import * as PDFDocument from 'pdfkit';
import { ASSETS_DIR } from '../var/env.config';
import { get_data_value, intval, number_format } from "../helpers/misc";
import { APP_NAME } from '../var/config';

export default class PdfCreator {
    constructor() {

    }
    public create_invoice_pdf = async (item: any) => {
        const fs = require('fs');

        let user_info = item['user_info'];
        let invoice_id = item['invoice_number'];
        let invoice_file_name = "HLX-Invoice-" + invoice_id + ".pdf";
        let invoice_path = "assets/global/invoice/" + invoice_file_name;
        let logo_path = "assets/global/img/logo-invoice.jpg";
        let paid_img_path = "assets/global/img/paid-img.png";
        if (ASSETS_DIR !== "") {
            invoice_path = ASSETS_DIR + "/global/invoice/" + invoice_file_name;
            logo_path = ASSETS_DIR + "/global/img/logo-invoice.jpg";
            paid_img_path = ASSETS_DIR + "/global/img/paid-img.png";
        }

        if (fs.existsSync(invoice_path)) {
            // path exists
            console.log("invoice exists:", invoice_path);
            return [invoice_path, invoice_file_name];
        }

        const pagePaddingX = 40;
        const pagePaddingY = 50;

        // Create a document
        //const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({
            size: 'A5', margins: {
                top: pagePaddingY,
                bottom: pagePaddingY,
                left: pagePaddingX,
                right: pagePaddingX
            }
        });
        //A5: 419.53 x 595.28
        const pageWidth = 419
        const pageHeight = 595
        const pageInnerWidth = pageWidth - 2 * pagePaddingX
        const pageInnerHeight = pageHeight - 2 * pagePaddingY
        const pageLeftSideWidth = intval(pageInnerWidth * 0.67)
        const pageRightSideWidth = pageInnerWidth - pageLeftSideWidth
        const pageRightSideX = pageLeftSideWidth + pagePaddingX

        const mainFontColor = '#000000';
        const grayFontColor = '#777777';
        const mainFont = 'Helvetica';
        const mainFontBold = 'Helvetica-Bold';
        const mainFontSize = 12;
        const smallFontSize = 9;
        const titleFontSize = 20;
        const subTitleFontSize = 14;

        let curX = pagePaddingX;
        let curY = pagePaddingY;

        // Pipe its output somewhere, like to a file or HTTP response
        // See below for browser usage
        doc.pipe(fs.createWriteStream(invoice_path));

        // Embed a font, set the font size, and render some text

        // doc
        //   .font('fonts/PalatinoBold.ttf')
        //   .fontSize(25)
        //   .text('Some text with an embedded font!', 100, 100);

        // Add an image, constrain it to a given size, and center it vertically and horizontally
        doc.image(logo_path, pagePaddingX - 3, curY, { width: 150 })


        //////////////////////////////////////////////////////Billl from//////////////////////////////////////////////////////////
        curY += 67;
        doc.fontSize(mainFontSize).font(mainFont).fillColor(grayFontColor).text("Bill from:", pagePaddingX, curY, {
            width: pageLeftSideWidth,
            align: 'left'
        });
        curY += 30;
        doc.fontSize(subTitleFontSize).font(mainFontBold).fillColor(mainFontColor).text("HL4X International LLC", pagePaddingX, curY, {
            width: pageLeftSideWidth,
            align: 'left'
        });
        curY += 24;
        doc.fontSize(smallFontSize).font(mainFont).fillColor(mainFontColor).text("Hunkins Waterfont Plazza", pagePaddingX, curY, {
            width: pageLeftSideWidth,
            align: 'left'
        });
        curY += smallFontSize + 3;
        doc.fontSize(smallFontSize).font(mainFont).fillColor(mainFontColor).text("Suit 556,", pagePaddingX, curY, {
            width: pageLeftSideWidth,
            align: 'left'
        });
        curY += smallFontSize + 3;
        doc.fontSize(smallFontSize).font(mainFont).fillColor(mainFontColor).text("Main Street,", pagePaddingX, curY, {
            width: pageLeftSideWidth,
            align: 'left'
        });
        curY += smallFontSize + 3;
        doc.fontSize(smallFontSize).font(mainFont).fillColor(mainFontColor).text("Charlestown, Nevis,", pagePaddingX, curY, {
            width: pageLeftSideWidth,
            align: 'left'
        });
        curY += smallFontSize + 3;
        doc.fontSize(smallFontSize).font(mainFont).fillColor(mainFontColor).text("West indies", pagePaddingX, curY, {
            width: pageLeftSideWidth,
            align: 'left'
        });
        curY += smallFontSize + 3;
        doc.fontSize(smallFontSize).font(mainFont).fillColor(mainFontColor).text("Website: higherlevelfx.com", pagePaddingX, curY, {
            width: pageLeftSideWidth,
            align: 'left',
            link: 'https://higherlevelfx.com/',
            underline: true
        });

        ///////////////////////////////////////////////////////Bill to/////////////////////////////////////////////////////////
        curY += 40;
        doc.fontSize(mainFontSize).font(mainFont).fillColor(grayFontColor).text("Bill to:", pagePaddingX, curY, {
            width: pageLeftSideWidth,
            align: 'left'
        });
        curY += 24;
        doc.fontSize(smallFontSize).font(mainFontBold).fillColor(mainFontColor).text("First Name: ", pagePaddingX, curY, {
            align: 'left',
            continued: true
        }).font(mainFont).text(user_info['user_first_name']);
        curY += smallFontSize + 3;
        doc.fontSize(smallFontSize).font(mainFontBold).fillColor(mainFontColor).text("Last Name: ", pagePaddingX, curY, {
            align: 'left',
            continued: true
        }).font(mainFont).text(user_info['user_last_name']);
        curY += smallFontSize + 3;
        doc.fontSize(smallFontSize).font(mainFontBold).fillColor(mainFontColor).text("Email: ", pagePaddingX, curY, {
            align: 'left',
            continued: true
        }).font(mainFont).text(user_info['user_email']);


        /////////////////////////////////////////////////////line////////////////////////////////////////////////////////////////
        curY += 40;
        let linePosY = curY
        doc.moveTo(pagePaddingX + 2, curY)
            .lineTo(pagePaddingX + pageInnerWidth - 2, curY)
            .stroke()

        //////////////////////////////////////////////////////description/////////////////////////////////////////////////////////
        curY += 30;
        doc.fontSize(mainFontSize).font(mainFontBold).fillColor(mainFontColor).text("Description:", pagePaddingX, curY, {
            align: 'left'
        });
        curY += 24;
        let description = "";
        if (item['trans_type'] === 'Membership') {
            let exp_days = 7;
            if(intval(item['expire_days']) > 0) {
                exp_days = item['expire_days'];
            }
            description = APP_NAME + " " + exp_days + "-Day Trial";
        } else if (item['trans_type'] === 'Membership (Rebill)') {
            description = APP_NAME + " Membership - " + "Full Access to Educational Videos and software";
        } else if (item['trans_type'] === 'Affiliate Package' || item['trans_type'] === 'Affiliate Package (Rebill)') {
            description = APP_NAME + " - Affiliate Upgrade";
        }

        doc.fontSize(smallFontSize).font(mainFont).fillColor(mainFontColor).text(description, pagePaddingX, curY, {
            width: pageLeftSideWidth,
            align: 'left'
        });


        ////////////////////////////////////////////////////right side///////////////////////////////////////////////////////////
        curX = pageRightSideX;
        curY = pagePaddingY;
        curY += 17;
        doc.fontSize(titleFontSize).font(mainFontBold).text("INVOICE", curX, curY, {
            width: pageRightSideWidth,
            align: 'left'
        });

        curY += 50;
        doc.fontSize(smallFontSize).font(mainFont).fillColor(mainFontColor).text("Order #" + item['invoice_number'], curX, curY, {
            width: pageRightSideWidth,
            align: 'left'
        });
        curY += 30;
        doc.fontSize(mainFontSize).font(mainFont).fillColor(grayFontColor).text("Date:", curX, curY, {
            width: pageRightSideWidth,
            align: 'left'
        });
        curY += 30;
        doc.fontSize(smallFontSize).font(mainFont).fillColor(mainFontColor).text(item['payment_date'], curX, curY, {
            width: pageRightSideWidth,
            align: 'left'
        });

        /////////////////////////////////////////////////////////Amount//////////////////////////////////////////////////////////
        curY = linePosY;
        curY += 30;
        doc.fontSize(mainFontSize).font(mainFontBold).fillColor(mainFontColor).text("Amount:", curX, curY, {
            width: pageRightSideWidth,
            align: 'left'
        });
        curY += 24;
        let transaction_amount = intval(item['paid_amount']);
        doc.fontSize(smallFontSize).font(mainFont).fillColor(mainFontColor).text("SubTotal: $" + transaction_amount, curX, curY, {
            width: pageRightSideWidth,
            align: 'left'
        });
        curY += smallFontSize + 3;
        doc.fontSize(smallFontSize).font(mainFont).fillColor(mainFontColor).text("Total: $" + transaction_amount, curX, curY, {
            width: pageRightSideWidth,
            align: 'left'
        });

        if (item['trans_type'] !== 'Membership') {
            curY += smallFontSize + 3;
            doc.fontSize(smallFontSize).font(mainFont).fillColor(mainFontColor).text("Recurring SubTotal: $" + transaction_amount, curX, curY, {
                width: pageRightSideWidth,
                align: 'left'
            });
            curY += smallFontSize + 3;
            doc.fontSize(smallFontSize).font(mainFont).fillColor(mainFontColor).text("Recurring Total: $" + transaction_amount, curX, curY, {
                width: pageRightSideWidth,
                align: 'left'
            });
        }

        ///////////////////////////////////////////////////////////paid img ////////////////////////////////////////////////////////////
        curY += 40;
        doc.image(paid_img_path, pagePaddingX, curY, { fit: [pageInnerWidth, 70], align: 'center', valign: 'center' })

        // Finalize PDF file
        doc.end();

        return [invoice_path, invoice_file_name];
    }

    public create_invoice_pdf2 = async (invoice_id: string, invoice_type: string = "membership") => {
        let invoice_file_name = "invoice-" + invoice_id + ".pdf";
        let invoice_path = "assets/global/invoice/" + invoice_file_name;
        let logo_path = "assets/global/img/logo-invoice.jpg";
        if (ASSETS_DIR !== "") {
            invoice_path = ASSETS_DIR + "/global/invoice/" + invoice_file_name;
            logo_path = ASSETS_DIR + "/global/img/logo-invoice.jpg";
        }

        const pagePaddingX = 40;
        const pagePaddingY = 60;


        const fs = require('fs');

        // Create a document
        //const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({
            size: 'A5', margins: {
                top: pagePaddingY,
                bottom: pagePaddingY,
                left: pagePaddingX,
                right: pagePaddingX
            }
        });
        //A5: 419.53 x 595.28
        const pageWidth = 419
        const pageHeight = 595
        const pageInnerWidth = pageWidth - 2 * pagePaddingX
        const pageInnerHeight = pageHeight - 2 * pagePaddingY
        const pageLeftSideWidth = intval(pageInnerWidth * 0.67)
        const pageRightSideWidth = pageInnerWidth - pageLeftSideWidth
        const pageRightSideX = pageLeftSideWidth + pagePaddingX

        const mainFontColor = '#000000';
        const grayFontColor = '#777777';
        const mainFont = 'Helvetica';
        const mainFontBold = 'Helvetica-Bold';
        const mainFontSize = 12;
        const smallFontSize = 9;
        const titleFontSize = 20;
        const subTitleFontSize = 14;


        let curX = pagePaddingX;
        let curY = pagePaddingY;


        // Pipe its output somewhere, like to a file or HTTP response
        // See below for browser usage
        doc.pipe(fs.createWriteStream(invoice_path));

        // Embed a font, set the font size, and render some text

        // doc
        //   .font('fonts/PalatinoBold.ttf')
        //   .fontSize(25)
        //   .text('Some text with an embedded font!', 100, 100);

        // Add an image, constrain it to a given size, and center it vertically and horizontally
        doc.image(logo_path, pagePaddingX - 3, curY, { width: 150 })


        //////////////////////////////////////////////////////Billl from//////////////////////////////////////////////////////////
        curY += 67;
        doc.fontSize(mainFontSize).font(mainFont).fillColor(grayFontColor).text("Bill from:", pagePaddingX, curY, {
            width: pageLeftSideWidth,
            align: 'left'
        });
        curY += 40;
        doc.fontSize(subTitleFontSize).font(mainFontBold).fillColor(mainFontColor).text("HL4X International LLC", pagePaddingX, curY, {
            width: pageLeftSideWidth,
            align: 'left'
        });
        curY += 24;
        doc.fontSize(smallFontSize).font(mainFont).fillColor(mainFontColor).text("Hunkins Waterfont Plazza", pagePaddingX, curY, {
            width: pageLeftSideWidth,
            align: 'left'
        });
        curY += smallFontSize + 3;
        doc.fontSize(smallFontSize).font(mainFont).fillColor(mainFontColor).text("Suit 556", pagePaddingX, curY, {
            width: pageLeftSideWidth,
            align: 'left'
        });
        curY += smallFontSize + 3;
        doc.fontSize(smallFontSize).font(mainFont).fillColor(mainFontColor).text("Main Street", pagePaddingX, curY, {
            width: pageLeftSideWidth,
            align: 'left'
        });
        curY += smallFontSize + 3;
        doc.fontSize(smallFontSize).font(mainFont).fillColor(mainFontColor).text("www.example.com", pagePaddingX, curY, {
            width: pageLeftSideWidth,
            align: 'left',
            link: 'http://www.example.com',
            underline: true
        });

        ///////////////////////////////////////////////////////Bill to/////////////////////////////////////////////////////////
        curY += 40;
        doc.fontSize(mainFontSize).font(mainFont).fillColor(grayFontColor).text("Bill to:", pagePaddingX, curY, {
            width: pageLeftSideWidth,
            align: 'left'
        });
        curY += 24;
        doc.fontSize(smallFontSize).font(mainFontBold).fillColor(mainFontColor).text("First Name: ", pagePaddingX, curY, {
            align: 'left',
            continued: true
        }).font(mainFont).text("John");
        curY += smallFontSize + 3;
        doc.fontSize(smallFontSize).font(mainFontBold).fillColor(mainFontColor).text("Last Name: ", pagePaddingX, curY, {
            align: 'left',
            continued: true
        }).font(mainFont).text("Travolta");
        curY += smallFontSize + 3;
        doc.fontSize(smallFontSize).font(mainFontBold).fillColor(mainFontColor).text("Email: ", pagePaddingX, curY, {
            align: 'left',
            continued: true
        }).font(mainFont).text("averagejoe@gmail.com");


        /////////////////////////////////////////////////////line////////////////////////////////////////////////////////////////
        curY += 40;
        let linePosY = curY
        doc.moveTo(pagePaddingX + 2, curY)
            .lineTo(pagePaddingX + pageInnerWidth - 2, curY)
            .stroke()

        //////////////////////////////////////////////////////description/////////////////////////////////////////////////////////
        curY += 30;
        doc.fontSize(mainFontSize).font(mainFontBold).fillColor(mainFontColor).text("Description:", pagePaddingX, curY, {
            align: 'left'
        });
        curY += 24;
        doc.fontSize(smallFontSize).font(mainFont).fillColor(mainFontColor).text("Higher Level FX Membership - Full Access to Educational Videos and software.", pagePaddingX, curY, {
            width: pageLeftSideWidth,
            align: 'left'
        });


        ////////////////////////////////////////////////////right side///////////////////////////////////////////////////////////
        curX = pageRightSideX;
        curY = pagePaddingY;
        curY += 17;
        doc.fontSize(titleFontSize).font(mainFontBold).text("INVOICE", curX, curY, {
            width: pageRightSideWidth,
            align: 'left'
        });

        curY += 50;
        doc.fontSize(smallFontSize).font(mainFont).fillColor(mainFontColor).text("Order #6634545684", curX, curY, {
            width: pageRightSideWidth,
            align: 'left'
        });
        curY += 30;
        doc.fontSize(mainFontSize).font(mainFont).fillColor(grayFontColor).text("Date:", curX, curY, {
            width: pageRightSideWidth,
            align: 'left'
        });
        curY += 30;
        doc.fontSize(smallFontSize).font(mainFont).fillColor(mainFontColor).text("2021/04/02", curX, curY, {
            width: pageRightSideWidth,
            align: 'left'
        });

        /////////////////////////////////////////////////////////Amount//////////////////////////////////////////////////////////
        curY = linePosY;
        curY += 30;
        doc.fontSize(mainFontSize).font(mainFontBold).fillColor(mainFontColor).text("Amount:", curX, curY, {
            width: pageRightSideWidth,
            align: 'left'
        });
        curY += 24;
        doc.fontSize(smallFontSize).font(mainFont).fillColor(mainFontColor).text("SubTotal: $159", curX, curY, {
            width: pageRightSideWidth,
            align: 'left'
        });
        curY += smallFontSize + 3;
        doc.fontSize(smallFontSize).font(mainFont).fillColor(mainFontColor).text("Total: $159", curX, curY, {
            width: pageRightSideWidth,
            align: 'left'
        });
        curY += smallFontSize + 3;
        doc.fontSize(smallFontSize).font(mainFont).fillColor(mainFontColor).text("Recurring SubTotal: $159", curX, curY, {
            width: pageRightSideWidth,
            align: 'left'
        });
        curY += smallFontSize + 3;
        doc.fontSize(smallFontSize).font(mainFont).fillColor(mainFontColor).text("Recurring Total: $159", curX, curY, {
            width: pageRightSideWidth,
            align: 'left'
        });

        // Finalize PDF file
        doc.end();

        return invoice_path;
    }

    public create_invoice_pdf1 = async (invoice_id: string, invoice_type: string = "membership") => {
        let invoice_file_name = "invoice-" + invoice_id + ".pdf";
        let invoice_path = "assets/global/invoice/" + invoice_file_name;
        let logo_path = "assets/global/img/logo-invoice.jpg";
        if (ASSETS_DIR !== "") {
            invoice_path = ASSETS_DIR + "/global/invoice/" + invoice_file_name;
            logo_path = ASSETS_DIR + "/global/img/logo-invoice.jpg";
        }

        const fs = require('fs');
        //const PDFDocument = require('pdfkit');
        // Create a document
        const doc = new PDFDocument();

        // Pipe its output somewhere, like to a file or HTTP response
        // See below for browser usage
        doc.pipe(fs.createWriteStream(invoice_path));

        // Embed a font, set the font size, and render some text

        // doc
        //   .font('fonts/PalatinoBold.ttf')
        //   .fontSize(25)
        //   .text('Some text with an embedded font!', 100, 100);

        // Add an image, constrain it to a given size, and center it vertically and horizontally
        doc.image(logo_path, {
            fit: [250, 300],
            align: 'center',
            valign: 'center'
        });

        // Add another page
        doc
            .addPage()
            .fontSize(25)
            .text('Here is some vector graphics...', 100, 100);

        // Draw a triangle
        doc
            .save()
            .moveTo(100, 150)
            .lineTo(100, 250)
            .lineTo(200, 250)
            .fill('#FF3300');

        // Apply some transforms and render an SVG path with the 'even-odd' fill rule
        doc
            .scale(0.6)
            .translate(470, -380)
            .path('M 250,75 L 323,301 131,161 369,161 177,301 z')
            .fill('red', 'even-odd')
            .restore();

        // Add some text with annotations
        doc
            .addPage()
            .fillColor('blue')
            .text('Here is a link!', 100, 100)
            .underline(100, 100, 160, 27, { color: '#0000FF' })
            .link(100, 100, 160, 27, 'http://google.com/');

        // Finalize PDF file
        doc.end();

        return invoice_path;
    }

}

export const pdfCreator = new PdfCreator()