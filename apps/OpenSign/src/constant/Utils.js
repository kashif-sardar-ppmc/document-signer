import axios from "axios";
import moment from "moment";
import {
  PDFDocument,
  rgb,
  degrees,
  PDFName,
  StandardFonts,
  PDFArray,
  PDFDict
} from "pdf-lib";
import Parse from "parse";
import { appInfo, appBasename } from "./appinfo";
import { saveAs } from "file-saver";
import printModule from "print-js";
import fontkit from "@pdf-lib/fontkit";
import { SCALE_STEPS } from "./const";
import { format, toZonedTime } from "date-fns-tz";
import i18n from "../i18n";
import {
  applyNumberFormulasToPages,
  buildDownloadFilename,
  addPreferenceOpt
} from "../utils";

export const fontsizeArr = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28];
export const fontColorArr = ["red", "black", "blue", "yellow"];
export const isMobile = window.innerWidth < 767;
export const isTab = 767 < window.innerWidth < 1023;
export const isHighResolution = window.innerWidth > 1023;
export const isTabAndMobile = window.innerWidth < 1023;
export const textInputWidget = "text input";
export const drawWidget = "draw";
export const textWidget = "text";
export const radioButtonWidget = "radio button";
export const cellsWidget = "cells";
const duplicateAutoApplyWidgetTypes = [
  "name",
  "company",
  "job title",
  "email",
  textInputWidget
];
const normalizeDuplicateWidgetType = (type) => {
  if (typeof type !== "string") {
    return type;
  }
  const normalizedType = type.trim().toLowerCase();
  // Backward compatibility for legacy payloads.
  if (normalizedType === "textbox") {
    return textInputWidget;
  }
  return normalizedType;
};
const normalizeDuplicateWidgetName = (name) =>
  typeof name === "string" ? name.trim().toLowerCase() : "";
const isDuplicateAutoApplyWidget = (widget) =>
  duplicateAutoApplyWidgetTypes.includes(
    normalizeDuplicateWidgetType(widget?.type)
  );
const getDuplicateAutoApplyName = (widget) => {
  if (!isDuplicateAutoApplyWidget(widget)) {
    return "";
  }
  return normalizeDuplicateWidgetName(widget?.options?.name);
};
const getWidgetResponseValue = (widget) =>
  widget?.options?.response ?? widget?.options?.defaultValue;
const getDuplicateResponseMap = (widgets = []) => {
  const responseByName = new Map();
  widgets.forEach((widget) => {
    const widgetName = getDuplicateAutoApplyName(widget);
    const response = getWidgetResponseValue(widget);
    if (
      widgetName &&
      response !== undefined &&
      response !== "" &&
      !responseByName.has(widgetName)
    ) {
      responseByName.set(widgetName, response);
    }
  });
  return responseByName;
};
const applyDuplicateResponsesToWidgets = (
  widgets = [],
  responseByName = getDuplicateResponseMap(widgets)
) => {
  if (responseByName.size === 0) {
    return widgets;
  }

  return widgets.map((widget) => {
    const widgetName = getDuplicateAutoApplyName(widget);
    if (!widgetName || !responseByName.has(widgetName)) {
      return widget;
    }
    return {
      ...widget,
      options: {
        ...widget.options,
        response: responseByName.get(widgetName),
        defaultValue: ""
      }
    };
  });
};
const applyDuplicateResponsesToPages = (pages = []) => {
  const responseByName = getDuplicateResponseMap(
    pages.flatMap((page) => page?.pos || [])
  );
  return pages.map((page) => ({
    ...page,
    pos: applyDuplicateResponsesToWidgets(page?.pos || [], responseByName)
  }));
};
export function getEnv() {
  return window?.RUNTIME_ENV || {};
}
const appName = "PPMC e-Sign";
// Shared brand tokens used to keep every outgoing email consistent with the
// PPMC e-Sign govt-green portal theme and the dashboard logo.
export const brandLogoUrl = "data:image/png;base64,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";
export const brandColor = "#0F7A3D";
export const brandColorDark = "#0B4B27";
export const brandSoftBg = "#F1F8F2";
export const brandBorder = "#DCEEE0";
export const brandTextColor = "#14231A";
export const brandMutedTextColor = "#5A6B60";

// NOTE: this body is edited inside a Quill ("basic") rich-text editor, which
// re-normalizes HTML into a limited set of formats (paragraphs, bold, links,
// inline color/background, images) and drops decorative wrapper elements
// (divs, tables, custom padding/border-radius). Keep this template to that
// safe subset so it survives being loaded into the editor unmangled — the
// fuller card/table layout lives in `mailTemplate` below, which is sent as
// raw HTML and never passes through Quill.
export const defaultMailBody = `<p><img src='${brandLogoUrl}' alt='${appName}' height='44' /></p><p>Hi {{receiver_name}},</p><p>We hope this email finds you well. {{sender_name}}&nbsp;has requested you to review and sign&nbsp;<strong>{{document_title}}</strong>.</p><p>Your signature is crucial to proceed with the next steps as it signifies your agreement and authorization.</p><p><a href='{{signing_url}}' rel='noopener noreferrer' target='_blank' style='color:#ffffff;background-color:${brandColor};font-weight:bold;'>&nbsp;Sign here&nbsp;</a></p><p>If you have any questions or need further clarification regarding the document or the signing process, please contact the sender.</p><p>Thanks,</p><p>Team ${appName}</p><p style='color:${brandMutedTextColor};font-size:12px;'>Power Planning &amp; Monitoring Company &middot; Ministry of Energy &middot; Govt. of Pakistan</p>`;
export const defaultMailSubject = `{{sender_name}} has requested you to sign {{document_title}}`;

// See the note above `defaultMailBody` — kept to the same Quill-safe subset.
export const defaultCompletionBody = `<p><img src='${brandLogoUrl}' alt='${appName}' height='44' /></p><p>Hi {{sender_name}},</p><p>All parties have successfully signed the document&nbsp;<strong>{{document_title}}</strong>.</p><p>Kindly download the completed document from the attachment.</p><p>Thanks,</p><p>Team ${appName}</p><p style='color:${brandMutedTextColor};font-size:12px;'>Power Planning &amp; Monitoring Company &middot; Ministry of Energy &middot; Govt. of Pakistan</p>`;
export const defaultCompletionSubject = `Document {{document_title}} has been signed by all parties`;
export const nonPresentMaskCss = (base) => ({
  ...base,
  width: "0px",
  height: "0px"
});

export const randomId = (digit = 8) => {
  // 1. Grab a cryptographically-secure 32-bit random value
  // Use crypto for stronger randomness
  const randomBytes = crypto.getRandomValues(new Uint32Array(1));
  const raw = randomBytes[0]; // 0 … 4,294,967,295

  // Calculate the min and max for the given digit length
  const min = Math.pow(10, digit - 1); // e.g., digit=3 → 100
  const max = Math.pow(10, digit) - 1; // e.g., digit=3 → 999
  const range = max - min + 1;

  // Collapse random value into the range and shift
  return min + (raw % range);
};
//function for create list of year for date widget
export const range = (start, end, step) => {
  const range = [];
  for (let i = start; i <= end; i += step) {
    range.push(i);
  }
  return range;
};
//function for get year
export const getYear = (date) => {
  const newYear = new Date(date).getFullYear();
  return newYear;
};
export const years = range(1950, getYear(new Date()) + 16, 1);
export const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];
export const fileasbytes = async (filepath) => {
  const response = await fetch(filepath); // Adjust the path accordingly
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
};

export const openInNewTab = (url, target) => {
  if (target) {
    window.open(url, target, "noopener,noreferrer");
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
};

export const getUserCountry = async () => {
  try {
    const res = await fetch("https://ipapi.co/json/");
    const data = await res.json();
    return data?.country_code;
  } catch (err) {
    console.log("Error fetching country", err);
    return "";
  }
};

// `getSecureUrl` is used to return local secure url if local files
export const getSecureUrl = async (url) => {
  const fileUrl = new URL(url)?.pathname?.includes("/files/");
  if (fileUrl) {
    try {
      const fileRes = await Parse.Cloud.run("fileupload", { url: url });
      if (fileRes.url) {
        return { url: fileRes.url };
      } else {
        return { url: "" };
      }
    } catch (err) {
      console.log("err while fileupload ", err);
      return { url: "" };
    }
  } else {
    return { url: url };
  }
};

// `generateId` generates a random alphanumeric ID of specified length.
export function generateId(length) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const charactersLength = characters.length;

  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

/**
 * Removes a trailing path segment from a URL string, if present.
 *
 * @param {string} url     - The original URL.
 * @param {string} segment - The segment to strip off (default: "app").
 * @returns {string}       - The URL with the trailing segment removed, or unmodified if it didn’t match.
 */
export function removeTrailingSegment(url, segment = "app") {
  // Normalize a trailing slash (e.g. “/app/” → “/app”)
  const normalized = url.endsWith("/") ? url.slice(0, -1) : url;

  const lastSlash = normalized.lastIndexOf("/");
  const lastPart = normalized.slice(lastSlash + 1);

  if (lastPart === segment) {
    return normalized.slice(0, lastSlash);
  }

  return normalized;
}

export const color = [
  "#93a3db",
  "#e6c3db",
  "#c0e3bc",
  "#bce3db",
  "#b8ccdb",
  "#ceb8db",
  "#ffccff",
  "#99ffcc",
  "#cc99ff",
  "#ffcc99",
  "#66ccff",
  "#ffffcc"
];

export const nameColor = [
  "#304fbf",
  "#7d5270",
  "#5f825b",
  "#578077",
  "#576e80",
  "#6d527d",
  "#cc00cc",
  "#006666",
  "#cc00ff",
  "#ff9900",
  "#336699",
  "#cc9900"
];
export const toDataUrl = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = (e) => {
      resolve(e.target.result);
    };
  });
};

//function for getting document details for getDrive cloud function
export const getDrive = async (documentId, skip = 0, limit = 50) => {
  const data = {
    docId: documentId && documentId,
    limit: limit,
    skip: skip
  };
  const driveDeatils = await axios
    .post(`${localStorage.getItem("baseUrl")}functions/getDrive`, data, {
      headers: {
        "Content-Type": "application/json",
        "X-Parse-Application-Id": localStorage.getItem("parseAppId"),
        sessiontoken: localStorage.getItem("accesstoken")
      }
    })
    .then((Listdata) => {
      const json = Listdata.data;

      if (json && json.result.error) {
        return json;
      } else if (json && json.result) {
        const data = json.result;
        return data;
      } else {
        return [];
      }
    })
    .catch((err) => {
      console.log("Err in getDrive cloud function", err);
      return "Error: Something went wrong!";
    });

  return driveDeatils;
};

// `pdfNewWidthFun` function is used to calculate pdf width to render in middle container
export const pdfNewWidthFun = (divRef) => {
  const pdfWidth = divRef.current.offsetWidth;
  return pdfWidth;
};

//`contractUsers` function is used to get contract_User details
export const contractUsers = async () => {
  try {
    const url = `${localStorage.getItem("baseUrl")}functions/getUserDetails`;
    const parseAppId = localStorage.getItem("parseAppId");
    const accesstoken = localStorage.getItem("accesstoken");
    const token = { "X-Parse-Session-Token": accesstoken };
    const headers = {
      headers: {
        "Content-Type": "application/json",
        "X-Parse-Application-Id": parseAppId,
        ...token
      }
    };
    const userDetails = await axios.post(url, {}, headers);
    let data = [];
    if (userDetails?.data?.result) {
      const json = JSON.parse(JSON.stringify(userDetails.data.result));
      data.push(json);
    }
    return data;
  } catch (err) {
    console.log("Err in getUserDetails cloud function", err);
    return "Error: Something went wrong!";
  }
};

//function for resize image and update width and height for mulitisigners
export const handleWidgetResize = (
  ref,
  key,
  signerPos,
  setSignerPos,
  pageNumber,
  containerScale,
  signerId,
  showResize
) => {
  // Compute widget dimensions only once
  const { offsetWidth, offsetHeight } = ref;
  const factor = containerScale || 1;
  const widgetWidth = offsetWidth / factor;
  const widgetHeight = offsetHeight / factor;

  const filterSignerPos = signerPos.filter((data) => data.Id === signerId);
  if (filterSignerPos.length > 0) {
    const getPlaceHolder = filterSignerPos[0].placeHolder;
    const getPageNumer = getPlaceHolder.filter(
      (data) => data.pageNumber === pageNumber
    );
    if (getPageNumer.length > 0) {
      const getXYdata = getPageNumer[0].pos;
      const getPosData = getXYdata;
      const addSignPos = getPosData.map((url) => {
        if (url.key === key) {
          // For rotated widgets (90°/270°), the visual dimensions are swapped.
          // Store the original-orientation dimensions in the data model.
          const rotation = url.options?.rotation || 0;
          const isRotSwapped = [90, 270].includes(rotation);
          const storedWidth = isRotSwapped ? widgetHeight : widgetWidth;
          const storedHeight = isRotSwapped ? widgetWidth : widgetHeight;
          const widgetDims = { Width: storedWidth, Height: storedHeight };
          // Base fields for every resized signature
          const base = {
            ...url,
            Width: storedWidth,
            Height: storedHeight,
            IsResize: showResize ? true : false
          };
          // If it's a “type” signature, regenerate the image and options
          if (url.typeSignature && url.signatureType === "type") {
            const signImg = convertTextToImg(
              url.typeFont ?? "Fasthand",
              url.typeSignature,
              url.fontColor ?? "blue",
              widgetDims
            );
            return {
              ...base,
              SignUrl: signImg,
              options: { ...url.options, response: signImg }
            };
          }
          return base;
        }
        return url;
      });

      const newUpdateSignPos = getPlaceHolder.map((obj) => {
        if (obj.pageNumber === pageNumber) {
          return { ...obj, pos: addSignPos };
        }
        return obj;
      });

      const newUpdateSigner = signerPos.map((obj) => {
        if (obj.Id === signerId) {
          return { ...obj, placeHolder: newUpdateSignPos };
        }
        return obj;
      });

      setSignerPos(newUpdateSigner);
    }
  }
};

export const widgets = [
  { type: "signature", icon: "fa-light fa-pen-nib", iconSize: "20px" },
  { type: "stamp", icon: "fa-light fa-stamp", iconSize: "19px" },
  { type: "initials", icon: "fa-light fa-signature", iconSize: "15px" },
  { type: textInputWidget, icon: "fa-light fa-font", iconSize: "21px" },
  { type: "name", icon: "fa-light fa-user", iconSize: "21px" },
  { type: "job title", icon: "fa-light fa-address-card", iconSize: "17px" },
  { type: "company", icon: "fa-light fa-building", iconSize: "25px" },
  { type: "email", icon: "fa-light fa-envelope", iconSize: "20px" },
  { type: "date", icon: "fa-light fa-calendar-days", iconSize: "20px" },
  { type: textWidget, icon: "fa-light fa-text-width", iconSize: "20px" },
  { type: cellsWidget, icon: "fa-light fa-table-cells", iconSize: "20px" },
  { type: "checkbox", icon: "fa-light fa-square-check", iconSize: "22px" },
  {
    type: "dropdown",
    icon: "fa-light fa-circle-chevron-down",
    iconSize: "19px"
  },
  { type: radioButtonWidget, icon: "fa-light fa-circle-dot", iconSize: "20px" },
  { type: "image", icon: "fa-light fa-image", iconSize: "20px" },
  { type: drawWidget, icon: "fa-light fa-pen-nib", iconSize: "20px" }
];

export const getDate = (dateformat) => {
  const format = dateformat || "MM/DD/YYYY";
  const date = new Date();
  const milliseconds = date.getTime();
  const newDate = moment(milliseconds).format(format);
  return newDate;
};

export const selectFormat = (data) => {
  switch (data) {
    case "L":
      return "MM/dd/yyyy";
    case "MM/DD/YYYY":
      return "MM/dd/yyyy";
    case "DD-MM-YYYY":
      return "dd-MM-yyyy";
    case "DD/MM/YYYY":
      return "dd/MM/yyyy";
    case "LL":
      return "MMMM dd, yyyy";
    case "DD MMM, YYYY":
      return "dd MMM, yyyy";
    case "YYYY-MM-DD":
      return "yyyy-MM-dd";
    case "MM-DD-YYYY":
      return "MM-dd-yyyy";
    case "MM.DD.YYYY":
      return "MM.dd.yyyy";
    case "MMM DD, YYYY":
      return "MMM dd, yyyy";
    case "MMMM DD, YYYY":
      return "MMMM dd, yyyy";
    case "DD MMMM, YYYY":
      return "dd MMMM, yyyy";
    case "DD.MM.YYYY":
      return "dd.MM.yyyy";
    case "DD-MMM-YYYY":
      return "dd-MMM-yyyy";
    default:
      return "MM/dd/yyyy";
  }
};

export const changeDateToMomentFormat = (format) => {
  switch (format) {
    case "MM/dd/yyyy":
      return "L";
    case "dd-MM-yyyy":
      return "DD-MM-YYYY";
    case "dd/MM/yyyy":
      return "DD/MM/YYYY";
    case "MMMM dd, yyyy":
      return "LL";
    case "dd MMM, yyyy":
      return "DD MMM, YYYY";
    case "yyyy-MM-dd":
      return "YYYY-MM-DD";
    case "MM-dd-yyyy":
      return "MM-DD-YYYY";
    case "MM.dd.yyyy":
      return "MM.DD.YYYY";
    case "MMM dd, yyyy":
      return "MMM DD, YYYY";
    case "dd MMMM, yyyy":
      return "DD MMMM, YYYY";
    case "dd.MM.yyyy":
      return "DD.MM.YYYY";
    case "dd-MMM-yyyy":
      return "DD-MMM-YYYY";
    default:
      return "L";
  }
};

export const getSignerPages = (xyPosition = [], currentKey, signerId) => {
  if (!Array.isArray(xyPosition)) {
    return [];
  }
  const hasSigners = xyPosition.some((item) =>
    Array.isArray(item?.placeHolder)
  );
  if (hasSigners) {
    const candidates =
      signerId !== undefined && signerId !== null && signerId !== ""
        ? xyPosition.filter(
            (item) => item.Id === signerId || item.signerObjId === signerId
          )
        : xyPosition;
    for (const signer of candidates) {
      const pages = signer?.placeHolder || [];
      const ownsWidget = pages.some((page) =>
        (page?.pos || []).some((widget) => widget?.key === currentKey)
      );
      if (ownsWidget) {
        return pages;
      }
    }
    return [];
  }
  return xyPosition;
};

