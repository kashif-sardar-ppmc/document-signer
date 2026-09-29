import {
  appName,
  smtpenable,
  updateMailCount,
  brandLogoUrl,
  brandColor,
  brandSoftBg,
  brandBorder,
  brandTextColor,
} from '../../Utils.js';
async function getDocument(docId) {
  try {
    const query = new Parse.Query('contracts_Document');
    query.equalTo('objectId', docId);
    query.include('ExtUserPtr');
    query.include('CreatedBy');
    query.include('Signers');
    query.include('AuditTrail.UserPtr');
    query.include('ExtUserPtr.TenantId');
    query.include('Placeholders');
    query.notEqualTo('IsArchive', true);
    const res = await query.first({ useMasterKey: true });
    const _res = res?.toJSON();
    return _res?.ExtUserPtr?.objectId;
  } catch (err) {
    console.log('err ', err);
  }
}
async function sendMailOTPv1(request) {
  try {
    let code = Math.floor(1000 + Math.random() * 9000);
    let email = request.params.email;
    let TenantId = request.params.TenantId ? request.params.TenantId : undefined;
    const AppName = appName;

    if (email) {
      const recipient = request.params.email;
      const mailsender = smtpenable ? process.env.SMTP_USER_EMAIL : process.env.MAILGUN_SENDER;
      try {
        await Parse.Cloud.sendEmail({
          sender: AppName + ' <' + mailsender + '>',
          recipient: recipient,
          subject: `Your ${AppName} OTP`,
          text: 'otp email',
          html:
            `<html><head><meta http-equiv='Content-Type' content='text/html;charset=UTF-8' /></head><body><div style='background-color:${brandSoftBg};padding:24px 12px;font-family:Arial, Helvetica, sans-serif;'><div style='max-width:480px;margin:0 auto;background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid ${brandBorder};'><div style='padding:20px 24px;border-bottom:3px solid ${brandColor};'><img src='${brandLogoUrl}' alt='${AppName}' height='44' style='display:block;border:0;' /></div><div style='background-color:${brandColor};padding:14px 24px;'><p style='margin:0;font-size:18px;font-weight:600;color:#ffffff;'>OTP Verification</p></div><div style='padding:28px 24px;text-align:center;'><p style='margin:0 0 12px 0;font-family:Arial, Helvetica, sans-serif;font-size:14px;color:${brandTextColor};'>Your OTP for ${AppName} verification is:</p><p style='letter-spacing:6px;font-weight:bold;color:${brandColor};font-size:38px;margin:12px 0 0 0;'>` +
            code +
            '</p></div></div></div></body></html>',
        });
        console.log('OTP sent', code);
        if (request.params?.docId) {
          const extUserId = await getDocument(request.params?.docId);
          if (extUserId) {
            updateMailCount(extUserId);
          }
        }
      } catch (err) {
        console.log('error in send OTP mail', err);
      }
      const tempOtp = new Parse.Query('defaultdata_Otp');
      tempOtp.equalTo('Email', email);
      const resultOTP = await tempOtp.first({ useMasterKey: true });
      // console.log('resultOTP', resultOTP);
      if (resultOTP !== undefined) {
        const updateOtpQuery = new Parse.Query('defaultdata_Otp');
        const updateOtp = await updateOtpQuery.get(resultOTP.id, {
          useMasterKey: true,
        });
        updateOtp.set('OTP', code);
        updateOtp.save(null, { useMasterKey: true });
        //   console.log("update otp Res in tempSendOtp ", updateRes);
      } else {
        const otpClass = Parse.Object.extend('defaultdata_Otp');
        const newOtpQuery = new otpClass();
        newOtpQuery.set('OTP', code);
        newOtpQuery.set('Email', email);
        newOtpQuery.set('TenantId', TenantId);
        await newOtpQuery.save(null, { useMasterKey: true });
        //   console.log("new otp Res in tempSendOtp ", newRes);
      }
      return 'Otp send';
    } else {
      return 'Please Enter valid email';
    }
  } catch (err) {
    console.log('err in sendMailOTPv1');
    console.log(err);
    return err;
  }
}
export default sendMailOTPv1;
