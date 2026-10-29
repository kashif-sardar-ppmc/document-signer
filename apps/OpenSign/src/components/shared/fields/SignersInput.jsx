import React, { useState, useEffect } from "react";
import AsyncSelect from "react-select/async";
import AddContact from "../../../primitives/AddContact";
import Tooltip from "../../../primitives/Tooltip";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { findContact, getTenantDetails } from "../../../constant/Utils";
import Loader from "../../../primitives/Loader";

const emailGlobalRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// `parseBulkEmails` splits pasted text (new line, comma or semicolon separated,
// optionally in `Name <email>` format) into unique valid entries and a list of
// invalid entries
const parseBulkEmails = (text) => {
  const valid = [];
  const invalid = [];
  const seen = new Set();
  (text || "")
    .split(/[\n\r,;]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const matches = entry.match(emailGlobalRegex);
      if (!matches) {
        invalid.push(entry);
        return;
      }
      const label = entry.split("<")[0].replace(/["']/g, "").trim();
      matches.forEach((match) => {
        const email = match.toLowerCase();
        if (seen.has(email)) return;
        seen.add(email);
        const name = matches.length === 1 && label && !label.includes("@");
        valid.push({ email, name: name ? label : email.split("@")[0] });
      });
    });
  return { valid, invalid };
};

function arrayMove(array, from, to) {
  array = array.slice();
  array.splice(to < 0 ? array.length + to : to, 0, array.splice(from, 1)[0]);
  return array;
}

const AddSignerModal = ({ isOpen, children }) => {
  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="op-modal op-modal-open">
      <div className="op-modal-box p-0 min-w-[90%] md:min-w-[500px] max-h-90 overflow-y-auto hide-scrollbar text-sm">
        {children}
      </div>
    </div>,
    document.body
  );
};

/**
 * react-sortable-hoc is depcreated not usable from react 18.x.x
 *  need to replace it with @dnd-kit
 * code changes required
 */

