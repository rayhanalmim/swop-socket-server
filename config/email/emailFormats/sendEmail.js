import { sendEmailWithResend } from "../sendEmailWithResend.js"

export async function sendEmployeeInvitationEmail(recipient, link) {

    const message = `<p>Click <a href="${link}">Here</a><br> Valid For 24 Hours</p>`

    await sendEmailWithResend(recipient, 'Test Starter', message)

}