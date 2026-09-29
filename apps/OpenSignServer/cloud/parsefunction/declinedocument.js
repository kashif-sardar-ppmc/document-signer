import {
  appName,
  brandLogoUrl,
  brandColor,
  brandSoftBg,
  brandBorder,
  brandTextColor,
  brandMutedTextColor,
} from '../../Utils.js';
import sendSystemMail from './sendSystemMail.js';

const declineColor = '#B3261E';

async function sendDeclineMail(doc, publicUrl, userId, reason) {
  try {
    const TenantAppName = appName;
    const logo = `<div style='padding:20px 24px;border-bottom:3px solid ${brandColor};'><img src='${brandLogoUrl}' alt='${TenantAppName}' height='44' style='display:block;border:0;'/></div>`;

    const removePrefill =
      doc?.Placeholders?.length > 0 && doc?.Placeholders?.filter(x => x?.Role !== 'prefill');
    const signUser =
      removePrefill?.length > 0 &&
      removePrefill?.find(x => x?.signerPtr?.UserId?.objectId === userId);

    const sender = doc.ExtUserPtr;
    const pdfName = doc.Name;
    const creatorName = doc.ExtUserPtr.Name;
    const creatorEmail = doc.ExtUserPtr.Email;
    const signerName = signUser?.signerPtr?.Name || '';
    const signerEmail = signUser?.signerPtr?.Email || signUser?.email || '';
    const viewDocUrl = `${publicUrl}/recipientSignPdf/${doc.objectId}`;
    const subject = `Document "${pdfName}" has been declined by ${signerName}`;
    const body =
      `<html><head><meta http-equiv='Content-Type' content='text/html; charset=UTF-8'/></head><body><div style='background-color:${brandSoftBg};padding:24px 12px;font-family:Arial, Helvetica, sans-serif;'><div style='max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid ${brandBorder};'>` +
      `${logo}<div style='background-color:${declineColor};padding:14px 24px;'><p style='margin:0;font-size:18px;font-weight:600;color:#ffffff;'>Document declined by ${signerName}</p>` +
      `</div><div style='padding:28px 24px;'><p style='margin:0 0 16px 0;font-size:14px;color:${brandTextColor};'>Dear ${creatorName},</p>` +
      `<p style='margin:0 0 12px 0;font-size:14px;color:${brandTextColor};line-height:1.6;'>${pdfName} has been declined by ${signerName} "${signerEmail}" on ${new Date().toLocaleDateString()}.</p>` +
      `<p style='margin:0 0 20px 0;font-size:14px;color:${brandTextColor};'><strong>Decline Reason:</strong> ${reason || 'Not specified'}</p>` +
      `<div style='text-align:center;'><a href=${viewDocUrl} target=_blank style='background-color:${brandColor};color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 34px;border-radius:6px;display:inline-block;'>View Document</a></div></div><div style='background-color:${brandSoftBg};padding:14px 24px;border-top:1px solid ${brandBorder};'><p style='margin:0 0 4px 0;font-size:11px;color:${brandMutedTextColor};'>This is an automated email from ${TenantAppName}. For any queries regarding this email, ` +
      `please contact the sender ${creatorEmail} directly.</p><p style='margin:0;font-size:11px;color:${brandMutedTextColor};'>Power Planning &amp; Monitoring Company &middot; Ministry of Energy &middot; Govt. of Pakistan</p></div></div></div></body></html>`;

    const params = {
      extUserId: sender.objectId,
      from: TenantAppName,
      recipient: creatorEmail,
      subject: subject,
      pdfName: pdfName,
      html: body,
    };
    await sendSystemMail({ params });
  } catch (err) {
    console.log('err in sendnotifymail', err);
  }
}
export default async function declinedocument(request) {
  const docId = request.params.docId;
  const reason = request.params?.reason || '';
  const userId = request.params.userId;
  const declineBy = { __type: 'Pointer', className: '_User', objectId: userId };
  const publicUrl = request.headers.public_url || process.env.APP_URL;
  if (!docId) {
    throw new Parse.Error(Parse.Error.SCRIPT_FAILED, 'missing parameter docId.');
  }
  try {
    const docCls = new Parse.Query('contracts_Document');
    docCls.include('ExtUserPtr.TenantId,Placeholders.signerPtr,Signers');
    docCls.notEqualTo('IsCompleted', true);
    docCls.notEqualTo('IsArchive', true);
    const updateDoc = await docCls.get(docId, { useMasterKey: true });
    if (updateDoc) {
      const _doc = JSON.parse(JSON.stringify(updateDoc));
      const isEnableOTP = updateDoc?.get('IsEnableOTP') || false;
      const isCreator = _doc?.CreatedBy?.objectId === userId;
      if (!isEnableOTP) {
        updateDoc.set('IsDeclined', true);
        updateDoc.set('DeclineReason', reason);
        updateDoc.set('DeclineBy', declineBy);
        await updateDoc.save(null, { useMasterKey: true });
        if (!isCreator) {
          sendDeclineMail(_doc, publicUrl, userId, reason);
        }
        return 'document declined';
      } else {
        if (!request?.user) {
          throw new Parse.Error(Parse.Error.INVALID_SESSION_TOKEN, 'User is not authenticated.');
        }
        updateDoc.set('IsDeclined', true);
        updateDoc.set('DeclineReason', reason);
        updateDoc.set('DeclineBy', declineBy);
        await updateDoc.save(null, { useMasterKey: true });
        const isCreator = _doc?.CreatedBy?.objectId === request?.user?.id;
        if (!isCreator) {
          sendDeclineMail(_doc, publicUrl, userId, reason);
        }
        return 'document declined';
      }
    } else {
      throw new Parse.Error(Parse.Error.OBJECT_NOT_FOUND, 'Document not found.');
    }
  } catch (err) {
    console.log('err while decling doc', err);
    throw err;
  }
}
