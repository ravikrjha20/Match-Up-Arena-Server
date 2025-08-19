const sendEmail = require("./sendEmail");

const sendPartnerVerificationEmail = async ({ id, name, email, origin, role }) => {
  const partnerFormLink = `${origin}/verify-partner?email=${email}&id=${id}`;

  const message = `<p>Please click the link below to complete the partner verification form:</p>
                   <p><a href="${partnerFormLink}">Complete Partner Form</a></p>`;

  return sendEmail({
    to: email,
    subject: "Complete Your Partner Verification Form",
    html: `<h4>Hello ${name},</h4>
           ${message}
           <br/>
           <p>If you did not request this, please ignore this email.</p>`,
  });
};

module.exports = sendPartnerVerificationEmail;
