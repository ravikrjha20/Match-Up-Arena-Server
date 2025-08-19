const {createJWT,isTokenValid,attachCookiesToResponse} = require('./jwt');
const createTokenUser= require('./createTokenUser');
const checkPermissions=require('./checkPermissions');
const sendVerificationEmail=require('./sendVerificationEmail');
const sendPartnerVerificationEmail = require("./sendPartnerVerificationEmail");
const sendResetPasswordEmail=require('./sendResetPasswordEmail');
const createHash=require('./createHash');
const sendContactUsEmail = require(`./sendContactUsEmail`);

module.exports ={createJWT,isTokenValid,attachCookiesToResponse,createTokenUser,checkPermissions,sendVerificationEmail,sendResetPasswordEmail,createHash,sendContactUsEmail,sendPartnerVerificationEmail};