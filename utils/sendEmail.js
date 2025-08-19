const nodemailer=require('nodemailer');
const nodemailerConfig=require('./nodemailerConfig');
const sendEmail = async({to,html,subject})=>{
    const transporter=nodemailer.createTransport(nodemailerConfig);
    
    return transporter.sendMail({
        from:'"Smart Parking System" <smart.parking.system.v1@gmail.com>',
        to,subject,html
    });
}

// sendEmail({to:`guptanirwan@gmail.com`, html:`<h1>Hello from SMART PARKING SYSTEM V1</h1>`, subject:`Hello from SMART-PARKING`});

module.exports=sendEmail;

// require('dotenv').config();
// const nodemailer = require(`nodemailer`);
// const {google} = require(`googleapis`);

// const CLIENT_ID = process.env.CLIENT_ID;
// const CLIENT_SECRET = process.env.CLIENT_SECRET;
// const REDIRECT_URI = process.env.REDIRECT_URI;
// const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

// const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
// oAuth2Client.setCredentials({refresh_token: REFRESH_TOKEN});

// const sendEmail = async({to, subject, html}) => {
//     try {
//         console.log(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, REFRESH_TOKEN);
//         const accessToken = await oAuth2Client.getAccessToken();
//         console.log(accessToken, accessToken.token);
        
//         const transporter = nodemailer.createTransport({
//             service: `gmail`,
//             auth: {
//                 type: `OAuth2`,
//                 user: `smart.parking.system.v1@gmail.com`,
//                 clientId: CLIENT_ID,
//                 clientSecret: CLIENT_SECRET,
//                 refreshToken: REFRESH_TOKEN,
//                 accessToken,
//             },
//         });
//         const mailOptions = {
//             from: `Smart Parking System <codeforces@gmail.com>`,
//             to: to,
//             subject: subject,
//             html: html,
//         };
//         const result = await transporter.sendMail(mailOptions);
//         return result;
//     } catch (error) {
//         console.log(error);
//     }
// }

// sendEmail({to: `jhakrravi20@gmail.com`, subject: `Hello from SMART-PARKING`, html: '<h1>Hello from SMART PARKING SYSTEM V1</h1>'});