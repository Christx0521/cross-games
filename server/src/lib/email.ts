import { Resend } from "resend";
import { env } from "../config/env.ts";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function sendVerificationCode(to: string, code: string): Promise<void> {
  if (!resend) {
    console.log(`[email:dev] ${to} -> código ${code}`);
    return;
  }
  await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: "Tu código de verificación de Cross-Games",
    text: `Tu código es ${code}. Expira en 15 minutos.`,
  });
}