export const addWidgetOptions = (
  type,
  signer,
  placeholder,
  role,
  widgetValue
) => {
  let defaultOpt;
  const id = generateId(6);
  if (placeholder) {
    const countSameWidget = placeholder?.reduce((count, page) => {
      return count + page.pos.filter((item) => item.type === type).length;
    }, 0);
    const count = countSameWidget + 1;
    defaultOpt = { name: `${type}-${id}-${count}`, status: "required" };
  } else {
    defaultOpt = { name: `${type}-${id}-1`, status: "required" };
  }
  switch (type) {
    case "signature":
      return defaultOpt;
    case "stamp":
      return defaultOpt;
    case "checkbox":
      return { ...defaultOpt, isReadOnly: false, isHideLabel: false };
    case textInputWidget:
      return {
        ...defaultOpt,
        isReadOnly: false
      };
    case cellsWidget:
      return {
        ...defaultOpt,
        cellCount: 5,
        defaultValue: "",
        validation: { type: "", pattern: "" },
        isReadOnly: false
      };
    case "initials":
      return defaultOpt;
    case "name":
      return {
        ...defaultOpt,
        defaultValue: widgetValue ? widgetValue : ""
      };
    case "company":
      return {
        ...defaultOpt,
        defaultValue: widgetValue ? widgetValue : ""
      };
    case "job title":
      return {
        ...defaultOpt,
        defaultValue: widgetValue ? widgetValue : ""
      };
    case "date": {
      const dateFormat = signer?.DateFormat
        ? selectFormat(signer?.DateFormat)
        : "MM/dd/yyyy";
      const options = addPreferenceOpt(signer, "date", role);
      return {
        ...defaultOpt,
        response: options?.response || "",
        isReadOnly: options?.isReadOnly || false,
        validation: {
          format: options?.format || dateFormat,
          type: "date-format"
        }
      };
    }
    case "image":
      return defaultOpt;
    case "email":
      return {
        ...defaultOpt,
        validation: { type: "email", pattern: "" },
        defaultValue: widgetValue ? widgetValue : ""
      };
    case "dropdown":
      return defaultOpt;
    case radioButtonWidget:
      return {
        ...defaultOpt,
        values: [],
        isReadOnly: false
      };
    case textWidget:
      return defaultOpt;
    case drawWidget:
      return defaultOpt;
    default:
      return {};
  }
};

export const addWidgetSelfsignOptions = (
  type,
  getWidgetValue,
  owner,
  placeholder,
  isSignyourself
) => {
  let defaultOpt;
  //condition to handle widgets name field
  const id = generateId(6);
  if (placeholder) {
    const countSameWidget = placeholder?.reduce((count, page) => {
      return count + page.pos.filter((item) => item.type === type).length;
    }, 0);
    const count = countSameWidget + 1;
    defaultOpt = { name: `${type}-${id}-${count}`, status: "required" };
  } else {
    defaultOpt = { name: `${type}-${id}-1`, status: "required" };
  }
  switch (type) {
    case "signature":
      return defaultOpt;
    case "stamp":
      return defaultOpt;
    case "checkbox":
      return defaultOpt;
    case textWidget:
      return defaultOpt;
    case cellsWidget:
      return {
        ...defaultOpt,
        cellCount: 5,
        defaultValue: "",
        validation: { type: "", pattern: "" },
        isReadOnly: false
      };
    case "initials":
      return defaultOpt;
    case "name":
      return {
        ...defaultOpt,
        defaultValue: getWidgetValue(type),
        validation: { type: "text", pattern: "" }
      };
    case "company":
      return {
        ...defaultOpt,
        defaultValue: getWidgetValue(type),
        validation: { type: "text", pattern: "" }
      };
    case "job title":
      return {
        ...defaultOpt,
        defaultValue: getWidgetValue(type),
        validation: { type: "text", pattern: "" }
      };
    case "date": {
      const dateFormat = owner?.DateFormat
        ? selectFormat(owner?.DateFormat)
        : "MM/dd/yyyy";
      const options = addPreferenceOpt(owner, "date", "", isSignyourself);
      return {
        ...defaultOpt,
        response: options?.response || "",
        ...(!isSignyourself
          ? { isReadOnly: options?.isReadOnly || false }
          : {}),
        validation: {
          format: options?.format || dateFormat,
          type: "date-format"
        }
      };
    }
    case "image":
      return defaultOpt;
    case "email":
      return {
        ...defaultOpt,
        defaultValue: getWidgetValue(type),
        validation: { type: "email", pattern: "" }
      };
    default:
      return {};
  }
};

export const defaultWidthHeight = (type) => {
  switch (type) {
    case "signature":
      return { width: 150, height: 60 };
    case "stamp":
      return { width: 150, height: 60 };
    case "checkbox":
      return { width: 15, height: 19 };
    case textInputWidget:
      return { width: 150, height: 19 };
    case cellsWidget:
      return { width: 112, height: 22 };
    case "dropdown":
      return { width: 120, height: 22 };
    case "initials":
      return { width: 50, height: 50 };
    case "name":
      return { width: 150, height: 19 };
    case "company":
      return { width: 150, height: 19 };
    case "job title":
      return { width: 150, height: 19 };
    case "date":
      return { width: 100, height: 20 };
    case "image":
      return { width: 70, height: 70 };
    case "email":
      return { width: 150, height: 19 };
    case radioButtonWidget:
      return { width: 5, height: 10 };
    case textWidget:
      return { width: 150, height: 19 };
    case drawWidget:
      return { width: 150, height: 60 };
    default:
      return { width: 150, height: 60 };
  }
};
//convert url to base64
export async function getBase64FromUrl(url, autosign) {
  const data = await fetch(url);
  const blob = await data.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = function () {
      const pdfBase = this.result;
      if (autosign) {
        resolve(pdfBase);
      } else {
        const suffixbase64 = pdfBase.split(",").pop();
        resolve(suffixbase64);
      }
    };
  });
}

export async function getBase64FromIMG(url) {
  const data = await fetch(url);
  const blob = await data.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = function () {
      const pdfBase = this.result;
      resolve(pdfBase);
    };
  });
}
//function for convert signature png base64 url to jpeg base64
export const convertPNGtoJPEG = (base64Data) => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const img = new Image();
    img.src = base64Data;

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff"; // white color
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      // Convert to JPEG by using the canvas.toDataURL() method
      const jpegBase64Data = canvas.toDataURL("image/jpeg");

      resolve(jpegBase64Data);
    };

    img.onerror = (error) => {
      reject(error);
    };
  });
};

//function for resize image and update width and height for sign-yourself
export const handleSignYourselfWidgetResize = (
  ref,
  key,
  xyPosition,
  setXyPosition,
  index,
  containerScale
) => {
  // Guard against bad index
  if (!xyPosition[index]) {
    console.log(`ImageResize invalid index ${index}`);
    return;
  }

  // Compute widget dimensions only once
  const { offsetWidth, offsetHeight } = ref;
  const factor = containerScale || 1;
  const widgetWidth = offsetWidth / factor;
  const widgetHeight = offsetHeight / factor;

  // Single pass to update only the targeted index/key
  const updated = xyPosition.map((item, idx) => {
    if (idx !== index) return item;

    return {
      ...item,
      pos: item.pos.map((url) => {
        if (url.key !== key) return url;

        // For rotated widgets (90°/270°), the visual dimensions are swapped.
        // Store the original-orientation dimensions in the data model.
        const rotation = url.options?.rotation || 0;
        const isRotSwapped = [90, 270].includes(rotation);
        const storedWidth = isRotSwapped ? widgetHeight : widgetWidth;
        const storedHeight = isRotSwapped ? widgetWidth : widgetHeight;
        const widgetDims = { Width: storedWidth, Height: storedHeight };

        // Base fields for every resized signature
        const base = {
          ...url,
          Width: storedWidth,
          Height: storedHeight,
          IsResize: true
        };

        // If it's a “type” signature, regenerate the image and options
        if (url.typeSignature && url.signatureType === "type") {
          const signImg = convertTextToImg(
            url.typeFont ?? "Fasthand",
            url.typeSignature,
            url.fontColor ?? "blue",
            widgetDims
          );

          return {
            ...base,
            SignUrl: signImg,
            options: { ...url.options, response: signImg }
          };
        }

        return base;
      })
    };
  });
  setXyPosition(updated);
};

//function for call cloud function signPdf and generate digital signature
export const signPdfFun = async (
  base64Url,
  documentId,
  signerObjectId,
  objectId,
  widgets,
  activity
) => {
  let isCustomCompletionMail = false;
  try {
    //get tenant details
    const tenantDetails = await getTenantDetails(objectId);
    if (tenantDetails && tenantDetails === "user does not exist!") {
      return { status: "error", message: "User does not exist." };
    } else {
      if (tenantDetails?.CompletionBody && tenantDetails?.CompletionSubject) {
        isCustomCompletionMail = true;
      }
    }
    // below for loop is used to get first signature of user to send if to signpdf
    // for adding it in completion certificate
    let getSignature;
    for (let item of widgets) {
      if (!getSignature) {
        const typeExist = item.pos.some((data) => data?.type);
        if (typeExist) {
          getSignature = item.pos.find((data) => data?.type === "signature");
        } else {
          getSignature = item.pos.find((data) => !data.isStamp);
        }
      }
    }

    let base64Sign = getSignature?.SignUrl;
    let suffixbase64 = "";
    if (base64Sign) {
      //check https type signature (default signature exist) then convert in base64
      const isUrl = base64Sign.includes("https");
      if (isUrl) {
        try {
          base64Sign = await fetchImageBase64(base64Sign);
        } catch (e) {
          console.log("error", e);
          return { status: "error", message: "something went wrong." };
        }
      }
      //change image width and height to 300/120 in png base64
      const imagebase64 = await changeImageWH(base64Sign);
      //remove suffiix of base64 (without type)
      suffixbase64 = imagebase64 && imagebase64.split(",").pop();
    }

    const params = {
      pdfFile: base64Url,
      docId: documentId,
      userId: signerObjectId,
      isCustomCompletionMail: isCustomCompletionMail,
      signature: suffixbase64,
      activity: activity || "Signed"
    };
    const resSignPdf = await Parse.Cloud.run("signPdf", params);
    if (resSignPdf) {
      const signedPdf = JSON.parse(JSON.stringify(resSignPdf));
      return signedPdf;
    }
  } catch (e) {
    console.log("Err in signPdf cloud function ", e.message);
    if (e && e?.message?.includes("is encrypted.")) {
      return {
        status: "error",
        message: "Currently encrypted pdf files are not supported."
      };
    } else if (e?.message?.includes("password")) {
      return { status: "error", message: "PFX file password is invalid." };
    } else if (
      e?.code === 119 ||
      e?.message?.toLowerCase?.().includes("strict signing order")
    ) {
      return { status: "error", message: e.message };
    } else {
      return { status: "error", message: "something went wrong." };
    }
  }
};

export const createDocument = async (
  template,
  placeholders,
  signerData,
  SignedUrl,
  isSendDoc
) => {
  if (template && template.length > 0) {
    const Doc = template[0];
    const date = new Date();
    const isoDate = date.toISOString();
    let extUserId = Doc.ExtUserPtr.objectId;
    let creatorId = Doc.CreatedBy.objectId;
    const Extand_Class = localStorage.getItem("Extand_Class");
    const extClass = Extand_Class && JSON.parse(Extand_Class);
    if (extClass && extClass.length > 0) {
      if (Doc.ExtUserPtr?.objectId !== extClass?.[0]?.objectId) {
        if (extClass && extClass.length > 0) {
          extUserId = extClass[0].objectId;
          creatorId = extClass[0]?.UserId.objectId;
        }
      }
    }
    let placeholdersArr = [];
    if (placeholders?.length > 0) {
      placeholdersArr = placeholders;
    }
    let signers = [];
    if (signerData?.length > 0) {
      signerData.forEach((x) => {
        if (x.objectId) {
          const obj = {
            __type: "Pointer",
            className: "contracts_Contactbook",
            objectId: x.objectId
          };
          signers.push(obj);
        }
      });
    }
    const useNameAsSender = extClass?.[0]?.UseNameAsSender === true;
    const senderName =
      Doc?.SenderName || (useNameAsSender ? extClass?.[0]?.Name || "" : "");
    const senderMail =
      Doc?.SenderMail || (useNameAsSender ? extClass?.[0]?.Email || "" : "");
    const SenderName = senderName ? { SenderName: senderName } : {};
    const SenderMail = senderMail ? { SenderMail: senderMail } : {};
    const SignatureType = Doc?.SignatureType
      ? { SignatureType: Doc?.SignatureType }
      : {};
    const NotifyOnSignatures =
      Doc?.NotifyOnSignatures !== undefined
        ? { NotifyOnSignatures: Doc?.NotifyOnSignatures }
        : {};
    const Bcc = Doc?.Bcc?.length > 0 ? { Bcc: Doc?.Bcc } : {};
    const Cc = Doc?.Cc?.length > 0 ? { Cc: Doc?.Cc } : {};
    const RedirectUrl = Doc?.RedirectUrl
      ? { RedirectUrl: Doc?.RedirectUrl }
      : {};
    const PenColors =
      Doc?.PenColors?.length > 0 ? { PenColors: Doc?.PenColors } : {};
    const TemplateId = Doc?.objectId
      ? {
          TemplateId: {
            __type: "Pointer",
            className: "contracts_Template",
            objectId: Doc?.objectId
          }
        }
      : {};
    const data = {
      Name: Doc.Name,
      URL: SignedUrl ? SignedUrl : Doc?.URL,
      SignedUrl: isSendDoc ? SignedUrl : Doc.SignedUrl,
      SentToOthers: Doc.SentToOthers,
      Description: Doc.Description,
      Note: Doc.Note,
      Placeholders: placeholdersArr,
      ExtUserPtr: {
        __type: "Pointer",
        className: "contracts_Users",
        objectId: extUserId
      },
      CreatedBy: { __type: "Pointer", className: "_User", objectId: creatorId },
      Signers: signers,
      SendinOrder: Doc?.SendinOrder || false,
      AutomaticReminders: Doc?.AutomaticReminders || false,
      RemindOnceInEvery: parseInt(Doc?.RemindOnceInEvery || 5),
      IsEnableOTP: Doc?.IsEnableOTP || false,
      SendInOrderStrict: Doc?.SendInOrderStrict || false,
      IsTourEnabled: Doc?.IsTourEnabled || false,
      AllowModifications: Doc?.AllowModifications || false,
      TimeToCompleteDays: parseInt(Doc?.TimeToCompleteDays) || 15,
      DocSentAt: { __type: "Date", iso: isoDate },
      ...SignatureType,
      ...NotifyOnSignatures,
      ...SenderName,
      ...SenderMail,
      ...Bcc,
      ...Cc,
      ...RedirectUrl,
      ...TemplateId,
      ...PenColors
    };
    const remindOnceInEvery = Doc?.RemindOnceInEvery;
    const TimeToCompleteDays = parseInt(Doc?.TimeToCompleteDays);
    const reminderCount = TimeToCompleteDays / remindOnceInEvery;
    const AutomaticReminders = Doc.autoreminder;
    if (AutomaticReminders && reminderCount > 15) {
      return { status: "error", id: "only-15-reminder-allowed" };
    }
    const url = `${localStorage.getItem("baseUrl")}functions/createdocumentfromapp`;
    const token = {
      "X-Parse-Session-Token": localStorage.getItem("accesstoken")
    };
    try {
      const res = await axios.post(
        url,
        { document: data },
        {
          headers: {
            "Content-Type": "application/json",
            "X-Parse-Application-Id": localStorage.getItem("parseAppId"),
            ...token
          }
        }
      );
      if (res) {
        const result = res.data.result;

        return { status: "success", id: result.objectId, data: result };
      }
    } catch (err) {
      const message =
        err?.response?.data?.error || err?.message || "something went wrong.";
      console.error("error in create document:", message);
      return { status: "error", id: "something-went-wrong-mssg" };
    }
  }
};

export const getFirstLetter = (name) => {
  const firstLetter = name?.charAt(0);
  return firstLetter;
};

export const darkenColor = (color, factor) => {
  // Remove '#' from the color code and parse it to get RGB values
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Darken the color by reducing each RGB component
  const darkerR = Math.floor(r * (1 - factor));
  const darkerG = Math.floor(g * (1 - factor));
  const darkerB = Math.floor(b * (1 - factor));

  // Convert the darkened RGB components back to hex
  return `#${((darkerR << 16) | (darkerG << 8) | darkerB)
    .toString(16)
    .padStart(6, "0")}`;
};

export const addZIndex = (signerPos, key, setZIndex) => {
  return signerPos.map((item) => {
    if (item.placeHolder && item.placeHolder.length > 0) {
      // If there is a nested array, recursively add the field to the last object
      return {
        ...item,
        placeHolder: addZIndex(item.placeHolder, key, setZIndex)
      };
    } else if (item.pos && item.pos.length > 0) {
      // If there is no nested array, add the new field
      return {
        ...item,
        pos: addZIndex(item.pos, key, setZIndex)
        // Adjust this line to add the desired field
      };
    } else {
      if (item.key === key) {
        setZIndex(item.zIndex);
        return {
          ...item,
          zIndex: item.zIndex ? item.zIndex + 1 : 1
        };
      } else {
        return { ...item };
      }
    }
  });
};

