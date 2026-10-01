import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
	host: process.env.SMTP_HOST,
	port: Number(process.env.SMTP_PORT ?? 465),
	secure: true,
	auth: {
		user: process.env.SMTP_USER,
		pass: process.env.SMTP_PASS,
	},
});

interface SendMailOptions {
	to: string;
	subject: string;
	html: string;
}

export async function sendMail({ to, subject, html }: SendMailOptions) {
	return transporter.sendMail({
		from: `"CEMAS" <${process.env.SMTP_USER}>`,
		to,
		subject,
		html,
	});
}
