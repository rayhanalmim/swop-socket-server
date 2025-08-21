import { Resend } from 'resend'

export async function sendEmailWithResend(recipients, subject, emailBody) {

  const resend = new Resend(process.env.RESEND_API_KEY)

  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_SENDER,
    to: recipients,
    subject,
    html: emailBody,
  })

  if (error) {
    return console.error({ error })
  }

  console.log(`Email sent: ${data.id}`)
}