//function for save widgets value on onchange function
export const onChangeInput = (
  value,
  currentPosition,
  xyPosition,
  index,
  setXyPosition,
  userId,
  initial,
  dateFormat,
  fontSize,
  fontColor,
  dateDetails,
  textWidgetHeight
) => {
  const isDuplicateValueUpdate = !dateFormat && !textWidgetHeight;
  const shouldAutoApplyDuplicateWidget = (position) => {
    const currentName = getDuplicateAutoApplyName(currentPosition);
    const positionName = getDuplicateAutoApplyName(position);
    return currentName && positionName && currentName === positionName;
  };
  const applyDuplicateWidgetValue = (position) => {
    if (
      position?.options?.response === value &&
      position?.options?.defaultValue === ""
    ) {
      return position;
    }
    return {
      ...position,
      options: {
        ...position.options,
        response: value,
        defaultValue: ""
      }
    };
  };
  const isSigners = xyPosition.some(
    (data) => data.signerPtr || data.Role === "prefill"
  );
  let filterSignerPos;
  if (isSigners) {
    if (userId) {
      filterSignerPos = xyPosition.filter((data) => data.Id === userId);
    }
    const getPlaceHolder = filterSignerPos[0]?.placeHolder;
    if (initial) {
      const xyData = addInitialData(xyPosition, setXyPosition, value, userId);
      setXyPosition(xyData);
    } else {
      const getPageNumer = getPlaceHolder.filter(
        (data) => data.pageNumber === index
      );
      if (getPageNumer.length > 0) {
        const updatePositionValue = (position) => {
          if (position.key === currentPosition.key) {
            if (dateFormat) {
              return {
                ...position,
                options: {
                  ...position.options,
                  response: value,
                  fontSize: fontSize ? fontSize : position.options?.fontSize,
                  fontColor: fontColor
                    ? fontColor
                    : position.options?.fontColor,
                  isReadOnly:
                    dateDetails && dateDetails?.isReadOnly !== "undefined"
                      ? dateDetails?.isReadOnly
                      : position.options?.isReadOnly,
                  status:
                    dateDetails && dateDetails?.status !== "undefined"
                      ? dateDetails?.status
                      : position.options?.status,
                  name:
                    dateDetails && dateDetails?.name !== "undefined"
                      ? dateDetails?.name
                      : position.options?.name,
                  validation: {
                    type: "date-format",
                    format: dateFormat // This indicates the required date format explicitly.
                  },
                  hint: dateDetails?.hint || position.options?.hint || ""
                }
              };
            } else if (
              (currentPosition?.type === "text" ||
                currentPosition?.type === textInputWidget) &&
              textWidgetHeight &&
              !value
            ) {
              return { ...position, Height: textWidgetHeight };
            } else {
              return applyDuplicateWidgetValue(position);
            }
          }
          if (
            isDuplicateValueUpdate &&
            shouldAutoApplyDuplicateWidget(position)
          ) {
            return applyDuplicateWidgetValue(position);
          }
          return position;
        };
        setXyPosition((prevPosition) => {
          const sourcePosition = Array.isArray(prevPosition)
            ? prevPosition
            : xyPosition;
          return sourcePosition.map((obj) => {
            if (obj.Id !== userId) {
              return obj;
            }
            const updatedPlaceHolder = (obj.placeHolder || []).map((page) => ({
              ...page,
              pos: page.pos.map(updatePositionValue)
            }));
            return {
              ...obj,
              placeHolder: applyNumberFormulasToPages(updatedPlaceHolder)
            };
          });
        });
      }
    }
  } else {
    const updatePositionValue = (positionData) => {
      if (positionData.key === currentPosition.key) {
        if (dateFormat) {
          return {
            ...positionData,
            options: {
              ...positionData.options,
              response: value,
              fontSize: fontSize,
              fontColor: fontColor,
              validation: {
                type: "date-format",
                format: dateFormat // This indicates the required date format explicitly.
              }
            }
          };
        } else if (
          currentPosition?.type === "text" &&
          textWidgetHeight &&
          !value
        ) {
          return { ...positionData, Height: textWidgetHeight };
        } else {
          return applyDuplicateWidgetValue(positionData);
        }
      }
      if (
        isDuplicateValueUpdate &&
        shouldAutoApplyDuplicateWidget(positionData)
      ) {
        return applyDuplicateWidgetValue(positionData);
      }
      return positionData;
    };

    setXyPosition((prevPosition) => {
      const sourcePosition = Array.isArray(prevPosition)
        ? prevPosition
        : xyPosition;
      const updatePlaceholder = sourcePosition.map((obj) => ({
        ...obj,
        pos: obj.pos.map(updatePositionValue)
      }));
      return applyNumberFormulasToPages(updatePlaceholder);
    });
  }
};
//function to increase height of text area on press enter
export const onChangeHeightOfTextArea = (
  height,
  widgetType,
  signKey,
  xyPosition,
  index,
  setXyPosition,
  userId
) => {
  const isSigners = xyPosition.some((data) => data.signerPtr);
  let filterSignerPos;
  if (isSigners) {
    if (userId) {
      filterSignerPos = xyPosition.filter((data) => data.Id === userId);
    }
    const getPlaceHolder = filterSignerPos[0]?.placeHolder;

    const getPageNumer = getPlaceHolder.filter(
      (data) => data.pageNumber === index
    );
    if (getPageNumer.length > 0) {
      const getXYdata = getPageNumer[0].pos;
      const getPosData = getXYdata;
      const addSignPos = getPosData.map((position) => {
        if (position.key === signKey) {
          return {
            ...position,
            Height: position.Height
              ? position.Height + height
              : defaultWidthHeight(widgetType).height + height
          };
        }
        return position;
      });
      const newUpdateSignPos = getPlaceHolder.map((obj) => {
        if (obj.pageNumber === index) {
          return { ...obj, pos: addSignPos };
        }
        return obj;
      });

      const newUpdateSigner = xyPosition.map((obj) => {
        if (obj.Id === userId) {
          return { ...obj, placeHolder: newUpdateSignPos };
        }
        return obj;
      });

      setXyPosition(newUpdateSigner);
    }
  } else {
    let getXYdata = xyPosition[index].pos;

    const updatePosition = getXYdata.map((position) => {
      if (position.key === signKey) {
        return {
          ...position,
          Height: position.Height
            ? position.Height + height
            : defaultWidthHeight(widgetType).height + height
        };
      }
      return position;
    });

    const updatePlaceholder = xyPosition.map((obj, ind) => {
      if (ind === index) {
        return { ...obj, pos: updatePosition };
      }
      return obj;
    });
    setXyPosition(updatePlaceholder);
  }
};
//calculate width and height
export const calculateInitialWidthHeight = (widgetData) => {
  const intialText = widgetData;
  const span = document.createElement("span");
  span.textContent = intialText;
  span.style.font = `12px`; // here put your text size and font family
  span.style.display = "hidden";
  document.body.appendChild(span);
  const width = span.offsetWidth;
  const height = span.offsetHeight;

  document.body.removeChild(span);
  return { getWidth: width, getHeight: height };
};
export const widgetDataValue = (type, value) => {
  switch (type) {
    case "name":
      return value?.Name || value?.name;
    case "company":
      return value?.Company || value?.company;
    case "job title":
      return value?.JobTitle || value?.jobTitle;
    case "email":
      return value?.Email || value?.email;
    default:
      return "";
  }
};
export const addInitialData = (signerPos, setXyPosition, value, userId) => {
  return signerPos.map((item) => {
    if (item.placeHolder && item.placeHolder.length > 0) {
      // If there is a nested array, recursively add the field to the last object
      if (item.Id === userId) {
        return {
          ...item,
          placeHolder: addInitialData(
            item.placeHolder,
            setXyPosition,
            value,
            userId
          )
        };
      } else {
        return item;
      }
    } else if (item.pos && item.pos.length > 0) {
      // If there is no nested array, add the new field
      return {
        ...item,
        pos: addInitialData(item.pos, setXyPosition, value, userId)
        // Adjust this line to add the desired field
      };
    } else {
      const widgetData = widgetDataValue(item.type, value);
      if (["name", "company", "job title", "email"].includes(item.type)) {
        return {
          ...item,
          options: {
            ...item.options,
            defaultValue: item?.options?.defaultValue || widgetData
          }
        };
      } else {
        return item;
      }
    }
  });
};

//function for embed document id
export const embedDocId = async (pdfOriginalWH, pdfDoc, documentId) => {
  const appName = "OpenSign™";
  // `fontBytes` is used to embed custom font in pdf
  const fontBytes = await fileasbytes(
    "https://cdn.opensignlabs.com/webfonts/times.ttf"
  );
  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(fontBytes, { subset: true });
  //pdfOriginalWH contained all pdf's pages width and height
  for (let i = 0; i < pdfOriginalWH?.length; i++) {
    const fontSize = 10;
    const textContent = documentId && `${appName} DocumentId: ${documentId} `;
    const pages = pdfDoc.getPages();
    const page = pages[i];
    const getSize = pdfOriginalWH[i];
    try {
      const getObj = compensateRotation(
        page.getRotation().angle,
        10,
        5,
        1,
        getSize,
        fontSize,
        rgb(0.5, 0.5, 0.5),
        font,
        page
      );
      page.drawText(textContent, getObj);
    } catch (err) {
      console.log("Err in embed docId on page", i + 1, err?.message);
    }
  }
};

// function for convert input text value in image
export function convertTextToImg(fontStyle, text, color, widgetDims) {
  // read your widget dimensions:
  const maxWidth = widgetDims.Width;
  const maxHeight = widgetDims.Height;
  const baselineFontSizePx = maxHeight;
  const fontFamily = fontStyle || "Fasthand";
  const fillColor = color || "blue";

  // 1. Use a temporary canvas to measure actual text size
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.font = `${baselineFontSizePx}px ${fontFamily}`;
  const metrics = tempCtx.measureText(text);

  const actualHeight =
    metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
  const actualWidth = metrics.width;

  // const renderscale = 3;
  // 2. Scale font size so text height fills canvas
  const scaleX = maxWidth / actualWidth;
  const scaleY = maxHeight / actualHeight;
  const scale = Math.min(scaleX, scaleY, 1);
  // final font-size
  // const finalFontSizePx = baselineFontSizePx * scale * renderscale;
  const finalFontSizePx = baselineFontSizePx * scale;
  // 3. Create the final canvas
  const pxRatio = window.devicePixelRatio * 2 || 3;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(maxWidth * pxRatio);
  canvas.height = Math.ceil(maxHeight * pxRatio);
  const ctx = canvas.getContext("2d");
  ctx.scale(pxRatio, pxRatio);

  // 4. Setup text with final font
  ctx.font = `${finalFontSizePx}px ${fontFamily}`;
  ctx.fillStyle = fillColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  const newMetrics = ctx.measureText(text);
  const ascent = newMetrics.actualBoundingBoxAscent;
  const descent = newMetrics.actualBoundingBoxDescent;

  // 5. Align text vertically so it touches top and bottom
  const y = maxHeight / 2 + (ascent - descent) / 2;

  ctx.clearRect(0, 0, maxWidth, maxHeight);
  ctx.fillText(text, maxWidth / 2, y);

  // 6. Output image
  const dataUrl = canvas.toDataURL("image/png");
  return dataUrl;
}

// `onSaveSign` trigger on save button to save for signature, initials widget for type: draw, typed, default
export function onSaveSign(
  type,
  xyPosition,
  index,
  signKey,
  signatureImg,
  updatedImgWH,
  isTypeText,
  typedSignature,
  isAutoSign,
  widgetsType,
  typeFont,
  fontColor
) {
  let getIMGWH, posWidth, posHeight;
  let getXYdata = xyPosition[index].pos;
  const isSignOrInitials =
    widgetsType && ["signature", "initials"].includes(widgetsType);
  const updateXYData = getXYdata.map((position) => {
    if (position.key === signKey) {
      if (isTypeText) {
        getIMGWH = {
          newWidth: updatedImgWH.width,
          newHeight: updatedImgWH.height
        };
      }
      posWidth = getIMGWH ? getIMGWH.newWidth : 150;
      posHeight = getIMGWH ? getIMGWH.newHeight : 60;
      const widgetDims = { Width: posWidth, Height: posHeight };
      const signImg = typedSignature
        ? convertTextToImg(typeFont, typedSignature, fontColor, widgetDims)
        : signatureImg;
      if (widgetsType === drawWidget) {
        return {
          ...position,
          options: { ...position.options, response: signImg }
        };
      } else {
        return {
          ...position,
          ...(type === "type" ? { Width: posWidth } : {}),
          ...(type === "type" ? { Height: posHeight } : {}),
          SignUrl: signImg,
          ...(isSignOrInitials && { signatureType: type || "" }),
          options: { ...position.options, response: signImg },
          ...(typedSignature && {
            typeSignature: typedSignature,
            typeFont: typeFont ?? "Fasthand",
            fontColor: fontColor ?? "blue"
          })
        };
      }
    }
    return position;
  });

  const updateXYposition = xyPosition.map((obj, ind) => {
    if (ind === index) {
      return { ...obj, pos: updateXYData };
    }
    return obj;
  });
  //condition  when draw/upload signature/initials then apply it all related to widgets (draw, typed signature or default signature)
  if (isAutoSign && widgetsType !== drawWidget) {
    const updatedArray = updateXYposition.map((page) => ({
      ...page,
      pos: page.pos.map((item) => {
        if (item.type === widgetsType) {
          const widgetDims = { Width: item.Width, Height: item.Height };
          const signImg = typedSignature
            ? convertTextToImg(typeFont, typedSignature, fontColor, widgetDims)
            : signatureImg;
          return {
            ...item,
            SignUrl: signImg,
            ...(isSignOrInitials && { signatureType: type || "" }),
            options: { ...item.options, response: signImg },
            ...(typedSignature && {
              typeSignature: typedSignature,
              typeFont: typeFont || "Fasthand",
              fontColor: fontColor || "blue"
            })
          };
        }
        return item; // Otherwise, keep it unchanged
      })
    }));
    return updatedArray;
  } else {
    return updateXYposition;
  }
}

export function clearResponse(widgetKey, placeholder = [], index) {
  if (!Array.isArray(placeholder) || !placeholder[index]?.pos) {
    return placeholder;
  }
  const getXYdata = placeholder[index]?.pos;
  const updateXYData = getXYdata.map((widget) => {
    if (widget?.key !== widgetKey) return widget;
    return {
      ...widget,
      options: { ...widget.options, response: "" },
      SignUrl: ""
    };
  });

  const updatePlaceholder = placeholder.map((p, ind) => {
    if (ind !== index) return p;
    return { ...p, pos: updateXYData };
  });
  return updatePlaceholder;
}
/**
 * Scales and centers a base64‐encoded image into a fixed‐size widget
 * and returns a new base64 PNG.
 *
 * @param {string} base64Image  A data-URL (e.g. "data:image/png;base64,…")
 * @param {{ Width: number, Height: number }} widgetDims
 * @returns {Promise<string>}  A Promise that resolves to a data-URL of the new image
 */
export async function convertBase64ToImg(base64Image, widgetDims) {
  const { Width: maxWidth, Height: maxHeight } = widgetDims;
  // Load the image off-DOM
  const img = new Image();
  img.src = base64Image;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  // 2. Compute scale to fit within widget (preserving aspect ratio)
  const { naturalWidth: imgW, naturalHeight: imgH } = img;
  const scale = Math.min(maxWidth / imgW, maxHeight / imgH, 1);
  const drawW = imgW * scale;
  const drawH = imgH * scale;

  // 3. Prepare a high-DPI canvas
  const pxRatio = (window.devicePixelRatio || 1) * 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(maxWidth * pxRatio);
  canvas.height = Math.ceil(maxHeight * pxRatio);
  const ctx = canvas.getContext("2d");
  ctx.scale(pxRatio, pxRatio);
  ctx.clearRect(0, 0, maxWidth, maxHeight);

  // 4. Center the image in the widget rectangle
  const x = (maxWidth - drawW) / 2;
  const y = (maxHeight - drawH) / 2;
  ctx.drawImage(img, x, y, drawW, drawH);
  // 5. Return new base64 in same format as input
  // const quality =
  //   inputMime.includes("jpeg") || inputMime.includes("jpg") ? 0.9 : undefined;
  // return canvas.toDataURL(inputMime, quality);
  // 5. Always return PNG (lossless, no quality param needed)
  return canvas.toDataURL("image/png");
}

//function to use After setting the signature URL for the first signature widget, clicking on subsequent
//signature widgets should automatically apply and display the signature. apply for initial,signature and stamp widget
export const handleCopySignUrl = (
  currentPos,
  existSignPosition,
  setXyPosition,
  xyPosition,
  pageNumber,
  signerObjectId
) => {
  //get current signer details
  const currentSigner = xyPosition.filter(
    (data) => data.signerObjId === signerObjectId
  );
  //get current signer placeholder details
  const placeholderPosition = currentSigner[0].placeHolder;
  //get current pagenumber position
  const getcurrentPagePosition = placeholderPosition.find(
    (data) => data.pageNumber === pageNumber
  );
  let getXYdata = getcurrentPagePosition.pos;
  const updatePos = getXYdata.map((x) => {
    //update widgets sign url details
    if (x.key === currentPos.key) {
      return {
        ...x,
        // Width: existSignPosition.Width,
        // Height: existSignPosition.Height,
        SignUrl: existSignPosition.SignUrl,
        signatureType: existSignPosition.signatureType,
        options: { ...x.options, response: existSignPosition.SignUrl },
        ...(existSignPosition.typedSignature && {
          typeSignature: existSignPosition.typedSignature
        })
      };
    }
    return x;
  });
  const updateXYposition = placeholderPosition.map((obj) => {
    if (obj.pageNumber === pageNumber) {
      return { ...obj, pos: updatePos };
    }
    return obj;
  });
  const newUpdateSigner = xyPosition.map((obj) => {
    if (obj.signerObjId === signerObjectId) {
      return { ...obj, placeHolder: updateXYposition };
    }
    return obj;
  });
  setXyPosition(newUpdateSigner);
};
export const calculateImgAspectRatio = (imgWH, pos) => {
  let newWidth, newHeight;

  const placeholderHeight = pos && pos.Height ? pos.Height : 60;
  const aspectRatio = imgWH.width / imgWH.height;
  newWidth = aspectRatio * placeholderHeight;
  newHeight = placeholderHeight;
  return { newHeight, newWidth };
};

// `onSaveImage` trigger for upload image through stamp, image, signature, initials widgets
export function onSaveImage(
  signatureType,
  xyPosition,
  index,
  signKey,
  image,
  isAutoSign,
  widgetsType,
  imgUrl,
  defaultStampImg,
  defaultStampType
) {
  let widgetName;
  const isSignOrInitials =
    widgetsType && ["signature", "initials"].includes(widgetsType);
  //get current page position
  const getXYData = xyPosition[index].pos;
  const updateXYData = getXYData.map((position) => {
    if (position.key === signKey) {
      widgetName = position?.options?.name;
      return {
        ...position,
        SignUrl: imgUrl || image?.src || defaultStampImg,
        ImageType: image?.imgType || defaultStampType,
        ...(isSignOrInitials && { signatureType: signatureType || "" }),
        options: {
          ...position.options,
          response: imgUrl || image?.src || defaultStampImg
        }
      };
    }
    return position;
  });
  const updateXYposition = xyPosition.map((obj, ind) => {
    if (ind === index) {
      return { ...obj, pos: updateXYData };
    }
    return obj;
  });

  // condition when user apply auto sign feature for any type upload image (signature,initials,stamp,image)
  if (isAutoSign) {
    const updatedArray = updateXYposition.map((page) => ({
      ...page,
      pos: page.pos.map(
        (item) =>
          // below condition is check if image widget name same then apply to auto sign other wise not
          // and for other widget like signature,stamp,initials apply auto sign for all remaining widgets
          item.type === widgetsType &&
          (item.type !== "image" || item.options.name === widgetName)
            ? {
                ...item,
                SignUrl: image?.src || defaultStampImg,
                ImageType: image?.imgType || defaultStampType,
                options: {
                  ...item.options,
                  response: image?.src || defaultStampImg
                }
              }
            : item // Otherwise, keep it unchanged
      )
    }));

    return updatedArray;
  } else {
    return updateXYposition;
  }
}

