import {
  appName,
  brandLogoUrl,
  brandColor,
  brandSoftBg,
  brandBorder,
  brandTextColor,
  brandMutedTextColor,
} from '../../Utils.js';
import sendMailWithAttachment from './sendMailWithAttachment.js';

export default async function forwardDoc(request) {
  try {
    if (!request.user) {
      throw new Parse.Error(Parse.Error.INVALID_SESSION_TOKEN, 'unauthorized.');
    }
    const { docId, recipients } = request.params;
    const isReceipents = recipients?.length > 0 && recipients?.length <= 10;
    if (docId && isReceipents) {
      const userPtr = { __type: 'Pointer', className: '_User', objectId: request.user.id };
      const docQuery = new Parse.Query('contracts_Document');
      docQuery
        .equalTo('objectId', docId)
        .equalTo('CreatedBy', userPtr)
        .notEqualTo('IsArchive', true)
        .notEqualTo('IsDeclined', true)
        .include('Signers')
        .include('ExtUserPtr')
        .include('Placeholders.signerPtr')
        .include('ExtUserPtr.TenantId');
      const docRes = await docQuery.first({ useMasterKey: true });
      if (!docRes) {
        throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Document not found.');
      }
      const _docRes = docRes?.toJSON();
      const docName = _docRes.Name;
      const extUserId = _docRes?.ExtUserPtr?.objectId;
      const TenantAppName = appName;
      const from = _docRes?.SenderName || _docRes?.ExtUserPtr?.Email;
      const replyTo = _docRes?.SenderMail || _docRes?.ExtUserPtr?.Email;
      const senderName = _docRes?.SenderName || _docRes?.ExtUserPtr?.Name;

      try {
        let mailRes;
        for (let i = 0; i < recipients.length; i++) {
          const logo = `<div style='padding:20px 24px;border-bottom:3px solid ${brandColor};'><img src='${brandLogoUrl}' alt='${TenantAppName}' height='44' style='display:block;border:0;'/></div>`;

          let params = {
            extUserId: extUserId,
            pdfName: docName,
            url: _docRes?.SignedUrl || '',
            recipient: recipients[i],
            subject: `${senderName} has signed the doc - ${docName}`,
            replyto: replyTo || '',
            from: from,
            html:
              `<html><head><meta http-equiv='Content-Type' content='text/html; charset=UTF-8'/></head><body><div style='background-color:${brandSoftBg};padding:24px 12px;font-family:Arial, Helvetica, sans-serif;'><div style='max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid ${brandBorder};'>` +
              `${logo}<div style='background-color:${brandColor};padding:14px 24px;'><p style='margin:0;font-size:18px;font-weight:600;color:#ffffff;'>Document Copy</p></div><div style='padding:28px 24px;'>` +
              `<p style='margin:0;font-size:14px;color:${brandTextColor};line-height:1.6;'>A copy of the document <strong>${docName}</strong> is attached to this email. Kindly download the document from the attachment.</p>` +
              `</div><div style='background-color:${brandSoftBg};padding:14px 24px;border-top:1px solid ${brandBorder};'><p style='margin:0 0 4px 0;font-size:11px;color:${brandMutedTextColor};'>This is an automated email from ${TenantAppName}. For any queries regarding this email, please contact the sender ${replyTo} directly.</p><p style='margin:0;font-size:11px;color:${brandMutedTextColor};'>Power Planning &amp; Monitoring Company &middot; Ministry of Energy &middot; Govt. of Pakistan</p></div></div></div></body></html>`,
          };
          mailRes = await sendMailWithAttachment(params);
          // console.log('mailRes', mailRes);
        }
        return mailRes;
      } catch (error) {
        const msg =
          error?.response?.data?.error ||
          error?.response?.data ||
          error?.message ||
          'Something went wrong.';
        throw new Parse.Error(400, msg);
      }
    } else {
      throw new Parse.Error(Parse.Error.INVALID_QUERY, 'please provide parameters.');
    }
  } catch (err) {
    console.log('Err in forwardDoc', err);
    throw err;
  }
}