const SignersInput = (props) => {
  const { t } = useTranslation();
  const [state, setState] = useState(undefined);
  const [selected, setSelected] = useState([]);
  const [isModal, setIsModel] = useState(false);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [isBulkModal, setIsBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  useEffect(() => {
    // to provide initial data for selected list items in Bcc for edit template
    if (props?.initialData && props?.initialData?.length > 0) {
      const trimEmail = props?.initialData.map((item) => ({
        value: item?.objectId,
        label: item?.Name,
        email: item?.Email
      }));
      setSelected(trimEmail);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onChange = (selectedOptions) => {
    if (selectedOptions && selectedOptions?.length > 0) {
      const trimEmail = selectedOptions.map((item) => ({
        ...item,
        label: item?.label?.split("<")?.shift()
      }));
      setSelected(trimEmail);
    } else {
      setSelected(selectedOptions);
    }
  };

  const onSortEnd = ({ oldIndex, newIndex }) => {
    const newValue = arrayMove(selected, oldIndex, newIndex);
    setSelected(newValue);
  };

  useEffect(() => {
    if (props.isReset && props.isReset === true) {
      setSelected([]);
    }
  }, [props.isReset]);

  useEffect(() => {
    if (selected && selected.length) {
      let newData = [];
      selected.forEach((x) => {
        if (props?.isCaptureAllData) {
          newData.push(x);
        } else {
          newData.push(x.value);
        }
      });
      if (props.onChange) {
        props.onChange(newData);
      }
    }

    // eslint-disable-next-line
  }, [selected]);

  const handleModalCloseClick = () => {
    setIsModel(false);
    setModalIsOpen(false);
  };

  const openModal = () => {
    setModalIsOpen(true);
  };

  // `handleNewDetails` is used to set just save from quick form to selected option in dropdown
  const handleNewDetails = (data) => {
    const user = {
      value: data["objectId"],
      label: data["Name"],
      email: data?.Email
    };
    setState([...state, user]);
    if (selected.length > 0) {
      setSelected([...selected, user]);
    } else {
      setSelected([user]);
    }
  };
  const handleBulkClose = () => {
    if (isBulkLoading) return;
    setIsBulkModal(false);
    setBulkText("");
    setBulkResult(null);
  };

  // `getContactByEmail` returns the saved contact of current user for an email, if any
  const getContactByEmail = async (email) => {
    const res = await findContact(email);
    return res?.find((x) => x?.Email?.toLowerCase() === email);
  };

  // `saveBulkContact` creates a contact with same `savecontact` function used by single add form
  const saveBulkContact = async ({ email, name }, tenantId) => {
    const baseURL = localStorage.getItem("baseUrl");
    const headers = {
      "Content-Type": "application/json",
      "X-Parse-Application-Id": localStorage.getItem("parseAppId"),
      "X-Parse-Session-Token": localStorage.getItem("accesstoken")
    };
    const data = { name, email, tenantId };
    const axiosRes = await axios.post(
      `${baseURL}functions/savecontact`,
      data,
      { headers }
    );
    return axiosRes?.data?.result;
  };

  // `handleBulkAdd` adds all pasted emails to signers in the same order as they are pasted
  const handleBulkAdd = async (e) => {
    e.preventDefault();
    const { valid, invalid } = parseBulkEmails(bulkText);
    if (valid.length === 0) {
      setBulkResult({ added: 0, invalid, failed: [] });
      return;
    }
    setIsBulkLoading(true);
    const failed = [];
    const users = [];
    try {
      const user = JSON.parse(
        localStorage.getItem(
          `Parse/${localStorage.getItem("parseAppId")}/currentUser`
        )
      );
      const tenantDetails = await getTenantDetails(user?.objectId || "");
      const tenantId = tenantDetails?.objectId || "";
      for (const item of valid) {
        try {
          let contact = await getContactByEmail(item.email);
          if (!contact) {
            try {
              contact = await saveBulkContact(item, tenantId);
            } catch (err) {
              // contact may have been created in the meantime
              if (err?.response?.data?.error?.includes("already exists")) {
                contact = await getContactByEmail(item.email);
              } else {
                throw err;
              }
            }
          }
          if (contact?.objectId) {
            users.push({
              value: contact.objectId,
              label: contact.Name,
              email: contact.Email
            });
          } else {
            failed.push(item.email);
          }
        } catch (err) {
          console.log("err while adding bulk signer", err);
          failed.push(item.email);
        }
      }
    } catch (err) {
      console.log("err while adding bulk signers", err);
      failed.push(...valid.map((x) => x.email));
    }
    setSelected((prev) => {
      const current = prev || [];
      const fresh = users.filter(
        (x) => !current.some((y) => y.value === x.value)
      );
      return [...current, ...fresh];
    });
    setIsBulkLoading(false);
    if (invalid.length === 0 && failed.length === 0) {
      handleBulkClose();
    } else {
      // keep only unresolved entries in textarea so that user can correct them
      setBulkText([...invalid, ...failed].join("\n"));
      setBulkResult({ added: users.length, invalid, failed });
    }
  };
  const loadOptions = async (inputValue) => {
    try {
      const contactRes = await findContact(
        inputValue,
      );
      if (contactRes) {
        const res = JSON.parse(JSON.stringify(contactRes));
        //compareArrays is a function where compare between two array (total signersList and document signers list)
        //and filter signers from total signer's list which already present in document's signers list
        const compareArrays = (res, signerObj) => {
          return res.filter(
            (item1) =>
              !signerObj.find((item2) => item2.objectId === item1.objectId)
          );
        };

        //get update signer's List if signersdata is present
        const updateSignersList =
          props?.signersData && compareArrays(res, props?.signersData);

        const result = updateSignersList ? updateSignersList : res;
        setState(result);
        return await result.map((item) => ({
          label: item.Name + "<" + item.Email + ">",
          value: item.objectId,
          email: item.Email,
          isChecked: true
        }));
      }
    } catch (error) {
      console.log("err", error);
    }
  };
  return (
    <div className="text-xs mt-2 ">
      <label className="block relative">
        {props.label ? props.label : t("signers")}
        {props.required && <span className="text-red-500 text-[13px]">*</span>}
        <span
          className={`z-[${props?.zindex ? props.zindex : 30}] absolute ml-1 text-xs`}
        >
          <Tooltip
            id={`${props.label ? props.label : "signers"}-tooltip`}
            message={props.helpText ? props.helpText : t("signers-help")}
          />
        </span>
      </label>
      <div className="flex gap-x-[5px]">
        <div
          className={`w-full z-[${props?.zindex ? props.zindex : 40}]`}
        >
          <AsyncSelect
            onSortEnd={onSortEnd}
            distance={4}
            isMulti
            cacheOptions
            defaultOptions
            options={state || []}
            value={selected}
            onChange={onChange}
            closeMenuOnSelect={false}
            required={props.required}
            loadingMessage={() => t("loading")}
            noOptionsMessage={() => t("contact-not-found")}
            loadOptions={loadOptions}
            unstyled
            classNames={{
              control: () =>
                "op-input op-input-bordered op-input-sm focus:outline-none hover:border-base-content w-full h-full text-[11px]",
              valueContainer: () =>
                "flex flex-row gap-x-[2px] gap-y-[2px] md:gap-y-0 w-full my-[2px]",
              multiValue: () => "op-badge op-badge-primary h-full text-[11px]",
              multiValueLabel: () => "mb-[2px]",
              menu: () =>
                "mt-1 shadow-md rounded-lg bg-base-200 text-base-content",
              menuList: () => "shadow-md rounded-lg overflow-hidden",
              option: () =>
                "bg-base-200 text-base-content rounded-lg m-1 hover:bg-base-300 p-2",
              noOptionsMessage: () => "p-2 bg-base-200 rounded-lg m-1 p-2"
            }}
          />
        </div>
        <div
          onClick={() => {
            setIsModel(true);
            openModal();
          }}
          className="cursor-pointer op-input op-input-bordered focus:outline-none hover:border-base-content max-h-[38px] min-w-[48px] flex justify-center items-center"
        >
          <i className="fa-light fa-plus"></i>
        </div>
        <div
          onClick={() => setIsBulkModal(true)}
          title={t("bulk-add-emails")}
          className="cursor-pointer op-input op-input-bordered focus:outline-none hover:border-base-content max-h-[38px] min-w-[48px] flex justify-center items-center"
        >
          <i className="fa-light fa-users"></i>
        </div>
        <AddSignerModal isOpen={isBulkModal}>
          <h3 className="text-base-content font-bold text-lg pt-[15px] px-[20px]">
            {t("bulk-add-emails")}
          </h3>
          <button
            onClick={handleBulkClose}
            className="op-btn op-btn-sm op-btn-circle op-btn-ghost text-base-content absolute right-2 top-2"
          >
            ✕
          </button>
          {isBulkLoading && (
            <div className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-30">
              <Loader />
            </div>
          )}
          <form className="px-[20px] py-[10px]" onSubmit={handleBulkAdd}>
            <p className="text-xs text-base-content/70 mb-2">
              {t("bulk-add-emails-help")}
            </p>
            <textarea
              value={bulkText}
              onChange={(e) => {
                setBulkText(e.target.value);
                setBulkResult(null);
              }}
              rows={8}
              required
              className="op-textarea op-textarea-bordered w-full text-xs focus:outline-none hover:border-base-content"
              placeholder={"a@example.com\nb@example.com, c@example.com\nJane Doe <jane@example.com>"}
            />
            {bulkResult && (
              <div className="text-xs mt-2">
                {bulkResult.added > 0 && (
                  <p className="text-green-600">
                    {t("bulk-signers-added", { count: bulkResult.added })}
                  </p>
                )}
                {bulkResult.invalid.length > 0 && (
                  <p className="text-red-600">
                    {t("bulk-invalid-emails")}: {bulkResult.invalid.join(", ")}
                  </p>
                )}
                {bulkResult.failed.length > 0 && (
                  <p className="text-red-600">
                    {t("bulk-failed-emails")}: {bulkResult.failed.join(", ")}
                  </p>
                )}
              </div>
            )}
            <div className="mt-4 mb-2 flex justify-start gap-2">
              <button type="submit" className="op-btn op-btn-primary">
                {t("add-signers")}
              </button>
              <button
                type="button"
                onClick={handleBulkClose}
                className="op-btn op-btn-secondary"
              >
                {t("cancel")}
              </button>
            </div>
          </form>
        </AddSignerModal>
        <AddSignerModal isOpen={modalIsOpen}>
          <h3 className="text-base-content font-bold text-lg pt-[15px] px-[20px]">
            {t("add-contact")}
          </h3>
          <button
            onClick={handleModalCloseClick}
            className="op-btn op-btn-sm op-btn-circle op-btn-ghost text-base-content absolute right-2 top-2"
          >
            ✕
          </button>
          {isModal && (
            <AddContact
              isDisableTitle
              isAddYourSelfCheckbox={props?.isAddYourSelfCheckbox}
              details={handleNewDetails}
              closePopup={handleModalCloseClick}
            />
          )}
        </AddSignerModal>
      </div>
    </div>
  );
};

export default SignersInput;