//function for select image and upload image
export const onImageSelect = (setImage, file) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onloadend = function (e) {
    let width, height;
    const image = new Image();
    image.src = e.target.result;
    image.onload = function () {
      width = image.width;
      height = image.height;
      const aspectRatio = 460 / 184;
      const imgR = width / height;
      if (imgR > aspectRatio) {
        width = 460;
        height = 460 / imgR;
      } else {
        width = 184 * imgR;
        height = 184;
      }
    };
    image.src = reader.result;
    setImage({ src: image.src, imgType: file.type });
  };
};
export const compressedFileSize = (file, setImage) => {
  // Create a new FileReader instance to read the uploaded file
  const reader = new FileReader();

  // Event listener triggered when the file is read successfully
  reader.onload = (e) => {
    // Create a new Image instance to manipulate the image data
    const img = new Image();

    // Set the image source to the file's data URL (base64 string)
    img.src = e.target.result;

    // Event listener triggered when the image is fully loaded
    img.onload = () => {
      // Create a canvas element to resize and compress the image
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d"); // Get the drawing context of the canvas

      // Set the canvas dimensions, ensuring they don't exceed 1920x1920
      canvas.width = Math.min(img.width, 1920); // Limit width to 1920px
      canvas.height = Math.min(img.height, 1920); // Limit height to 1920px

      // Draw the image onto the canvas with the specified dimensions
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      // Get the original file type (default to "image/png" if not recognized)
      const fileType = "image/png"; //file.type || "image/png"
      // Compress the image and convert it into a Blob
      canvas.toBlob(
        (blob) => {
          // Create a new File object from the compressed Blob
          const compressedFile = new File([blob], file.name, {
            type: fileType, // Set the file type to JPEG
            lastModified: Date.now() // Update the last modified timestamp
          });
          // Pass the compressed file to a custom function for further processing
          onImageSelect(setImage, compressedFile);
        },
        fileType, // Output format for the compressed image
        0.3 // Compression quality (30%)
      );
    };
  };

  // Read the file as a data URL (base64 string) to be processed
  reader.readAsDataURL(file);
};
//convert https url to base64
export const fetchImageBase64 = async (imageUrl) => {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const base64data = reader.result;
        resolve(base64data);
      };
      reader.onerror = (error) => {
        reject(error);
      };
    });
  } catch (error) {
    throw new Error("Error converting URL to base64:", error);
  }
};
//function for select image and upload image
export const changeImageWH = async (base64Image) => {
  const newWidth = 300;
  const newHeight = 120;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Image;
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = newWidth;
      canvas.height = newHeight;
      ctx.drawImage(img, 0, 0, newWidth, newHeight);
      const resizedBase64 = canvas.toDataURL("image/png", 1.0);
      resolve(resizedBase64);
    };
    img.onerror = (error) => {
      reject(error);
    };
  });
};

const getWidgetsFontColor = (type) => {
  switch (type) {
    case "red":
      return rgb(1, 0, 0);
    case "black":
      return rgb(0, 0, 0);
    case "blue":
      return rgb(0, 0, 1);
    case "yellow":
      return rgb(0.9, 1, 0);
    default:
      return rgb(0, 0, 0);
  }
};
export const isBase64 = (str) => {
  const base64Pattern =
    /^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+)?;base64,[A-Za-z0-9+/=]+$/;
  return base64Pattern.test(str);
};
// Break a long word into smaller parts character-by-character
const forceBreakLongWord = (word, width, font, fontSize) => {
  const parts = [];
  let current = "";

  for (const char of word) {
    const lineWidth = font.widthOfTextAtSize(current + char, fontSize);

    if (lineWidth <= width) {
      current += char;
    } else {
      parts.push(current);
      current = char;
    }
  }
  if (current) parts.push(current);

  return parts;
};

export const isEmptyValue = (val) =>
  val === null ||
  val === undefined ||
  (typeof val === "string" && val.trim() === "") ||
  (Array.isArray(val) && val.length === 0);

//function for embed all type widgets in document using pdf-lib
export const embedWidgetsToDoc = async (
  widgets,
  pdfDoc,
  signyourself,
  scale,
  prefillImg
) => {
  // `fontBytes` is used to embed custom font in pdf
  const fontBytes = await fileasbytes(
    "https://cdn.opensignlabs.com/webfonts/times.ttf"
  );
  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(fontBytes, { subset: true });
  let hasError = false;
  for (let item of widgets) {
    if (hasError) break; // Stop the outer loop if an error occurred
    const typeExist = item.pos.some((data) => data?.type);
    let updateItem;
    if (typeExist) {
      if (signyourself) {
        updateItem = item.pos;
      } else {
        // Checking required and optional widget types
        // For both required and optional widgets, handle signurl, defaultValue, and response as the widget's data
        // If the widget type is checkbox or radio (whether required or optional), we don't need to validate its value.
        // Instead, add an empty checkbox/radio, or if a value exists, mark the checkbox/radio as checked.
        updateItem = item.pos.filter(
          (data) =>
            data?.options?.SignUrl ||
            !isEmptyValue(data?.options?.defaultValue) ||
            !isEmptyValue(data?.options?.response) ||
            data?.type === "checkbox" ||
            data?.type === radioButtonWidget
        );
      }
    } else {
      updateItem = item.pos;
    }
    const ImgTypeWidget = [
      "signature",
      "stamp",
      "initials",
      "image",
      drawWidget
    ];
    const pageNo = item.pageNumber;
    const widgetsPositionArr = updateItem;
    const pages = pdfDoc.getPages();
    const form = pdfDoc.getForm();
    const page = pages[pageNo - 1];
    // `page.getCropBox()` returns the visible area of the PDF page.
    // It provides an object with the following properties:
    // - x: the x-coordinate of the lower-left corner of the visible area
    // - y: the y-coordinate of the lower-left corner of the visible area
    // - width: the width of the visible area (x1 - x0)
    // - height: the height of the visible area (y1 - y0)
    // If the page does not explicitly define a CropBox, this method returns
    // the MediaBox instead, which represents the full physical size of the page.
    //
    // Example CropBox: [0, 7.92, 612, 799.92]
    // => x = 0, y = 7.92, width = 612 - 0 = 612, height = 799.92 - 7.92 = 792
    // This is equivalent to `react-pdf`'s `page.view` array: [x0, y0, x1, y1]
    const { _, y, width, height } = page.getCropBox();
    const originalHeight = height + y;
    let images;
    const getSize = { height: originalHeight, width: width };
    try {
      images = await Promise.all(
        widgetsPositionArr.map(async (widget) => {
          // `SignUrl` this is wrong nomenclature and maintain for older code in this options we save base64 of signature image from sign pad
          let signbase64 = widget?.options?.response;
          const widgetDims = { Width: widget.Width, Height: widget.Height };
          if (signbase64 && ImgTypeWidget.includes(widget.type)) {
            if (!isBase64(signbase64) && prefillImg) {
              const imgData = prefillImg?.find((x) => x?.id === widget?.key);
              signbase64 = imgData?.base64;
            }
            // let arr = signbase64.split(",");
            // const mime = arr[0].match(/:(.*?);/)[1];
            const signatureImg = await convertBase64ToImg(
              signbase64,
              widgetDims
            );
            const mime = signatureImg?.split(",")?.[0]?.match(/:(.*?);/)?.[1];
            const res = await fetch(signatureImg);
            const arrayBuffer = await res.arrayBuffer();
            const obj = { mimetype: mime, arrayBuffer: arrayBuffer };
            return obj;
          }
        })
      );
    } catch (e) {
      console.log("error in image", e);
    }
    for (let [id, position] of widgetsPositionArr.entries()) {
      const isTextTypeWidget = [
        textWidget,
        textInputWidget,
        cellsWidget,
        "name",
        "company",
        "job title",
        "date",
        "email"
      ].includes(position.type);
      if (hasError) break; // Stop the inner loop if an error occurred
      try {
        let img;
        if (ImgTypeWidget.includes(position.type)) {
          if (images[id].mimetype === "image/png") {
            img = await pdfDoc.embedPng(images[id].arrayBuffer);
          } else {
            img = await pdfDoc.embedJpg(images[id].arrayBuffer);
          }
        } else if (!position.type) {
          //  to handle old widget when only stamp and signature are exists
          if (images[id].mimetype === "image/png") {
            img = await pdfDoc.embedPng(images[id].arrayBuffer);
          } else {
            img = await pdfDoc.embedJpg(images[id].arrayBuffer);
          }
        }
        let widgetWidth, widgetHeight;
        widgetWidth = placeholderWidth(position);
        widgetHeight = placeholderHeight(position);
        const xPos = (position) => {
          const resizePos = position.xPosition;
          //first two condition handle to old data already saved from mobile view which scale point diffrent
          if (isMobile && position.isMobile) {
            //if pos.isMobile false -- placeholder saved from desktop view then handle position in mobile view divided by scale
            const x = resizePos * (position.scale / scale);
            return x * scale;
          } else if (position.isMobile && position.scale) {
            const x = resizePos * position.scale;
            return x;
          } else {
            return resizePos;
          }
        };
        const yPos = (position) => {
          const resizePos = position.yPosition;

          if (position.isMobile && position.scale) {
            if (position.IsResize) {
              const y = resizePos * position.scale;
              return y;
            } else {
              const y = resizePos * position.scale;
              return y;
            }
          } else {
            const yPosition = isTextTypeWidget ? resizePos + 6 : resizePos;
            return yPosition;
          }
        };
        const color = position?.options?.fontColor;
        const updateColorInRgb = getWidgetsFontColor(color);
        const fontSize = parseInt(position?.options?.fontSize || 12);
        if (position.type === "checkbox") {
          // Determine layout mode: 'vertical' (default) or 'horizontal'
          // const isHorizontal = position.layout === "horizontal";
          const isHorizontal =
            position?.options?.layout === "horizontal" ? true : false;
          // Initial “cursor” positions
          let currentX = xPos(position);
          let currentY = yPos(position) + 2;
          // Size and spacing settings
          const checkboxSize = fontSize - 1; // checkbox diameter
          const checkboxTextGapFromLeft = fontSize + 3.4; // gap between box and its label
          const verticalGap = fontSize + 5.5; // gap between two options (vertical layout)
          let horizontalGap = 0; // will compute after drawing each label
          if (position?.options?.values?.length > 0) {
            position.options.values.forEach((item, ind) => {
              // 1. Advance the “cursor” on second+ iteration
              if (ind > 0) {
                if (isHorizontal) {
                  currentX += horizontalGap;
                } else {
                  currentY += verticalGap;
                }
              }
              // 2. Determine whether this checkbox should be checked
              let isCheck = false;
              if (
                position.options.response &&
                position.options.response?.length > 0
              ) {
                isCheck = position.options.response.includes(ind);
              } else if (position.options.defaultValue) {
                isCheck = position.options.defaultValue.includes(ind);
              }

              // 3. Draw the label (if labels are not hidden)
              if (!position.options.isHideLabel) {
                const labelX = currentX + checkboxTextGapFromLeft;
                const labelY = currentY - 3;

                const optionsPosition = compensateRotation(
                  page.getRotation().angle,
                  labelX,
                  labelY,
                  1,
                  getSize,
                  fontSize,
                  updateColorInRgb,
                  font,
                  page
                );
                page.drawText(item, optionsPosition);
              }
              // 4. Create and place the actual checkbox
              const checkboxRandomId = "checkbox" + randomId();
              const checkbox = form.createCheckBox(checkboxRandomId);
              let checkboxObj = {
                x: currentX,
                y: currentY,
                width: checkboxSize,
                height: checkboxSize
              };
              checkboxObj = getWidgetPosition(page, checkboxObj, 1, getSize);
              checkbox.addToPage(page, checkboxObj);
              // 5. Check or uncheck as needed, then make read‐only
              if (isCheck) {
                checkbox.check();
              } else {
                checkbox.uncheck();
              }
              checkbox.enableReadOnly();
              // 6. If horizontal layout, compute how far to shift next checkbox‐circle
              if (isHorizontal) {
                // Measure the width of this label text at `fontSize`
                const textWidth = font.widthOfTextAtSize(item, fontSize);
                // Next checkbox should come after: [box] + gap + [label text] + extra 10pt padding
                const gap = position.options?.isHideLabel
                  ? checkboxTextGapFromLeft - 5
                  : checkboxTextGapFromLeft + textWidth;
                horizontalGap = checkboxSize + gap;
              }
            });
          }
        } else if (isTextTypeWidget) {
          let textContent = "";
          if (!isEmptyValue(position?.options?.response)) {
            if (
              position.type === "date" &&
              position.options?.response === "today"
            ) {
              const getFormat = changeDateToMomentFormat(
                position?.options?.validation?.format
              );
              textContent = moment().format(getFormat);
            } else {
              textContent = position.options?.response;
            }
          } else if (!isEmptyValue(position?.options?.defaultValue)) {
            textContent = position?.options?.defaultValue?.toString();
          }
          if (position.type === cellsWidget) {
            const cellCount =
              position?.options?.cellCount || textContent.length || 1;
            const charWidth = widgetWidth / cellCount;
            const y = yPos(position) - 4;
            for (let i = 0; i < cellCount; i++) {
              const ch = textContent[i] || "";
              const charX =
                xPos(position) +
                charWidth * i +
                (charWidth - font.widthOfTextAtSize(ch, fontSize)) / 2;
              const textPosition = compensateRotation(
                page.getRotation().angle,
                charX,
                y,
                1,
                getSize,
                fontSize,
                updateColorInRgb,
                font,
                page
              );
              if (ch) page.drawText(ch, textPosition);
            }
          } else {
            const fixedWidth = widgetWidth; // Set your fixed
            textContent = textContent?.toString();
            const isNewOnEnterLineExist = textContent?.includes("\n");

            // Function to break text into lines based on the fixed width
            const NewbreakTextIntoLines = (textContent, width) => {
              const lines = [];
              let currentLine = "";

              const words = textContent?.split(" ");
              for (let word of words) {
                const testLine = currentLine ? currentLine + " " + word : word;
                const testWidth = font.widthOfTextAtSize(testLine, fontSize);

                if (testWidth <= width) {
                  currentLine = testLine;
                } else {
                  // If single long word
                  if (font.widthOfTextAtSize(word, fontSize) > width) {
                    // Break a long word into smaller parts character-by-character
                    const brokenParts = forceBreakLongWord(
                      word,
                      width,
                      font,
                      fontSize
                    );

                    // push currentLine before breaking word
                    if (currentLine.trim()) lines.push(currentLine.trim());

                    // push ALL broken parts in order
                    brokenParts.forEach((p) => lines.push(p));

                    currentLine = "";
                  } else {
                    // push current line and start new
                    if (currentLine.trim()) lines.push(currentLine.trim());
                    currentLine = word;
                  }
                }
              }
              if (currentLine.trim()) lines.push(currentLine.trim());
              return lines;
            };
            // Function to break text into lines based on when user go next line on press enter button
            const breakTextIntoLines = (textContent, width) => {
              const finalLines = [];
              const paragraphs = textContent.split("\n"); // preserve user order
              for (const para of paragraphs) {
                const lineWidth = font.widthOfTextAtSize(para, fontSize);
                //checking string length to container width
                //if string length is less then container width it means user press enter button
                if (lineWidth <= width) {
                  // user forced newline
                  finalLines.push(para);
                } else {
                  // auto wrap paragraph
                  finalLines.push(...NewbreakTextIntoLines(para, width));
                }
              }

              return finalLines;
            };
            //check if text content have `\n` string it means user press enter to go next line and handle condition
            //else auto adjust text content according to container width
            const lines = isNewOnEnterLineExist
              ? breakTextIntoLines(textContent, fixedWidth)
              : NewbreakTextIntoLines(textContent, fixedWidth);
            // Set initial y-coordinate for the first line
            let x = xPos(position);
            let y = yPos(position) - 4;
            // Embed each line on the page
            for (const line of lines) {
              const textPosition = compensateRotation(
                page.getRotation().angle,
                x,
                y,
                1,
                getSize,
                fontSize,
                updateColorInRgb,
                font,
                page
              );
              page.drawText(line, textPosition);
              y += 18; // Adjust the line height as needed
            }
          }
        } else if (position.type === "dropdown") {
          const dropdownRandomId = "dropdown" + randomId();
          const dropdown = form.createDropdown(dropdownRandomId);
          dropdown.addOptions(position?.options?.values);
          if (position?.options?.response) {
            dropdown.select(position.options?.response);
          } else if (position?.options?.defaultValue) {
            dropdown.select(position?.options?.defaultValue);
          }
          // Define the default appearance string
          // Example format: `/FontName FontSize Tf 0 g` where:
          // - `/FontName` is the name of the font (e.g., `/Helv` for Helvetica)
          // - `FontSize` is the size you want to set (e.g., 12)
          // - `Tf` specifies the font and size
          // - `0 g` sets the text color to black
          const defaultAppearance = `/Helv ${fontSize} Tf 0 g`;
          // Set the default appearance for the dropdown field
          dropdown.acroField.setDefaultAppearance(defaultAppearance);
          dropdown.setFontSize(fontSize);
          const dropdownObj = {
            x: xPos(position),
            y: yPos(position),
            width: widgetWidth,
            height: widgetHeight
          };
          const dropdownOption = getWidgetPosition(
            page,
            dropdownObj,
            1,
            getSize
          );
          const dropdownSelected = {
            ...dropdownOption,
            font: font,
            textColor: updateColorInRgb
          };
          dropdown.defaultUpdateAppearances(font);
          dropdown.addToPage(page, dropdownSelected);
          dropdown.enableReadOnly();
        } else if (position.type === radioButtonWidget) {
          const radioRandomId = "radio" + randomId();
          const radioGroup = form.createRadioGroup(radioRandomId);
          //getting radio buttons options text font size
          const optionsFontSize = fontSize; // font size for option text
          const radioTextGapFromLeft = fontSize + 3; // gap between circle and its label
          const radioSize = fontSize; // circle diameter (square of width×height)
          // Initial “cursor” positions (from your existing helpers)
          let currentX = xPos(position) + 2;
          let currentY = yPos(position) + 3;
          // Vertical gap between two options
          const verticalGap = fontSize + 5;
          // We’ll compute horizontalGap on the fly—after drawing each label
          // Initialize to zero (will be set after first option is placed)
          let horizontalGap = 0;
          // Determine layout mode: 'vertical' or 'horizontal'.
          // (You mentioned “add one variable called layout” – here we read it from position.layout.)
          const isHorizontal =
            position?.options?.layout === "horizontal" ? true : false;
          // Loop through each option in the group
          if (position?.options?.values?.length > 0) {
            position.options.values.forEach((item, ind) => {
              // 1. Advance cursor on second+ iteration
              if (ind > 0) {
                if (isHorizontal) {
                  // Move to the right by horizontalGap
                  currentX += horizontalGap;
                } else {
                  // Move down by verticalGap (vertical stacking)
                  currentY += verticalGap;
                }
              }
              // 2. Draw the label text (if not hidden)
              if (!position?.options?.isHideLabel) {
                // Compute where to draw the text (just to the right of the circle)
                const labelX = currentX + radioTextGapFromLeft;
                const labelY = currentY - 2;
                const optionsPosition = compensateRotation(
                  page.getRotation().angle,
                  labelX,
                  labelY,
                  1,
                  getSize,
                  optionsFontSize,
                  updateColorInRgb,
                  font,
                  page
                );

                page.drawText(item, optionsPosition);
              }
              // 3. Place the radio‐circle itself at (currentX, currentY)
              let radioObj = {
                x: currentX,
                y: currentY,
                width: radioSize,
                height: radioSize
              };

              radioObj = getWidgetPosition(page, radioObj, 1, getSize);
              radioGroup.addOptionToPage(item, page, radioObj);
              // 4. If horizontal layout, re-compute horizontalGap for next iteration:
              if (isHorizontal) {
                // Measure how wide the label text is, so we know how far to shift next circle
                const textWidth = font.widthOfTextAtSize(item, optionsFontSize);
                // radioSize = the circle.  radioTextGapFromLeft = gap between circle and label.
                // Add a small extra padding (e.g. 10pt) before placing next circle.
                const gap = position?.options?.isHideLabel
                  ? radioTextGapFromLeft - 6
                  : radioTextGapFromLeft + textWidth;
                horizontalGap = radioSize + gap;
              }
            });
          }
          const isOptionExist = position?.options?.values?.some(
            (x) =>
              x === position?.options?.response ||
              position?.options?.defaultValue
          );
          if (isOptionExist) {
            // 5. Pre‐select a value if provided
            if (position?.options?.response) {
              radioGroup.select(position.options?.response);
            } else if (position?.options?.defaultValue) {
              radioGroup.select(position?.options?.defaultValue);
            }
          }
          // 6. Set to read‐only (if required)
          radioGroup.enableReadOnly();
        } else {
          const widgetRotation = position?.options?.rotation || 0;
          const isSwapped = [90, 270].includes(widgetRotation);
          // Use visual (swapped) dimensions to compute the correct position
          const signature = {
            x: xPos(position),
            y: yPos(position),
            width: isSwapped ? widgetHeight : widgetWidth,
            height: isSwapped ? widgetWidth : widgetHeight
          };
          const imageOptions = getWidgetPosition(page, signature, 1, getSize);
          if (widgetRotation) {
            const pageRotation = page.getRotation().angle;
            const combinedRotation = degrees(
              (imageOptions.rotate?.angle || pageRotation) - widgetRotation
            );
            const visualWidth = imageOptions.width;
            const visualHeight = imageOptions.height;
            if (isSwapped) {
              // Override with original (unswapped) dimensions for the actual image
              imageOptions.width = visualHeight;
              imageOptions.height = visualWidth;
            }
            imageOptions.rotate = combinedRotation;
            // Adjust position to compensate for pdf-lib rotation pivot (bottom-left corner)
            if (widgetRotation === 90) {
              imageOptions.y += visualHeight;
            } else if (widgetRotation === 180) {
              imageOptions.x += imageOptions.width;
              imageOptions.y += imageOptions.height;
            } else if (widgetRotation === 270) {
              imageOptions.x += visualWidth;
            }
          }
          page.drawImage(img, imageOptions);
        }
      } catch (err) {
        console.log("Err in embed widget on page ", pageNo, err);
        hasError = true; // Set the flag to stop both loops
        break; // Exit inner loop
      }
    }
    form?.flatten();
  }
  if (!hasError) {
    const pdfBytes = await pdfDoc.saveAsBase64({ useObjectStreams: false });
    return pdfBytes;
  } else {
    return {
      error:
        "This pdf is not compatible with opensign please contact <support@opensignlabs.com>"
    };
  }
};

