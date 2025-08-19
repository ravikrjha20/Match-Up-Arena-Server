const sendEmail = require('./sendEmail');
const sendContactUsEmail = async ({name, email, subject, message, userId}) => {
    return sendEmail({
        to: 'lostandfound748@gmail.com',
        subject: subject,
        html: `<h2>Name: ${name}<br>UserID: ${userId}<br>Email: ${email}</h2><br><br><h2>message: ${message}</h2>`,
    });
}
module.exports = sendContactUsEmail;