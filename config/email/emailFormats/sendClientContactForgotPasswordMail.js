import { sendEmailWithResend } from "../sendEmailWithResend.js"

export async function sendForgotPasswordMail(recipient, link) {
    
    const message = `<p>Click <a href="${link}">Here</a></p>`
    
    await sendEmailWithResend(recipient, 'Reset Forgotten Password', message)
}