// function for validating URLs
export function urlValidator(url) {
  try {
    const newUrl = new URL(url);
    return newUrl.protocol === "http:" || newUrl.protocol === "https:";
  } catch (err) {
    return false;
  }
}
//calculate placeholder width to embed in pdf
export const placeholderWidth = (pos) => {
  const defaultWidth = defaultWidthHeight(pos.type).width;
  const posWidth = pos.Width || defaultWidth;
  //condition to handle old data saved from mobile view to get widthh
  if (pos.isMobile && pos.scale) {
    return pos.IsResize ? posWidth : posWidth * pos.scale;
  } else {
    return posWidth;
  }
};

//calculate placeholder height to embed in pdf
export const placeholderHeight = (pos) => {
  const posHeight = pos.Height;
  const defaultHeight = defaultWidthHeight(pos.type).height;
  const posUpdateHeight = posHeight || defaultHeight;

  //condition to handle old data saved from mobile view to get height
  if (pos.isMobile && pos.scale) {
    return pos.IsResize ? posUpdateHeight : posUpdateHeight * pos.scale;
  } else {
    return posUpdateHeight;
  }
};

//function for getting contracts_contactbook details
export const contactBook = async (objectId) => {
  try {
    const url = `${localStorage.getItem("baseUrl")}classes/contracts_Contactbook?where={"objectId":"${objectId}"}`;
    const headers = {
      "Content-Type": "application/json",
      "X-Parse-Application-Id": localStorage.getItem("parseAppId"),
      "X-Parse-Session-Token": localStorage.getItem("accesstoken")
    };
    const axiosRes = await axios.get(url, { headers });
    const result = axiosRes?.data?.results;
    return result;
  } catch (error) {
    console.error("contracts_Contactbook error", err);
    return "Error: Something went wrong!";
  }
};

//function for getting document details from contract_Documents class
export const contractDocument = async (documentId, include) => {
  const data = { docId: documentId, include: include };
  const token = { sessionToken: localStorage.getItem("accesstoken") };
  const documentDeatils = await axios
    .post(`${localStorage.getItem("baseUrl")}functions/getDocument`, data, {
      headers: {
        "Content-Type": "application/json",
        "X-Parse-Application-Id": localStorage.getItem("parseAppId"),
        ...token
      }
    })
    .then((Listdata) => {
      const json = Listdata.data;
      let data = [];
      if (json && json.result.error) {
        return json;
      } else if (json && json.result) {
        data.push(json.result);
        return data;
      } else {
        return [];
      }
    })
    .catch((err) => {
      console.log("Err in getDocument cloud function ", err);
      return "Error: Something went wrong!";
    });

  return documentDeatils;
};

//function for add default signature or image for all requested location
export const addDefaultSignatureImg = (xyPosition, defaultSignImg, type) => {
  let xyDefaultPos = [];
  for (let i = 0; i < xyPosition.length; i++) {
    const getXYdata = xyPosition[i].pos;
    const getPageNo = xyPosition[i].pageNumber;
    const getPosData = getXYdata;

    const addSign = getPosData.map((position) => {
      if (position.type) {
        if (position?.type === type) {
          return {
            ...position,
            SignUrl: defaultSignImg,
            ImageType: "default",
            options: { ...position.options, response: defaultSignImg }
          };
        }
      } else if (position && !position.isStamp) {
        return {
          ...position,
          SignUrl: defaultSignImg,
          ImageType: "default",
          options: { ...position.options, response: defaultSignImg }
        };
      }
      return position;
    });

    const newXypos = { pageNumber: getPageNo, pos: addSign };
    xyDefaultPos.push(newXypos);
  }
  return xyDefaultPos;
};

//function for get month
export const getMonth = (date) => {
  const newMonth = new Date(date).getMonth();
  return newMonth;
};
//function to create/copy widget next to already dropped widget
export const handleCopyNextToWidget = (
  newId,
  position,
  xyPosition,
  index,
  setXyPosition,
  pdfOriginalWH,
  userId
) => {
  let filterSignerPos;

  //Get page dimensions
  const page = pdfOriginalWH?.find((x) => x?.pageNumber === index);

  const pageWidth = page?.width;
  const pageHeight = page?.height;

  // Widget dimensions (fallback safe values)
  const widgetWidth = position?.width || 150;

  const widgetHeight = position?.height || 60;

  const gap = 10;

  //Default copy (slightly right + down)
  let newX = parseInt(position.xPosition) + gap;
  let newY = parseInt(position.yPosition) + gap;

  // Prevent RIGHT overflow
  if (pageWidth && newX + widgetWidth > pageWidth) {
    newX = parseInt(position.xPosition) - gap;
  }
  if (newX < 0) newX = 0;

  //  Prevent BOTTOM overflow
  if (pageHeight && newY + widgetHeight > pageHeight) {
    newY = pageHeight - widgetHeight - gap;
  }

  if (newY < 0) newY = 0;

  const widgetName = `${position?.type}${randomId(2)}`;

  const newposition = {
    ...position,
    xPosition: newX,
    yPosition: newY,
    key: newId,
    options: { ...position?.options, name: widgetName }
  };

  //Your existing update logic

  if (userId) {
    filterSignerPos = xyPosition.find((data) => data.Id === userId);
    const getPlaceHolder = filterSignerPos?.placeHolder;
    const getPageNumer = getPlaceHolder?.filter(
      (data) => data.pageNumber === index
    );
    const getXYdata = getPageNumer?.[0]?.pos || [];
    getXYdata.push(newposition);
    if (getPageNumer && getPageNumer.length > 0) {
      const newUpdateSignPos = getPlaceHolder.map((obj) => {
        if (obj.pageNumber === index) {
          return { ...obj, pos: getXYdata };
        }
        return obj;
      });

      const newUpdateSigner = xyPosition.map((obj) => {
        if (obj.Id === userId) {
          return { ...obj, placeHolder: newUpdateSignPos };
        }
        return obj;
      });

      setXyPosition(newUpdateSigner);
    }
  } else {
    const getPageNumer = xyPosition?.find((data) => data.pageNumber === index);
    const getXYdata = getPageNumer?.pos;

    getXYdata.push(newposition);
    const updatePlaceholder = xyPosition.map((obj, ind) => {
      if (obj?.pageNumber === index) {
        return { ...obj, pos: getXYdata };
      }
      return obj;
    });
    setXyPosition(updatePlaceholder);
  }
};

export const getFileName = (fileUrl) => {
  if (fileUrl) {
    const url = new URL(fileUrl);
    const filename = url.pathname.substring(url.pathname.indexOf("_") + 1);
    return filename || "";
  } else {
    return "";
  }
};

//fetch tenant app logo from `partners_Tenant` class by domain name
export const getAppLogo = async () => {
  const domain = window.location.host;
  try {
    const tenant = await Parse.Cloud.run("getlogobydomain", {
      domain: domain
    });
    if (tenant) {
      const resolvedFavicon =
        tenant?.favicon || tenant?.logo || appInfo.fev_Icon;
      localStorage.setItem("appname", "OpenSign™");
      localStorage.setItem("favicon", appInfo.fev_Icon);
      return {
        logo: tenant?.logo,
        favicon: resolvedFavicon,
        user: tenant?.user
      };
    }
  } catch (err) {
    console.log("err in getlogo ", err);
    localStorage.setItem("favicon", appInfo.fev_Icon);
    if (err?.message?.includes("valid JSON")) {
      return { logo: appInfo.applogo, user: "exist", error: "invalid_json" };
    } else {
      return { logo: appInfo.applogo, user: "exist" };
    }
  }
};
export const getTenantDetails = async (objectId, contactId) => {
  try {
    const url = `${localStorage.getItem("baseUrl")}functions/gettenant`;
    const parseAppId = localStorage.getItem("parseAppId");
    const accesstoken = localStorage.getItem("accesstoken");
    const token = { "X-Parse-Session-Token": accesstoken };
    const data = { userId: objectId, contactId: contactId };
    const res = await axios.post(url, data, {
      headers: {
        "Content-Type": "application/json",
        "X-Parse-Application-Id": parseAppId,
        ...token
      }
    });
    if (res.data.result) {
      const updateRes = JSON.parse(JSON.stringify(res.data.result));
      return updateRes;
    } else {
      return "";
    }
  } catch (err) {
    console.log("err in gettenant", err);
    return "user does not exist!";
  }
};

//function to convert variable string name to variable value of email body and subject
export function replaceMailVaribles(subject, body, variables) {
  let replacedSubject = subject;
  let replacedBody = body;

  for (const variable in variables) {
    const regex = new RegExp(`{{${variable}}}`, "g");
    if (subject) {
      replacedSubject = replacedSubject.replace(regex, variables[variable]);
    }
    if (body) {
      replacedBody = replacedBody.replace(regex, variables[variable]);
    }
  }

  const result = {
    subject: replacedSubject,
    body: replacedBody
  };
  return result;
}

export const copytoData = (url) => {
  // navigator.clipboard.writeText(text);
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url);
  } else {
    // Fallback for browsers that don't support navigator.clipboard
    const textArea = document.createElement("textarea");
    textArea.value = url;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
  }
};

export const convertPdfArrayBuffer = async (url) => {
  try {
    const response = await fetch(url);
    // Check if the response was successful (status 200)
    if (!response.ok) {
      return "Error";
    }
    // Convert the response to ArrayBuffer
    const arrayBuffer = await response.arrayBuffer();
    return arrayBuffer;
  } catch (error) {
    console.error("Error fetching data:", error);
    return "Error";
  }
};
//`handleSendOTP` function is used to send otp on user's email using `SendOTPMailV1` cloud function
export const handleSendOTP = async (email) => {
  try {
    let url = `${localStorage.getItem("baseUrl")}functions/SendOTPMailV1`;
    const headers = {
      "Content-Type": "application/json",
      "X-Parse-Application-Id": localStorage.getItem("parseAppId")
    };
    const body = {
      email: email
    };
    await axios.post(url, body, { headers: headers });
  } catch (error) {
    alert(error.message);
  }
};
export const fetchUrl = async (url, fileName) => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      alert(i18n.t("something-went-wrong-mssg"));
      throw new Error("Network response was not ok");
    }
    const blob = await response.blob();
    saveAs(blob, fileName);
  } catch (error) {
    alert(i18n.t("something-went-wrong-mssg"));
    console.error("Error downloading the file:", error);
  }
};

export const getSignedUrl = async (pdfUrl, docId, templateId) => {
  //use only axios here due to public template sign
  const token = {
    "X-Parse-Session-Token": localStorage.getItem("accesstoken")
  };
  const axiosRes = await axios.post(
    `${localStorage.getItem("baseUrl")}/functions/getsignedurl`,
    {
      url: pdfUrl,
      docId: docId || "",
      templateId: templateId || ""
    },
    {
      headers: {
        "content-type": "Application/json",
        "X-Parse-Application-Id": localStorage.getItem("parseAppId"),
        ...token
      }
    }
  );
  const url = axiosRes.data.result;
  return url;
};
//download base64 type pdf
export const fetchBase64 = async (pdfBase64, pdfName) => {
  // Create a Blob from the Base64 string
  const byteCharacters = atob(pdfBase64);
  const byteNumbers = new Array(byteCharacters.length)
    .fill(0)
    .map((_, i) => byteCharacters.charCodeAt(i));
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: "application/pdf" });

  // Create a link element
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = pdfName;

  // Programmatically click the link to trigger the download
  document.body.appendChild(link);
  link.click();

  // Clean up
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};
//handle download signed pdf
export const handleDownloadPdf = async (
  pdfDetails,
  setIsDownloading,
  pdfBase64
) => {
  const pdfName =
    pdfDetails?.[0]?.Name?.length > 100
      ? pdfDetails?.[0]?.Name?.slice(0, 100)
      : pdfDetails?.[0]?.Name || "Document";
  const isCompleted = pdfDetails?.[0]?.IsCompleted || false;
  const formatId = pdfDetails?.[0]?.ExtUserPtr?.DownloadFilenameFormat;
  const docName = buildDownloadFilename(formatId, {
    docName: pdfName,
    email: pdfDetails?.[0]?.ExtUserPtr?.Email,
    isSigned: isCompleted
  });
  if (pdfBase64) {
    await fetchBase64(pdfBase64, docName);
    setIsDownloading && setIsDownloading("");
  } else {
    const pdfUrl = pdfDetails?.[0]?.SignedUrl || pdfDetails?.[0]?.URL;
    setIsDownloading && setIsDownloading("pdf");
    const docId = pdfDetails?.[0]?.objectId || "";
    try {
      const url = await getSignedUrl(pdfUrl, docId);
      await fetchUrl(url, docName);
      setIsDownloading && setIsDownloading("");
    } catch (err) {
      console.log("err in getsignedurl", err);
      setIsDownloading("");
      alert(i18n.t("something-went-wrong-mssg"));
    }
  }
};

export function fileNameWithUnderscore(pdfName) {
  // Replace spaces with underscore
  return pdfName.replace(/ /g, "_");
}
//function for print digital sign pdf
export const handleToPrint = async (event, setIsDownloading, pdfDetails) => {
  event.preventDefault();
  setIsDownloading("pdf");
  const pdfUrl = pdfDetails?.[0]?.SignedUrl || pdfDetails?.[0]?.URL;
  const docId = pdfDetails?.[0]?.objectId || "";

  try {
    // const url = await Parse.Cloud.run("getsignedurl", { url: pdfUrl });
    //`localStorage.getItem("baseUrl")` is also use in public-profile flow for public-sign
    //if we give this `appInfo.baseUrl` as a base url then in public-profile it will create base url of it's window.location.origin ex- opensign.me which is not base url
    const axiosRes = await axios.post(
      `${localStorage.getItem("baseUrl")}/functions/getsignedurl`,
      {
        url: pdfUrl,
        docId: docId
      },
      {
        headers: {
          "content-type": "Application/json",
          "X-Parse-Application-Id": localStorage.getItem("parseAppId"),
          "X-Parse-Session-Token": localStorage.getItem("accesstoken")
        }
      }
    );
    const url = axiosRes.data.result;
    const pdf = await getBase64FromUrl(url);
    const isAndroidDevice = navigator.userAgent.match(/Android/i);
    const isAppleDevice =
      (/iPad|iPhone|iPod/.test(navigator.platform) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) &&
      !window.MSStream;
    if (isAndroidDevice || isAppleDevice) {
      const byteArray = Uint8Array.from(
        atob(pdf)
          .split("")
          .map((char) => char.charCodeAt(0))
      );
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
      setIsDownloading("");
    } else {
      printModule({ printable: pdf, type: "pdf", base64: true });
      setIsDownloading("");
    }
  } catch (err) {
    setIsDownloading("");
    console.log("err in getsignedurl", err);
    alert(i18n.t("something-went-wrong-mssg"));
  }
};
const downloadCertificate = async (certificate, isZip, asBlob) => {
  try {
    const appName = "OpenSign™";
    const certificateUrl = certificate;
    if (isZip) {
      return certificateUrl;
    } else {
      if (asBlob) {
        const fetchCertificate = await fetch(certificateUrl);
        // Convert the response into a Blob
        const blob = await fetchCertificate.blob();
        saveAs(blob, `Certificate_signed_by_${appName}.pdf`);
        return;
      }
      saveAs(certificateUrl, `Certificate_signed_by_${appName}.pdf`);
    }
  } catch (err) {
    console.error("download certificate err", err);
  }
};

//handle download signed pdf
export const handleDownloadCertificate = async (
  pdfDetails,
  setIsDownloading,
  isZip
) => {
  const baseUrl = `${localStorage.getItem("baseUrl")}functions`;
  const parseAppId = localStorage.getItem("parseAppId");
  const sessionToken = localStorage.getItem("accesstoken");
  const docId = pdfDetails?.[0]?.objectId;
  const initialCertificateUrl = pdfDetails?.[0]?.CertificateUrl;
  const headers = {
    "Content-Type": "application/json",
    "X-Parse-Application-Id": parseAppId
  };

  if (initialCertificateUrl) {
    return await downloadCertificate(initialCertificateUrl, isZip);
  } else {
    setIsDownloading("certificate");
    try {
      const data = { docId: docId };
      const docDetails = await axios.post(`${baseUrl}/getDocument`, data, {
        headers: { ...headers, sessionToken }
      });
      const cert = docDetails?.data?.result?.CertificateUrl;
      if (cert) {
        const certificateUrl = await downloadCertificate(cert, isZip);
        setIsDownloading("");
        return certificateUrl;
      } else {
        const generateRes = await axios.post(
          `${baseUrl}/generatecertificate`,
          data,
          { headers }
        );
        const certificate = generateRes?.data?.result?.CertificateUrl;
        if (certificate) {
          try {
            const certificateUrl = await downloadCertificate(
              certificate,
              isZip,
              true
            );
            setIsDownloading("");
            return certificateUrl;
          } catch (err) {
            console.error("download certificate err", err);
            setIsDownloading("certificate_err");
          }
        } else {
          setIsDownloading("certificate_err");
        }
      }
    } catch (err) {
      setIsDownloading("certificate_err");
      console.error("download certificate err", err);
      alert(i18n.t("something-went-wrong-mssg"));
    }
  }
  return null;
};
// Function to escape special characters in the search string
export function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // Escape special characters
}
export async function findContact(value) {
  try {
    const baseURL = localStorage.getItem("baseUrl");
    const url = `${baseURL}functions/getsigners`;
    const token = {
      "X-Parse-Session-Token": localStorage.getItem("accesstoken")
    };
    const headers = {
      "Content-Type": "application/json",
      "X-Parse-Application-Id": localStorage.getItem("parseAppId"),
      ...token
    };
    const axiosRes = await axios.post(url, { search: value }, { headers });
    const contactRes = axiosRes?.data?.result || [];
    if (contactRes) {
      const res = JSON.parse(JSON.stringify(contactRes));
      return res;
    }
  } catch (error) {
    console.error("Error fetching suggestions:", error);
  }
}
// `compensateRotation` is used to calculate x and y position of widget on portait, landscape pdf for pdf-lib
function compensateRotation(
  pageRotation,
  x,
  y,
  scale,
  dimensions,
  fontSize,
  updateColorInRgb,
  font,
  page
) {
  // Ensure pageRotation is between 0 and 360 degrees
  pageRotation = ((pageRotation % 360) + 360) % 360;
  let rotationRads = (pageRotation * Math.PI) / 180;

  // Coordinates are from bottom-left
  let coordsFromBottomLeft = { x: x / scale };
  if (pageRotation === 90 || pageRotation === 270) {
    coordsFromBottomLeft.y = dimensions.width - (y + fontSize) / scale;
  } else {
    coordsFromBottomLeft.y = dimensions.height - (y + fontSize) / scale;
  }

  let drawX = null;
  let drawY = null;

  if (pageRotation === 90) {
    drawX =
      coordsFromBottomLeft.x * Math.cos(rotationRads) -
      coordsFromBottomLeft.y * Math.sin(rotationRads) +
      dimensions.width;
    drawY =
      coordsFromBottomLeft.x * Math.sin(rotationRads) +
      coordsFromBottomLeft.y * Math.cos(rotationRads);
  } else if (pageRotation === 180) {
    drawX =
      coordsFromBottomLeft.x * Math.cos(rotationRads) -
      coordsFromBottomLeft.y * Math.sin(rotationRads) +
      dimensions.width;
    drawY =
      coordsFromBottomLeft.x * Math.sin(rotationRads) +
      coordsFromBottomLeft.y * Math.cos(rotationRads) +
      dimensions.height;
  } else if (pageRotation === 270) {
    drawX =
      coordsFromBottomLeft.x * Math.cos(rotationRads) -
      coordsFromBottomLeft.y * Math.sin(rotationRads);
    drawY =
      coordsFromBottomLeft.x * Math.sin(rotationRads) +
      coordsFromBottomLeft.y * Math.cos(rotationRads) +
      dimensions.height;
  } else if (pageRotation === 0 || pageRotation === 360) {
    // No rotation or full rotation
    drawX = coordsFromBottomLeft.x;
    drawY = coordsFromBottomLeft.y;
  }
  if (font) {
    return {
      x: drawX,
      y: drawY,
      font,
      color: updateColorInRgb,
      size: fontSize,
      rotate: page.getRotation()
    };
  } else {
    return { x: drawX, y: drawY };
  }
}

// `getWidgetPosition` is used to calulcate position of image type widget like x, y, width, height for pdf-lib
function getWidgetPosition(page, image, sizeRatio, getSize) {
  let pageWidth;
  // pageHeight;
  if ([90, 270].includes(page.getRotation().angle)) {
    pageWidth = getSize?.height || page.getHeight();
  } else {
    pageWidth = getSize?.width || page.getWidth();
  }
  // eslint-disable-next-line
  if (!image?.hasOwnProperty("vpWidth")) {
    image["vpWidth"] = pageWidth;
  }
  const pageRatio = pageWidth / (image.vpWidth * sizeRatio);
  const imageWidth = image.width * sizeRatio * pageRatio;
  const imageHeight = image.height * sizeRatio * pageRatio;
  const imageX = image.x * sizeRatio * pageRatio;
  const imageYFromTop = image.y * sizeRatio * pageRatio;

  const correction = compensateRotation(
    page.getRotation().angle,
    imageX,
    imageYFromTop,
    1,
    getSize,
    imageHeight
  );

  return {
    width: imageWidth,
    height: imageHeight,
    x: correction.x,
    y: correction.y,
    rotate: page.getRotation()
  };
}
//function to use calculate pdf rendering scale in the container
export const getContainerScale = (pdfOriginalWH, pageNumber, containerWH) => {
  const getPdfPageWidth = pdfOriginalWH.find(
    (data) => data.pageNumber === pageNumber
  );
  const containerScale = containerWH?.width / getPdfPageWidth?.width || 1;
  return containerScale;
};

//function to get current laguage and set it in local
export const saveLanguageInLocal = (i18n) => {
  const detectedLanguage = i18n.language || "en";
  localStorage.setItem("i18nextLng", detectedLanguage);
};

// function to get default signature of current user from `contracts_Signature` class
export const getDefaultSignature = async (objectId) => {
  try {
    if (objectId) {
      const result = await Parse.Cloud.run("getdefaultsignature", {
        userId: objectId
      });
      if (result) {
        const res = JSON.parse(JSON.stringify(result));
        const defaultSignature = res?.ImageURL
          ? await getBase64FromUrl(res?.ImageURL, true)
          : "";
        const defaultInitial = res?.Initials
          ? await getBase64FromUrl(res?.Initials, true)
          : "";
        const defaultStamp = res?.Stamp
          ? await getBase64FromUrl(res?.Stamp, true)
          : "";

        return {
          status: "success",
          res: {
            id: result?.id,
            defaultSignature: defaultSignature,
            defaultInitial: defaultInitial,
            defaultStamp: defaultStamp
          }
        };
      }
    } else {
      return { status: "error" };
    }
  } catch (err) {
    console.log(
      "Error: error in fetch data in contracts_Signature",
      err?.message || err
    );
    return { status: "error" };
  }
};

//function to rotate pdf page
export async function rotatePdfPage(rotateDegree, pageNumber, pdfArrayBuffer) {
  // Load the existing PDF
  const pdfDoc = await PDFDocument.load(pdfArrayBuffer);
  // Get the page according to page number
  const page = pdfDoc.getPage(pageNumber);
  //get current page rotation angle
  const currentRotation = page.getRotation().angle;
  // Apply the rotation in the counterclockwise direction
  let newRotation = (currentRotation + rotateDegree) % 360;
  // Adjust for negative angles to keep within 0-359 range
  if (newRotation < 0) {
    newRotation += 360;
  }
  page.setRotation(degrees(newRotation));
  const pdfbase64 = await pdfDoc.saveAsBase64({ useObjectStreams: false });
  //convert base64 to arraybuffer is used in pdf-lib
  //pdfbase64 is used to show pdf rotated format
  const arrayBuffer = base64ToArrayBuffer(pdfbase64);
  //`base64` is used to show pdf
  return { arrayBuffer: arrayBuffer, base64: pdfbase64 };
}
export function base64ToArrayBuffer(base64) {
  // Decode the base64 string to a binary string
  const binaryString = atob(base64);
  // Create a new ArrayBuffer with the same length as the binary string
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  // Convert the binary string to a byte array
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  // Return the ArrayBuffer
  return bytes.buffer;
}
export function removeBase64Prefix(base64String) {
  return base64String.replace(/^data:.*;base64,/, "");
}

export const convertBase64ToFile = async (pdfName, pdfBase64, imgType) => {
  let base64Str = pdfBase64;
  const mime = imgType && imgType?.split("/")?.pop();
  let fileName =
    fileNameWithUnderscore(pdfName) + (imgType ? `.${mime}` : ".pdf");
  try {
    fileName = imgType ? pdfName : fileName;
    const pdfFile = new Parse.File(fileName, { base64: base64Str });
    // Save the Parse File if needed
    const pdfData = await pdfFile.save();
    const pdfUrl = pdfData.url();
    const fileRes = await getSecureUrl(pdfUrl);
    if (fileRes?.url) {
      return fileRes.url;
    }
  } catch (e) {
    console.log("error in convertbase64tofile", e);
  }
};

// Shared ref that holds a pending scroll restore job for button zoom.
// RenderPdf reads this in its scale-change useEffect (same pattern as pinch).
export const pendingButtonZoomScrollRef = { current: null };

/**
 * Call this with the scroll container ref so the zoom utils can snapshot
 * the current scroll position BEFORE setScale triggers a re-render.
 *
 * Anchors zoom to the visible center of the viewport, so the page content
 * under your eyes stays in place rather than jumping to the top.
 */
const captureScrollForButtonZoom = (scrollContainerRef, scale, newScale) => {
  const el = scrollContainerRef?.current;
  if (!el) return;

  const scaleRatio = newScale / scale;

  // Anchor point = center of the visible scroll container
  const midRelX = el.clientWidth / 2;
  const midRelY = el.clientHeight / 2;

  const docX = el.scrollLeft + midRelX;
  const docY = el.scrollTop + midRelY;

  const newScrollLeft = Math.max(0, docX * scaleRatio - midRelX);
  const newScrollTop = Math.max(0, docY * scaleRatio - midRelY);

  pendingButtonZoomScrollRef.current = { newScrollLeft, newScrollTop };
};

export const onClickZoomIn = (scale, setScale, scrollContainerRef) => {
  // Find last step smaller than current scale
  const nextScale = SCALE_STEPS.find((s) => s > scale);
  if (!nextScale) return;
  captureScrollForButtonZoom(scrollContainerRef, scale, nextScale);
  setScale(nextScale);
};

export const onClickZoomOut = (scale, setScale, scrollContainerRef) => {
  // Find last step smaller than current scale
  const prevScale = [...SCALE_STEPS].reverse().find((s) => s < scale);
  if (!prevScale || prevScale < 1.0) return;
  captureScrollForButtonZoom(scrollContainerRef, scale, prevScale);
  setScale(prevScale);
};
//function to use remove widgets from current page when user want to rotate page
export const handleRemoveWidgets = (
  setSignerPos,
  signerPos,
  pageNumber,
  setIsRotate
) => {
  const isSigners = signerPos.some((data) => data.signerPtr);
  //placeholder,template,draftTemplate flow
  if (isSigners) {
    const updatedSignerPos = signerPos.map((placeholderObj) => {
      return {
        ...placeholderObj,
        placeHolder: placeholderObj?.placeHolder?.filter(
          (data) => data?.pageNumber !== pageNumber
        )
      };
    });

    if (setIsRotate) {
      setSignerPos(updatedSignerPos);
      setIsRotate({ status: false, degree: 0 });
    } else {
      //after deleting pdf page we need to update page number of widgets
      //For example, consider a PDF with 3 pages where widgets are placed on the 2nd page.
      //If we delete the 1st page, the total number of pages will be reduced to 2. In this case,
      // the widgets need to be updated to reflect the new page numbering and should now appear on the 1st page.
      const updatePageNumber = updatedSignerPos?.map((placeholderObj) => {
        return {
          ...placeholderObj,
          placeHolder: placeholderObj?.placeHolder?.map((data) => {
            if (data.pageNumber > pageNumber) {
              return { ...data, pageNumber: data.pageNumber - 1 };
            } else {
              return data;
            }
          })
        };
      });
      setSignerPos(updatePageNumber);
    }
  } else {
    //signyourself flow
    const updatedSignerPos = signerPos?.filter(
      (data) => data?.pageNumber !== pageNumber
    );
    if (setIsRotate) {
      setSignerPos(updatedSignerPos);
      setIsRotate({ status: false, degree: 0 });
    } else {
      //after deleting pdf page we need to update page number of widgets
      //For example, consider a PDF with 3 pages where widgets are placed on the 2nd page.
      //If we delete the 1st page, the total number of pages will be reduced to 2. In this case,
      // the widgets need to be updated to reflect the new page numbering and should now appear on the 1st page.
      const updatePageNumber = updatedSignerPos?.map((data) => {
        if (data.pageNumber > pageNumber) {
          return { ...data, pageNumber: data.pageNumber - 1 };
        } else {
          return data;
        }
      });
      setSignerPos(updatePageNumber);
    }
  }
};
//function to show warning when user rotate page and there are some already widgets on that page
export const handleRotateWarning = (signerPos, pageNumber) => {
  const placeholderExist = signerPos?.some((placeholderObj) =>
    placeholderObj?.placeHolder?.some((data) => data?.pageNumber === pageNumber)
  );
  return placeholderExist ? true : false;
};

// `generateTitleFromFilename` to generate Title of document from file name
export function generateTitleFromFilename(filename) {
  try {
    // Step 1: Trim whitespace
    let title = filename.trim();

    // Step 2: Remove the file extension (everything after the last '.')
    const lastDotIndex = title.lastIndexOf(".");
    if (lastDotIndex > 0) {
      title = title.substring(0, lastDotIndex);
    }

    // Step 3: Replace special characters (except Unicode letters, digits, spaces, and hyphens)
    title = title.replace(/[^\p{L}\p{N}\s-]/gu, " ");

    // Step 4: Replace multiple spaces with a single space
    title = title.replace(/\s+/g, " ");

    // Step 5: Capitalize first letter of each word (Title Case), handling Unicode characters
    title = title.replace(
      /\p{L}\S*/gu,
      (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );

    // Step 6: Restrict length of title (optional, let's say 100 characters)
    if (title.length > 100) {
      title = title.substring(0, 100).trim();
    }

    // Step 7: Handle empty or invalid title by falling back to "Untitled Document"
    if (!title || title.length === 0) {
      return "Untitled Document";
    }

    return title;
  } catch (error) {
    // Handle unexpected errors gracefully by returning a default title
    console.error("Error generating title from filename:", error);
    return "Untitled Document";
  }
}

export const signatureTypes = [
  { name: "draw", enabled: true },
  { name: "typed", enabled: true },
  { name: "upload", enabled: true },
  { name: "default", enabled: true }
];

// `handleSignatureType` is used to return update signature types as per tenant or user
export async function handleSignatureType(tenantSignTypes, signatureType) {
  const docSignTypes = signatureType || signatureTypes;
  let updatedSignatureType = signatureType || signatureTypes;
  if (tenantSignTypes?.length > 0) {
    updatedSignatureType = tenantSignTypes?.map((item) => {
      const match = docSignTypes.find((data) => data.name === item.name);
      return match ? { ...item, enabled: match.enabled } : item;
    });
  }
  return updatedSignatureType;
}

// `formatDateToDdMmmYyyy` is used to format date to dd-mmm-yyyy
export const formatDateToDdMmmYyyy = (date) => {
  // Create a Date object
  const newDate = new Date(date);
  // Format the date
  const formattedDate = newDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
  const format = formattedDate.replaceAll(/ /g, "-");
  return format;
};

export const deletePdfPage = async (pdfArrayBuffer, pageNumber) => {
  try {
    // Load the existing PDF
    const pdfDoc = await PDFDocument.load(pdfArrayBuffer);
    // Get the total number of pages
    const totalPages = pdfDoc.getPageCount();
    // Ensure the page index is valid
    if (totalPages > 1) {
      //Remove the specified page
      pdfDoc.removePage(pageNumber - 1);
      // Save the modified PDF
      const modifiedPdfBytes = await pdfDoc.saveAsBase64({
        useObjectStreams: false
      });
      const arrayBuffer = base64ToArrayBuffer(modifiedPdfBytes);
      return {
        arrayBuffer: arrayBuffer,
        base64: modifiedPdfBytes,
        remainingPages: totalPages - 1
      };
    } else {
      return { totalPages: 1 };
    }
  } catch (err) {
    console.log("Err while deleting page", err);
  }
};

export const reorderPdfPages = async (pdfArrayBuffer, orderArr) => {
  try {
    const pdfDoc = await PDFDocument.load(pdfArrayBuffer);
    const newPdf = await PDFDocument.create();
    const pages = await newPdf.copyPages(
      pdfDoc,
      orderArr.map((n) => n - 1)
    );
    pages.forEach((p) => newPdf.addPage(p));
    const pdfBase64 = await newPdf.saveAsBase64({ useObjectStreams: false });
    const arrayBuffer = base64ToArrayBuffer(pdfBase64);
    return { arrayBuffer, base64: pdfBase64, totalPages: orderArr.length };
  } catch (err) {
    console.log("Err while reordering pages", err);
  }
};

// `generatePdfName` is used to generate file name
export function generatePdfName(length) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const charactersLength = characters.length;

  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

// Format date and time for the selected timezone
export const formatTimeInTimezone = (date, timezone) => {
  const nyDate = timezone && toZonedTime(date, timezone);
  const generatedDate = timezone
    ? format(nyDate, "EEE, dd MMM yyyy HH:mm:ss zzz", { timeZone: timezone })
    : new Date(date).toUTCString();
  return generatedDate;
};

// `usertimezone` is used to get timezone of current user
export const usertimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
export const handleHeighlightWidget = (
  getCurrentSignerPos,
  key,
  pageNumber
) => {
  const placeholder = getCurrentSignerPos.placeHolder;
  // Find the highest zIndex value
  const highestZIndex = placeholder
    .flatMap((item) => item.pos.map((position) => position.zIndex))
    .reduce((max, zIndex) => (zIndex > max ? zIndex : max), -Infinity); //-Infinity represents the smallest possible number
  // Update the zIndex of the current signer
  const updateZindex = placeholder.map((data) => {
    if (data.pageNumber === pageNumber) {
      return {
        ...data,
        pos: data.pos.map((position) => {
          if (position.key === key) {
            return { ...position, zIndex: highestZIndex + 1 };
          }
          return position;
        })
      };
    }
    return data;
  });
  return updateZindex;
};
/**
 * FlattenPdf renders field values as static content and removes the interactive
 * form layer. Signatures are stripped entirely. Non-widget annotations (links,
 * comments, stamps) are preserved.
 * @param {string | Uint8Array | ArrayBuffer} pdfFile - pdf file.
 * @returns {Promise<Uint8Array>} flatPdf - PDF file in Uint8Array
 */
export const flattenPdf = async (pdfFile) => {
  const pdfDoc = await PDFDocument.load(pdfFile, { ignoreEncryption: true });

  let form;
  try {
    form = pdfDoc.getForm();
  } catch {
    // No form, nothing to flatten
    return await pdfDoc.save({ useObjectStreams: false });
  }

  const pages = pdfDoc.getPages();

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const zapf = await pdfDoc.embedFont(StandardFonts.ZapfDingbats);

  const fields = form.getFields();

  for (const field of fields) {
    const type = field.constructor.name;

    if (type === "PDFSignature") {
      continue;
    }

    const widgets = _safeGetWidgets(field);

    for (const widget of widgets) {
      const rect = _getWidgetRect(widget, pdfDoc);
      const page = _getWidgetPage(pdfDoc, pages, widget);

      if (!rect || !page) continue;

      _drawWidgetBox(page, rect);

      if (type === "PDFTextField") {
        _drawTextField(page, field, rect, helvetica);
      } else if (type === "PDFCheckBox") {
        _drawCheckBox(page, field, rect, zapf);
      } else if (type === "PDFRadioGroup") {
        _drawRadioGroup(page, field, widget, rect);
      } else if (type === "PDFDropdown") {
        _drawDropdown(page, field, rect, helvetica);
      } else if (type === "PDFOptionList") {
        _drawOptionList(page, field, rect, helvetica);
      } else if (type === "PDFButton") {
        // Push buttons are interactive controls, not meaningful data fields.
      }
    }
  }

  if (fields.length > 0) {
    _removeWidgetAnnotations(pdfDoc);
  }

  return await pdfDoc.save({ useObjectStreams: false });
};

/* ---- flattenPdf private helpers ---- */

function _safeGetWidgets(field) {
  try {
    return field.acroField?.getWidgets?.() || [];
  } catch {
    return [];
  }
}

function _getWidgetRect(widget, pdfDoc) {
  try {
    const r = widget.getRectangle?.();
    if (
      r &&
      isFinite(r.x) &&
      isFinite(r.y) &&
      isFinite(r.width) &&
      isFinite(r.height)
    ) {
      return r;
    }
  } catch {
    /* fall through to manual extraction */
  }

  try {
    const rectArr = widget.dict?.lookup?.(PDFName.of("Rect"));
    if (!rectArr || typeof rectArr.size !== "function" || rectArr.size() !== 4)
      return null;

    const x1 = _numberFromPdfObject(rectArr.get(0));
    const y1 = _numberFromPdfObject(rectArr.get(1));
    const x2 = _numberFromPdfObject(rectArr.get(2));
    const y2 = _numberFromPdfObject(rectArr.get(3));

    if ([x1, y1, x2, y2].some((v) => !isFinite(v))) return null;

    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1)
    };
  } catch {
    return null;
  }
}

function _numberFromPdfObject(obj) {
  if (!obj) return NaN;
  if (typeof obj.asNumber === "function") return obj.asNumber();
  if (typeof obj.numberValue === "function") return obj.numberValue();
  return Number(obj?.value ?? obj);
}

function _getWidgetPage(pdfDoc, pages, widget) {
  try {
    const pRef = widget.P?.();
    if (pRef) {
      for (const page of pages) {
        if (page.ref === pRef) return page;
      }
    }
  } catch {
    /* fall through */
  }

  try {
    const pRef = widget.dict?.get?.(PDFName.of("P"));
    if (pRef) {
      for (const page of pages) {
        if (page.ref === pRef) return page;
      }
    }
  } catch {
    /* fall through */
  }

  // Fallback: search page annots
  try {
    for (const page of pages) {
      const annots = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
      if (!annots) continue;

      for (let i = 0; i < annots.size(); i++) {
        const ref = annots.get(i);
        if (ref === widget.ref) return page;
      }
    }
  } catch {
    /* fall through */
  }

  return null;
}

function _drawWidgetBox(page, rect) {
  try {
    page.drawRectangle({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      borderWidth: 0.6,
      borderColor: rgb(0.65, 0.65, 0.65)
    });
  } catch {
    /* best effort */
  }
}

function _drawTextField(page, field, rect, font) {
  let text = "";
  try {
    text = field.getText?.() ?? "";
  } catch {
    text = "";
  }
  text = String(text ?? "");

  if (!text) return;

  let multiline = false;
  try {
    multiline = field.isMultiline?.() ?? false;
  } catch {
    /* ignore */
  }

  let comb = false;
  try {
    comb = field.isCombed?.() ?? false;
  } catch {
    /* ignore */
  }

  if (comb) {
    _drawCombText(page, text, rect, font);
    return;
  }

  if (multiline || text.includes("\n")) {
    _drawMultilineText(page, text, rect, font);
    return;
  }

  const fontSize = _fitSingleLineFontSize(text, rect, font);
  const baselineY = rect.y + Math.max(2, (rect.height - fontSize) / 2);

  page.drawText(text, {
    x: rect.x + 2,
    y: baselineY,
    size: fontSize,
    font,
    color: rgb(0, 0, 0),
    maxWidth: Math.max(1, rect.width - 4)
  });
}

function _drawMultilineText(page, text, rect, font) {
  const lines = String(text).replace(/\r/g, "").split("\n");
  const fontSize = Math.max(
    8,
    Math.min(11, rect.height / Math.max(lines.length + 0.5, 2))
  );
  const lineHeight = fontSize + 1.5;

  let y = rect.y + rect.height - fontSize - 2;

  for (const line of lines) {
    if (y < rect.y + 1) break;

    page.drawText(line, {
      x: rect.x + 2,
      y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
      maxWidth: Math.max(1, rect.width - 4),
      lineHeight
    });

    y -= lineHeight;
  }
}

function _drawCombText(page, text, rect, font) {
  const chars = String(text).split("");
  const count = Math.max(chars.length, 1);
  const cellWidth = rect.width / count;
  const fontSize = Math.max(8, Math.min(12, rect.height - 4));

  chars.forEach((ch, i) => {
    const textWidth = font.widthOfTextAtSize(ch, fontSize);
    const x = rect.x + i * cellWidth + (cellWidth - textWidth) / 2;
    const y = rect.y + Math.max(2, (rect.height - fontSize) / 2);

    page.drawText(ch, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0)
    });

    if (i < count - 1) {
      try {
        page.drawLine({
          start: { x: rect.x + (i + 1) * cellWidth, y: rect.y },
          end: {
            x: rect.x + (i + 1) * cellWidth,
            y: rect.y + rect.height
          },
          thickness: 0.4,
          color: rgb(0.75, 0.75, 0.75)
        });
      } catch {
        /* best effort */
      }
    }
  });
}

function _fitSingleLineFontSize(text, rect, font) {
  let size = Math.min(12, rect.height - 4);
  size = Math.max(size, 6);

  while (size > 6) {
    const width = font.widthOfTextAtSize(text, size);
    if (width <= rect.width - 4) return size;
    size -= 0.5;
  }

  return 6;
}

function _drawCheckBox(page, field, rect, zapf) {
  let checked = false;
  try {
    checked = field.isChecked();
  } catch {
    checked = false;
  }

  if (!checked) return;

  const size = Math.max(8, Math.min(rect.width, rect.height) - 4);

  page.drawText("\u2714", {
    x: rect.x + Math.max(1, (rect.width - size * 0.7) / 2),
    y: rect.y + Math.max(1, (rect.height - size) / 2),
    size,
    font: zapf,
    color: rgb(0, 0, 0)
  });
}

function _drawRadioGroup(page, field, widget, rect) {
  let selected = null;
  try {
    selected = field.getSelected();
  } catch {
    selected = null;
  }

  if (!selected) return;

  let widgetOnValue = null;
  try {
    widgetOnValue = widget.getOnValue?.();
  } catch {
    /* ignore */
  }

  if (!widgetOnValue) {
    try {
      const ap = widget.dict?.lookupMaybe?.(PDFName.of("AP"), PDFDict);
      const n = ap?.lookupMaybe?.(PDFName.of("N"), PDFDict);
      if (n) {
        const keys = n.keys();
        for (const k of keys) {
          const name = k?.decodeText?.() ?? k?.encodedName ?? String(k);
          if (name !== "/Off" && name !== "Off") {
            widgetOnValue = name.replace(/^\//, "");
            break;
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  const selectedStr = String(selected).replace(/^\//, "");
  const onStr = String(widgetOnValue ?? "").replace(/^\//, "");

  if (!onStr || selectedStr !== onStr) return;

  // Circle outline
  try {
    page.drawEllipse({
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
      xScale: rect.width / 2 - 1,
      yScale: rect.height / 2 - 1,
      borderWidth: 0.8,
      borderColor: rgb(0, 0, 0)
    });
  } catch {
    /* best effort */
  }

  // Inner filled dot (drawn as a filled ellipse instead of a text glyph
  // so we avoid WinAnsi encoding issues with bullet characters)
  try {
    const r = Math.min(rect.width, rect.height) / 4;
    page.drawEllipse({
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
      xScale: r,
      yScale: r,
      color: rgb(0, 0, 0)
    });
  } catch {
    /* best effort */
  }
}

function _drawDropdown(page, field, rect, font) {
  let text = "";
  try {
    const selected = field.getSelected?.();
    if (Array.isArray(selected)) {
      text = selected.join(", ");
    } else {
      text = selected ?? "";
    }
  } catch {
    text = "";
  }

  text = String(text ?? "");
  if (!text) return;

  const fontSize = _fitSingleLineFontSize(text, rect, font);

  page.drawText(text, {
    x: rect.x + 2,
    y: rect.y + Math.max(2, (rect.height - fontSize) / 2),
    size: fontSize,
    font,
    color: rgb(0, 0, 0),
    maxWidth: Math.max(1, rect.width - 12)
  });
}

function _drawOptionList(page, field, rect, font) {
  let selected = [];
  try {
    selected = field.getSelected?.() || [];
  } catch {
    selected = [];
  }

  if (!Array.isArray(selected)) {
    selected = [selected].filter(Boolean);
  }

  if (!selected.length) return;

  const lines = selected.map((v) => String(v));
  const fontSize = Math.max(
    8,
    Math.min(11, rect.height / Math.max(lines.length + 0.5, 2))
  );
  const lineHeight = fontSize + 1.5;

  let y = rect.y + rect.height - fontSize - 2;

  for (const line of lines) {
    if (y < rect.y + 1) break;

    page.drawText(line, {
      x: rect.x + 2,
      y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
      maxWidth: Math.max(1, rect.width - 4)
    });

    y -= lineHeight;
  }
}

/** Remove only Widget annotations; preserve links, stamps, comments, etc. */
function _removeWidgetAnnotations(pdfDoc) {
  for (const page of pdfDoc.getPages()) {
    try {
      const annotationsRef = page.node.get(PDFName.of("Annots"));
      if (!annotationsRef) continue;

      const annotations = pdfDoc.context.lookup(annotationsRef);
      if (!annotations || !annotations.asArray) continue;

      const filtered = annotations.asArray().filter((annotRef) => {
        try {
          const annot = pdfDoc.context.lookup(annotRef);
          const subtype = annot?.get(PDFName.of("Subtype"));
          return subtype?.toString() !== "/Widget";
        } catch {
          return true;
        }
      });

      if (filtered.length === 0) {
        page.node.delete(PDFName.of("Annots"));
      } else {
        page.node.set(PDFName.of("Annots"), pdfDoc.context.obj(filtered));
      }
    } catch {
      /* best effort */
    }
  }

  try {
    pdfDoc.catalog.delete(PDFName.of("AcroForm"));
  } catch {
    /* best effort */
  }
}

export const mailTemplate = (param) => {
  const appName = "PPMC e-Sign";
  const logo = `<div style='padding:20px 24px;border-bottom:3px solid ${brandColor};'><img src='${brandLogoUrl}' alt='${appName}' height='44' style='display:block;border:0;' /></div>`;

  const detailRow = (label, value) =>
    value
      ? `<tr><td style='padding:6px 16px 6px 0;font-weight:bold;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${brandTextColor};white-space:nowrap;'>${label}</td><td style='padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${brandMutedTextColor};'>${value}</td></tr>`
      : "";

  const subject = `${param.senderName} has requested you to sign "${param.title}"`;
  const body =
    `<html><head><meta http-equiv='Content-Type' content='text/html;charset=UTF-8' /></head><body><div style='background-color:${brandSoftBg};padding:24px 12px;font-family:Arial, Helvetica, sans-serif;'><div style='max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid ${brandBorder};'>` +
    logo +
    `<div style='background-color:${brandColor};padding:14px 24px;'><p style='margin:0;font-size:18px;font-weight:600;color:#ffffff;'>Digital Signature Request</p></div><div style='padding:28px 24px;'><p style='margin:0 0 20px 0;font-size:14px;color:${brandTextColor};line-height:1.6;'>` +
    param.senderName +
    " has requested you to review and sign <strong>" +
    param.title +
    `</strong>.</p><table style='border-collapse:collapse;margin-bottom:24px;'>` +
    detailRow("Sender", param.senderMail) +
    detailRow("Organization", param.organization) +
    detailRow("Expires on", param.localExpireDate) +
    detailRow("Note", param.note) +
    `</table><div style='text-align:center;margin:0 0 8px 0;'><a target=_blank href=` +
    param.signingUrl +
    ` style='background-color:${brandColor};color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 34px;border-radius:6px;display:inline-block;'>Sign here</a></div></div><div style='background-color:${brandSoftBg};padding:14px 24px;border-top:1px solid ${brandBorder};'><p style='margin:0 0 4px 0;font-size:11px;color:${brandMutedTextColor};'>This is an automated email from ` +
    appName +
    ". For any queries regarding this email, please contact the sender " +
    param.senderMail +
    ` directly.</p><p style='margin:0;font-size:11px;color:${brandMutedTextColor};'>Power Planning &amp; Monitoring Company &middot; Ministry of Energy &middot; Govt. of Pakistan</p></div></div></div></body></html>`;
  return { subject, body };
};

export function formatDateTime(date, dateFormat, timeZone, is12Hour) {
  const zonedDate = toZonedTime(date, timeZone); // Convert date to the given timezone
  const timeFormat = is12Hour ? "hh:mm:ss a" : "HH:mm:ss";
  return dateFormat
    ? format(
        zonedDate,
        `${selectFormat(dateFormat)}, ${timeFormat} 'GMT' XXX`,
        { timeZone }
      )
    : formatTimeInTimezone(date, timeZone);
}

export const updateDateWidgetsRes = (
  documentData,
  signerId,
  journey,
  isRemovePrefill
) => {
  const contactUser = documentData?.Signers?.find(
    (data) => data.objectId === signerId
  );
  const extUser =
    localStorage.getItem("Extand_Class") || JSON.stringify([contactUser]);
  let placeHolders = documentData?.Placeholders;
  if (isRemovePrefill) {
    placeHolders = placeHolders?.filter((x) => x.Role !== "prefill");
  }
  const userDetails = extUser ? JSON.parse(extUser)[0] : contactUser;
  return placeHolders?.map((item) => {
    if (item?.signerObjId === signerId || item?.Id === signerId) {
      // Sort page number placeholders
      const placeHolder = Array.isArray(item.placeHolder)
        ? [...item.placeHolder]
        : [];
      const sortedPlaceHolder = placeHolder
        .sort((a, b) => a.pageNumber - b.pageNumber)
        .map((ph) => {
          const sortedWidgets = [...ph.pos]
            .sort((a, b) => {
              // Sort widgets by Y position (top to bottom) and X position (left to right)
              // Treat widgets within 5px Y difference as belonging to the same row
              const Y_TOLERANCE = 5;
              const yDiff = a.yPosition - b.yPosition;

              if (Math.abs(yDiff) <= Y_TOLERANCE) {
                return a.xPosition - b.xPosition; // Same row → sort by X
              }

              return yDiff; // Different rows → sort by Y
            })
            .map((widget) => {
              // Update widget values if needed
              if (
                ["name", "email", "job title", "company"].includes(
                  widget.type
                ) &&
                !widget.options.defaultValue &&
                !widget.options.response &&
                userDetails
              ) {
                return {
                  ...widget,
                  options: {
                    ...widget.options,
                    response: widgetDataValue(widget.type, userDetails)
                  }
                };
              }
              return widget;
            });
          let widgetsWithResponses = sortedWidgets;
          return { ...ph, pos: widgetsWithResponses };
        });
      return {
        ...item,
        placeHolder: applyDuplicateResponsesToPages(sortedPlaceHolder)
      };
    }

    return item;
  });
};

//function for show checked checkbox
export const selectCheckbox = (ind, selectedCheckbox) => {
  if (selectedCheckbox && selectedCheckbox?.length > 0) {
    const isCheck = selectedCheckbox?.some((data) => data === ind);
    return isCheck || false;
  }
};
export const checkRegularExpress = (validateType, setValidatePlaceholder) => {
  switch (validateType) {
    case "email":
      setValidatePlaceholder("demo@gmail.com");
      break;
    case "number":
      setValidatePlaceholder("12345");
      break;
    case "text":
      setValidatePlaceholder("please enter text");
      break;
    case "ssn":
      setValidatePlaceholder("123-45-6789");
      break;
    default:
      setValidatePlaceholder("please enter value");
  }
};
//function to use unlink signer from widgets
export const handleUnlinkSigner = (
  signerPos,
  setSignerPos,
  signersdata,
  setSignersData,
  uniqueId
) => {
  //remove existing signer's details from 'signerPos' array
  const updatePlaceHolder = signerPos.map((x) => {
    if (x.Id === uniqueId) {
      return { ...x, signerPtr: {}, signerObjId: "" };
    }
    return { ...x };
  });
  setSignerPos(updatePlaceHolder);
  //remove existing signer's details from 'signersdata' array and keep role and id
  const updateSigner = signersdata.map((item) => {
    if (item.Id == uniqueId) {
      return { Role: item.Role, Id: item.Id, blockColor: item.blockColor };
    }
    return item;
  });
  setSignersData(updateSigner);
};
//function is used to get pdf original width and height
export const getOriginalWH = async (pdf) => {
  let pdfWHObj = [];
  //get total page number
  const totalPages = pdf?.numPages;
  //according to page number get all pdf's pages width and height
  for (let index = 0; index < totalPages; index++) {
    try {
      const getPage = await pdf.getPage(index + 1);
      const scale = 1;
      //getting extra height which is removed from viewPort height (letter type pdf have originial h-799.92 but using getPage.getViewport getting height-792 something diffrence-7.92px)
      //getPage?.view[1] store diffrence of height (Page starts 7.92 from bottom)
      const y0 = getPage?.view[1] || 0;
      let { width, height } = getPage.getViewport({ scale });
      //adding it on viewPort height then get original height ex- 792+7.92 = 799.92 orignial height
      height = height + y0;
      pdfWHObj.push({ pageNumber: index + 1, width, height });
    } catch (e) {
      console.log(`Error getting page ${index + 1} of PDF: ${e.message}`);
    }
  }
  return pdfWHObj;
};

//function is used to check required and optional widgets and ensure required widget should be response
export const handleCheckResponse = (checkUser, setminRequiredCount) => {
  let checkboxExist,
    showAlert = false,
    widgetKey,
    requiredCheckbox,
    tourPageNumber; // `pageNumber` is used to check on which page user did not fill widget's data then change current pageNumber and show tour message on that page
  for (let i = 0; i < checkUser[0].placeHolder.length; i++) {
    for (let j = 0; j < checkUser[0].placeHolder[i].pos.length; j++) {
      //get current page
      const updatePage = checkUser[0].placeHolder[i]?.pageNumber;
      //checking checbox type widget
      checkboxExist = checkUser[0].placeHolder[i].pos[j].type === "checkbox";
      //condition to check checkbox widget exist or not
      if (checkboxExist) {
        //get all required type checkbox
        requiredCheckbox = checkUser[0].placeHolder[i].pos.filter(
          (position) => {
            return (
              !position.options?.isReadOnly && position.type === "checkbox"
            );
          }
        );
        //if required type checkbox data exit then check user checked all checkbox or some checkbox remain to check
        //also validate to minimum and maximum required checkbox
        if (requiredCheckbox && requiredCheckbox.length > 0) {
          for (let i = 0; i < requiredCheckbox.length; i++) {
            //get minimum required count if  exit
            const minCount =
              requiredCheckbox[i].options?.validation?.minRequiredCount;
            const parseMin = minCount && parseInt(minCount);
            //get maximum required count if  exit
            const maxCount =
              requiredCheckbox[i].options?.validation?.maxRequiredCount;
            const parseMax = maxCount && parseInt(maxCount);
            //in `response` variable is used to get how many checkbox checked by user
            const response = requiredCheckbox[i].options?.response?.length;
            //in `defaultValue` variable is used to get how many checkbox checked by default
            const defaultValue =
              requiredCheckbox[i].options?.defaultValue?.length;
            const checkboxValue = response ? response : defaultValue;
            //condition to check  parseMin  and parseMax greater than 0  then consider it as a required check box
            if (
              parseMin > 0 &&
              parseMax > 0 &&
              !response &&
              !defaultValue &&
              !showAlert
            ) {
              showAlert = true;
              widgetKey = requiredCheckbox[i].key;
              tourPageNumber = updatePage;
              setminRequiredCount(parseMin);
            }
            //else condition to validate minimum required checkbox
            else if (
              parseMin > 0 &&
              (parseMin > checkboxValue || !checkboxValue)
            ) {
              if (!showAlert) {
                showAlert = true;
                widgetKey = requiredCheckbox[i].key;
                tourPageNumber = updatePage;
                setminRequiredCount(parseMin);
              }
            }
          }
        }
      }
      //else condition to check all type widget data fill or not except checkbox
      else {
        //get all required type widgets except checkbox and radio
        const requiredWidgets = checkUser[0].placeHolder[i].pos.filter(
          (position) => {
            return (
              position.type === "signature" ||
              (position.options?.status === "required" &&
                position.type !== "checkbox")
            );
          }
        );
        if (requiredWidgets && requiredWidgets?.length > 0) {
          let checkSigned;
          for (let i = 0; i < requiredWidgets?.length; i++) {
            checkSigned = requiredWidgets[i]?.options?.response;
            if (isEmptyValue(checkSigned)) {
              let checkDefaultSigned =
                requiredWidgets[i]?.options?.defaultValue;
              if (isEmptyValue(checkDefaultSigned) && !showAlert) {
                showAlert = true;
                widgetKey = requiredWidgets[i].key;
                tourPageNumber = updatePage;
                setminRequiredCount(null);
              }
            }
          }
        }
      }
    }
    //when showAlert is true then break the loop and show alert to fill required data in widgets
    if (showAlert) {
      break;
    }
  }
  return { tourPageNumber, widgetKey, showAlert };
};

/**
 * decryptPdf
 * @param {File} file - The password-protected PDF file to decrypt.
 * @param {string | undefined} password - The password used to unlock the PDF.
 * @returns {Promise<File>} - A Promise that resolves to a decrypted PDF as a File object.
 *
 */
export const decryptPdf = async (file, password) => {
  const name = generatePdfName(16);
  const baseApi = localStorage.getItem("baseUrl") || "";
  const url = removeTrailingSegment(baseApi) + "/decryptpdf?ts=" + Date.now();
  let formData = new FormData();
  formData.append("file", file);
  formData.append("password", password);
  const config = {
    headers: { "content-type": "multipart/form-data" },
    responseType: "blob"
  };
  const response = await axios.post(url, formData, config);
  const pdfBlob = new Blob([response.data], { type: "application/pdf" });
  return new File([pdfBlob], name, { type: "application/pdf" });
};

/**
 * Convert a Base64 string to a File object.
 *
 * @param {string} base64String - The Base64 string, with or without the data URI prefix.
 *                                e.g. "data:image/png;base64,iVBORw0KGgoAAAANS…" or "iVBORw0KGgoAAAANS…"
 * @param {string} filename     - Desired filename for the File object, e.g. "photo.png"
 * @returns {File}              - The resulting File object
 */
export function base64ToFile(base64String, filename) {
  // Separate out the mime-type and the actual Base64 payload
  const [header, payload] = base64String.includes(",")
    ? base64String.split(",")
    : [null, base64String];
  // Determine the MIME type (fallback to application/octet-stream)
  const mimeMatch = header?.match(/data:(.*?);base64/);
  const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";

  // Decode Base64 to raw binary data held in a string
  const binaryString = atob(payload);
  // Create an ArrayBuffer and a view (as unsigned 8-bit)
  const len = binaryString.length;
  const u8arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    u8arr[i] = binaryString.charCodeAt(i);
  }

  // Create a File object (Blob subclass) with the binary data
  return new File([u8arr], filename, { type: mime });
}

/**
 * Reads the given File object and returns its contents as an ArrayBuffer.
 *
 * @param {File} file
 *   The File instance to be read.
 * @returns {Promise<ArrayBuffer>}
 *   A promise that resolves with the file’s binary data as an ArrayBuffer,
 *   or rejects with an error if the read fails.
 */
export function getFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e.target.error);
    reader.readAsArrayBuffer(file);
  });
}

export const sendEmailToSigners = async (
  pdfDetails,
  signersdata,
  customizeMail,
  defaultMail,
  isCustomize
) => {
  let htmlReqBody;
  const owner = pdfDetails?.[0]?.ExtUserPtr;
  let sendMail;
  const getDocumentExpDate = pdfDetails?.[0]?.ExpiryDate?.iso;
  const getTemplateExpDate = new Date(pdfDetails[0]?.createdAt);
  getTemplateExpDate.setDate(
    getTemplateExpDate.getDate() + (pdfDetails[0]?.TimeToCompleteDays || 15)
  );
  const expireDate = getDocumentExpDate
    ? getDocumentExpDate
    : getTemplateExpDate;
  const newDate = new Date(expireDate);
  const localExpireDate = newDate.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  let senderEmail =
    pdfDetails?.[0]?.SenderMail || pdfDetails?.[0]?.ExtUserPtr?.Email;
  let senderPhone = pdfDetails?.[0]?.ExtUserPtr?.Phone;
  let signerMail = signersdata.slice();
  if (pdfDetails?.[0]?.SendinOrder && pdfDetails?.[0]?.SendinOrder === true) {
    signerMail = signerMail[0] ? [signerMail[0]] : [];
  }
  for (let i = 0; i < signerMail.length; i++) {
    try {
      let url = `${localStorage.getItem("baseUrl")}functions/sendmailv3`;
      const headers = {
        "Content-Type": "application/json",
        "X-Parse-Application-Id": localStorage.getItem("parseAppId"),
        sessionToken: localStorage.getItem("accesstoken")
      };
      const objectId = signerMail[i].objectId;
      const hostUrl = window.location.origin + appBasename;
      //encode this url value `${pdfDetails?.[0].objectId}/${signerMail[i].Email}/${objectId}` to base64 using `btoa` function
      const encodeBase64 = btoa(
        `${pdfDetails[0]?.objectId}/${signerMail[i].Email}/${objectId}`
      );
      let signPdf = `${hostUrl}/login/${encodeBase64}`;
      const orgName = pdfDetails[0]?.ExtUserPtr.Company
        ? pdfDetails[0].ExtUserPtr.Company
        : "";

      const useNameAsSender =
        pdfDetails?.[0]?.ExtUserPtr?.UseNameAsSender === true;

      const senderName =
        pdfDetails?.[0]?.SenderName || pdfDetails?.[0]?.ExtUserPtr?.Name;

      const from =
        pdfDetails?.[0]?.SenderName || useNameAsSender
          ? pdfDetails?.[0]?.ExtUserPtr?.Name || ""
          : senderEmail;

      const documentName = `${pdfDetails?.[0].Name}`;
      let replaceVar;

      if (customizeMail && isCustomize) {
        const replacedRequestBody = customizeMail?.body.replace(/"/g, "'");
        htmlReqBody =
          "<html><head><meta http-equiv='Content-Type' content='text/html; charset=UTF-8' /></head><body>" +
          replacedRequestBody +
          "</body> </html>";

        const variables = {
          document_title: documentName,
          note: pdfDetails?.[0]?.Note,
          sender_name: senderName,
          sender_mail: senderEmail,
          sender_phone: senderPhone || "",
          receiver_name: signerMail[i]?.Name || "",
          receiver_email: signerMail[i].Email,
          receiver_phone: signerMail[i]?.Phone || "",
          expiry_date: localExpireDate,
          company_name: orgName,
          signing_url: signPdf
        };
        replaceVar = replaceMailVaribles(
          customizeMail.subject,
          htmlReqBody,
          variables
        );
      } else if (defaultMail?.body && defaultMail?.subject) {
        const mailBody = defaultMail?.body;
        const mailSubject = defaultMail.subject;
        const replacedRequestBody = mailBody.replace(/"/g, "'");
        const htmlReqBody =
          "<html><head><meta http-equiv='Content-Type' content='text/html; charset=UTF-8' /></head><body>" +
          replacedRequestBody +
          "</body> </html>";
        const variables = {
          document_title: documentName,
          note: pdfDetails?.[0]?.Note,
          sender_name: senderName,
          sender_mail: senderEmail,
          sender_phone: senderPhone || "",
          receiver_name: signerMail[i]?.Name || "",
          receiver_email: signerMail[i].Email,
          receiver_phone: signerMail[i]?.Phone || "",
          expiry_date: localExpireDate,
          company_name: orgName,
          signing_url: signPdf
        };
        replaceVar = replaceMailVaribles(mailSubject, htmlReqBody, variables);
      }
      const mailparam = {
        senderName: senderName,
        note: pdfDetails?.[0]?.Note || "",
        senderMail: senderEmail,
        title: documentName,
        organization: orgName,
        localExpireDate: localExpireDate,
        signingUrl: signPdf
      };
      // Pick a role-appropriate default template (viewers get a "view"
      // template instead of the "sign" template).
      const defaultTemplate = mailTemplate(mailparam);
      let params = {
        extUserId: owner?.objectId,
        recipient: signerMail[i].Email,
        subject: replaceVar?.subject
          ? replaceVar?.subject
          : defaultTemplate.subject,
        replyto: senderEmail,
        from: from,
        html: replaceVar?.body ? replaceVar?.body : defaultTemplate.body
      };

      sendMail = await axios.post(url, params, { headers: headers });
    } catch (error) {
      console.log("error", error);
    }
  }
  if (sendMail?.data?.result?.status === "success") {
    const sessiontoken = localStorage.getItem("accesstoken");
    if (pdfDetails[0]?.objectId && sessiontoken) {
      try {
        let data;
        if (customizeMail && isCustomize) {
          data = {
            RequestBody: customizeMail?.body,
            RequestSubject: customizeMail.subject,
            SendMail: true
          };
        } else if (defaultMail?.body && defaultMail?.subject) {
          data = {
            RequestBody: defaultMail?.body,
            RequestSubject: defaultMail?.subject,
            SendMail: true
          };
        } else {
          data = { SendMail: true };
        }
        const docUrl = `${localStorage.getItem("baseUrl")}classes/contracts_Document`;
        await axios.put(`${docUrl}/${pdfDetails[0]?.objectId}`, data, {
          headers: {
            "Content-Type": "application/json",
            "X-Parse-Application-Id": localStorage.getItem("parseAppId"),
            "X-Parse-Session-Token": sessiontoken
          }
        });
      } catch (error) {
        const err = error?.response?.data?.error || error?.message;
        console.error("Error while updating doc: ", err);
      }
    }
    return { status: "success" };
  } else {
    return { status: sendMail?.data?.result?.status };
  }
};
/**
 * Converts a JPEG/JPG File/Blob into a PNG File.
 *
 * @param {string} base64Image  - A data-URL (e.g. "data:image/jpeg;base64,…")
 * @param {string} filename     - Desired filename (e.g. "input").
 * @returns {Promise<File>}     - A promise that resolves with a new PNG File.
 */
export function convertJpegToPng(base64Image, filename) {
  if (base64Image) {
    const arr = base64Image.split(",");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) throw new Error("Invalid dataURL");
    const mime = mimeMatch[1];
    const type = mime.split("/")[1];
    if (type === "png") {
      return base64Image;
    } else {
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) u8arr[n] = bstr.charCodeAt(n);
      const inputFile = new File([u8arr], `${filename}.${type}`, {
        type: mime
      });
      return new Promise((resolve, reject) => {
        // ensure it’s JPEG/JPG (you can remove this check if not needed)
        if (!/image\/jpe?g/.test(inputFile.type)) {
          return reject(new Error("Input must be a JPEG or JPG image"));
        }

        // Read the file as a data URL
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Failed to read the file"));
        reader.onload = () => {
          const img = new Image();
          img.onerror = () => reject(new Error("Failed to load image"));
          img.onload = () => {
            // draw image onto a canvas
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);

            // directly get PNG as base64 data URL
            try {
              const pngDataUrl = canvas.toDataURL("image/png");
              resolve(pngDataUrl);
            } catch (err) {
              reject(new Error("Failed to convert canvas to PNG"));
            }
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(inputFile);
      });
    }
  }
}
//function is used to get assigned signer's email
export const getSignerEmail = (data, signers) => {
  const getEmail =
    signers?.length > 0 &&
    signers.find((x) => x.objectId === data.signerObjId)?.Email;
  return getEmail;
};

//function is used to delete widgets
export const handleDeleteWidget = (key, Id, pageNumber, signerPos) => {
  // Find the signer by ID
  const signer = signerPos.find((item) => item.Id === Id);
  if (!signer || !signer.placeHolder) return signerPos;

  const placeHolder = signer.placeHolder;

  // Find the page inside placeHolder
  const currentPage = placeHolder.find((p) => p.pageNumber === pageNumber);
  if (!currentPage) return signerPos;

  // Remove widget from the selected page
  const updatedPos = currentPage.pos.filter((w) => w.key !== key);

  // -------------------------------------------------------
  // CASE A → After deletion, page still has widgets then keep that widgets
  // -------------------------------------------------------
  if (updatedPos.length > 0) {
    const updatedPlaceHolder = placeHolder.map((p) =>
      p.pageNumber === pageNumber ? { ...p, pos: updatedPos } : p
    );

    return signerPos.map((s) =>
      s.Id === Id ? { ...s, placeHolder: updatedPlaceHolder } : s
    );
  }

  // -------------------------------------------------------
  // CASE B → current page becomes empty → remove current page entirely and keep another pages which have widgets
  // -------------------------------------------------------
  const remainPages = placeHolder.filter((p) => p.pageNumber !== pageNumber);

  //`remainPages` keep another pages's data which have widgets
  if (remainPages.length > 0) {
    const index = signerPos.findIndex((s) => s.Id === Id);
    if (index === -1) return signerPos;

    const newSignerPos = [...signerPos];
    newSignerPos[index] = {
      ...newSignerPos[index],
      placeHolder: remainPages
    };

    return newSignerPos;
  }

  // -------------------------------------------------------
  // CASE C → No pages have widgets after delete widgets
  //          Remove placeHolder field for particular signers, EXCEPT prefill role
  // -------------------------------------------------------
  const updatedData = signerPos
    .map((s) => {
      if (s.Id === Id && s.Role === "prefill") return null; // remove whole signer
      if (s.Id === Id) {
        const updated = { ...s };
        delete updated.placeHolder;
        return updated;
      }
      return s;
    })
    .filter(Boolean); // remove nulls (deleted items)

  return updatedData;
};
//function to convert formatted date to new Date() format
export const getDefaultDate = (dateStr, format) => {
  //get valid date format for moment to convert formatted date to new Date() format
  const formats = changeDateToMomentFormat(format);
  const parsedDate = moment(dateStr, formats);
  let date;
  if (parsedDate.isValid()) {
    date = new Date(parsedDate.toISOString());
    return date;
  } else if (dateStr === "today") {
    date = new Date();
    return date;
  }
};
//function to get default format
export const getDefaultFormat = (dateFormat) => dateFormat || "MM/dd/yyyy";

//function to handle widget background color
export const handleBackground = (data, isNeedSign, uniqueId) => {
  if (data) {
    if (isNeedSign) {
      if (data?.Id === uniqueId) {
        return data?.blockColor + "b0";
      } else {
        return "#dedddc";
      }
    } else {
      return data?.blockColor + "b0";
    }
  } else {
    return "rgba(203, 233, 237, 0.69)";
  }
};

export function getBase64MimeType(base64) {
  const match = base64.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
  return match ? match[1] : null;
}
