import { useEffect, useState } from "react";
import Parse from "parse";
import { useDispatch } from "react-redux";
import axios from "axios";
import { NavLink, useNavigate, useLocation } from "react-router";
import ModalUi from "../primitives/ModalUi";
import "../styles/login.css";
import {
  emailRegex,
} from "../constant/const";
import Alert from "../primitives/Alert";
import { appInfo } from "../constant/appinfo";
import { fetchAppInfo } from "../redux/reducers/infoReducer";
import { showTenant } from "../redux/reducers/ShowTenant";
import {
  getAppLogo,
  saveLanguageInLocal,
  usertimezone
} from "../constant/Utils";
import Loader from "../primitives/Loader";
import { useTranslation } from "react-i18next";
import SelectLanguage from "../components/pdf/SelectLanguage";

function Login() {
  const appName =
    "OpenSign™";
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const [state, setState] = useState({
    email: "",
    password: "",
    alertType: "success",
    alertMsg: "",
    passwordVisible: false,
    loading: false,
    thirdpartyLoader: false,
  });
  const [userDetails, setUserDetails] = useState({
    Company: "",
    Destination: ""
  });
  const [captcha, setCaptcha] = useState({ question: "", token: "" });
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [isModal, setIsModal] = useState(false);
  const [image, setImage] = useState();
  const [errMsg, setErrMsg] = useState();
  useEffect(() => {
    handleUserExist();
    loadCaptcha();
    // eslint-disable-next-line
  }, []);

  const loadCaptcha = async () => {
    setCaptchaAnswer("");
    try {
      const res = await Parse.Cloud.run("getcaptcha");
      setCaptcha({ question: res?.question || "", token: res?.token || "" });
    } catch (error) {
      console.error("Error loading captcha", error);
    }
  };

  const handleUserExist = async () => {
    checkUserExt();
  };


  const setLocalVar = (user) => {
    localStorage.setItem("accesstoken", user.sessionToken);
    localStorage.setItem("UserInformation", JSON.stringify(user));
    localStorage.setItem("userEmail", user.email);
    if (user.ProfilePic) {
      localStorage.setItem("profileImg", user.ProfilePic);
    } else {
      localStorage.setItem("profileImg", "");
    }
  };

  const showToast = (type, msg) => {
    setState({ ...state, loading: false, alertType: type, alertMsg: msg });
    setTimeout(() => setState({ ...state, alertMsg: "" }), 2000);
  };

  const checkUserExt = async () => {
    const app = await getAppLogo();
    if (app?.error === "invalid_json") {
      setErrMsg(t("server-down", { appName: appName }));
    } else if (
      app?.user === "not_exist"
    ) {
      navigate("/addadmin");
    }
    if (app?.logo) {
      setImage(app?.logo);
    } else {
      setImage(appInfo?.applogo || undefined);
    }
    dispatch(fetchAppInfo());
    if (localStorage.getItem("accesstoken")) {
      setState({ ...state, loading: true });
      GetLoginData();
    }
  };
  const handleChange = (event) => {
    let { name, value } = event.target;
    if (name === "email") {
      value = value?.toLowerCase()?.replace(/\s/g, "");
    }
    setState({ ...state, [name]: value });
  };

  const handleLogin = async (
  ) => {
    const email = state?.email
    const password = state?.password

    if (!email || !password) {
      return;
    }
    localStorage.removeItem("accesstoken");
    try {
      setState({ ...state, loading: true });
      localStorage.setItem("appLogo", appInfo.applogo);
      const _user = await Parse.Cloud.run("loginuser", {
        email,
        password,
        captchaToken: captcha.token,
        captchaAnswer: captchaAnswer.trim()
      });
      if (!_user) {
        setState({ ...state, loading: false });
        return;
      }
      // Get extended user data (including 2FA status) using cloud function
      try {
        await Parse.User.become(_user.sessionToken);
        setLocalVar(_user);
        await continueLoginFlow();
      } catch (error) {
        console.error("Error checking 2FA status:", error);
        showToast("danger", t("something-went-wrong-mssg"));
      }
    } catch (error) {
      console.error("Error while logging in user", error);
      loadCaptcha();
      if (error?.message === "invalid_captcha") {
        showToast("danger", "Incorrect captcha answer. Please try again.");
      } else if (error?.code === 1001) {
        showToast("danger", t("action-prohibited"));
      } else {
        showToast("danger", t("invalid-username-password-region"));
      }
    }
  };
  const handleLoginBtn = async (event) => {
    event.preventDefault();
    if (!emailRegex.test(state.email)) {
      alert(t("valid-email-alert"));
      return;
    }
    await handleLogin();
  };

  const setThirdpartyLoader = (value) => {
    setState({ ...state, thirdpartyLoader: value });
  };

  const thirdpartyLoginfn = async (sessionToken) => {
    const baseUrl = localStorage.getItem("baseUrl");
    const parseAppId = localStorage.getItem("parseAppId");
    const res = await axios.get(baseUrl + "users/me", {
      headers: {
        "X-Parse-Session-Token": sessionToken,
        "X-Parse-Application-Id": parseAppId
      }
    });
    await Parse.User.become(sessionToken).then(() => {
      window.localStorage.setItem("accesstoken", sessionToken);
    });
    if (res.data) {
      let _user = res.data;
      setLocalVar(_user);
      // Check extended class user role and tenentId
      try {
        const userSettings = appInfo.settings;
        const extUser = await Parse.Cloud.run("getUserDetails");
        if (extUser) {
          const IsDisabled = extUser?.get("IsDisabled") || false;
          if (!IsDisabled) {
            const userRole = extUser?.get("UserRole");
            const menu =
              userRole && userSettings.find((menu) => menu.role === userRole);
            if (menu) {
              const _currentRole = userRole;
              const redirectUrl =
                location?.state?.from || `/${menu.pageType}/${menu.pageId}`;
              const _role = _currentRole.replace("contracts_", "");
              const extInfo = JSON.parse(JSON.stringify(extUser));
              localStorage.setItem("_user_role", _role);
              localStorage.setItem("Extand_Class", JSON.stringify([extUser]));
              localStorage.setItem("userEmail", extInfo?.Email);
              localStorage.setItem("username", extInfo?.Name);
              if (extInfo?.TenantId) {
                const tenant = {
                  Id: extInfo?.TenantId?.objectId || "",
                  Name: extInfo?.TenantId?.TenantName || ""
                };
                localStorage.setItem("TenantId", tenant?.Id);
                dispatch(showTenant(tenant?.Name));
                localStorage.setItem("TenantName", tenant?.Name);
              }
              localStorage.setItem("PageLanding", menu.pageId);
              localStorage.setItem("defaultmenuid", menu.menuId);
              localStorage.setItem("pageType", menu.pageType);
                navigate(redirectUrl);
            } else {
              showToast("danger", t("role-not-found"));
              logOutUser();
            }
          } else {
            showToast("danger", t("do-not-access-contact-admin"));
            logOutUser();
          }
        } else {
          showToast("danger", t("user-not-found"));
          logOutUser();
        }
      } catch (error) {
        console.error("err in fetching extUser", err);
        showToast("danger", `${err.message}`);
        const payload = { sessionToken: _user.sessionToken };
        handleSubmitbtn(payload);
      } finally {
        setThirdpartyLoader(false);
      }
    }
  };

  const GetLoginData = async () => {
    setState({ ...state, loading: true });
    try {
      const user = await Parse.User.become(localStorage.getItem("accesstoken"));
      const _user = user.toJSON();
      setLocalVar(_user);
      const userSettings = appInfo.settings;
      const extUser = await Parse.Cloud.run("getUserDetails");
      if (extUser) {
        const IsDisabled = extUser?.get("IsDisabled") || false;
        if (!IsDisabled) {
          const userRole = extUser.get("UserRole");
          const _currentRole = userRole;
          const menu =
            userRole && userSettings.find((menu) => menu.role === userRole);
          if (menu) {
            const extInfo = JSON.parse(JSON.stringify(extUser));
            const _role = _currentRole.replace("contracts_", "");
            localStorage.setItem("_user_role", _role);
            const redirectUrl =
              location?.state?.from || `/${menu.pageType}/${menu.pageId}`;
            localStorage.setItem("Extand_Class", JSON.stringify([extUser]));
            localStorage.setItem("userEmail", extInfo.Email);
            localStorage.setItem("username", extInfo.Name);
            if (extInfo?.TenantId) {
              const tenant = {
                Id: extInfo?.TenantId?.objectId || "",
                Name: extInfo?.TenantId?.TenantName || ""
              };
              localStorage.setItem("TenantId", tenant?.Id);
              dispatch(showTenant(tenant?.Name));
              localStorage.setItem("TenantName", tenant?.Name);
            }
            localStorage.setItem("PageLanding", menu.pageId);
            localStorage.setItem("defaultmenuid", menu.menuId);
            localStorage.setItem("pageType", menu.pageType);
              navigate(redirectUrl);
          } else {
            setState({ ...state, loading: false });
            logOutUser();
          }
        } else {
          showToast("danger", t("do-not-access-contact-admin"));
          logOutUser();
        }
      } else {
        showToast("danger", t("user-not-found"));
        logOutUser();
      }
    } catch (error) {
      showToast("danger", t("something-went-wrong-mssg"));
      console.log("err", error);
    }
  };

  const togglePasswordVisibility = () => {
    setState({ ...state, passwordVisible: !state.passwordVisible });
  };

  const handleSubmitbtn = async (e) => {
    e.preventDefault();
    if (userDetails.Destination && userDetails.Company) {
      setThirdpartyLoader(true);
      const payload = { sessionToken: localStorage.getItem("accesstoken") };
      const userInformation = JSON.parse(
        localStorage.getItem("UserInformation")
      );
      if (payload && payload.sessionToken) {
        const params = {
          userDetails: {
            name: userInformation.name,
            email: userInformation.email,
            phone: userInformation?.phone || "",
            role: "contracts_User",
            company: userDetails.Company,
            jobTitle: userDetails.Destination,
            timezone: usertimezone
          }
        };
        const userSignUp = await Parse.Cloud.run("usersignup", params);
        if (userSignUp && userSignUp.sessionToken) {
          const LocalUserDetails = {
            name: userInformation.name,
            email: userInformation.email,
            phone: userInformation?.phone || "",
            company: userDetails.Company,
            jobTitle: userDetails.JobTitle
          };
          localStorage.setItem("userDetails", JSON.stringify(LocalUserDetails));
          thirdpartyLoginfn(userSignUp.sessionToken);
        } else {
          alert(userSignUp.message);
        }
      } else if (
        payload &&
        payload.message.replace(/ /g, "_") === "Internal_server_err"
      ) {
        alert(t("server-error"));
      }
    } else {
      showToast("warning", t("fill-required-details!"));
    }
  };

  const logOutUser = async () => {
    setIsModal(false);
    try {
      await Parse.User.logOut();
    } catch (err) {
      console.log("Err while logging out", err);
    }
    let appdata = localStorage.getItem("userSettings");
    let applogo = localStorage.getItem("appLogo");
    let defaultmenuid = localStorage.getItem("defaultmenuid");
    let PageLanding = localStorage.getItem("PageLanding");
    let baseUrl = localStorage.getItem("baseUrl");
    let appid = localStorage.getItem("parseAppId");
    let favicon = localStorage.getItem("favicon");

    localStorage.clear();
    saveLanguageInLocal(i18n);

    localStorage.setItem("appLogo", applogo);
    localStorage.setItem("defaultmenuid", defaultmenuid);
    localStorage.setItem("PageLanding", PageLanding);
    localStorage.setItem("userSettings", appdata);
    localStorage.setItem("baseUrl", baseUrl);
    localStorage.setItem("parseAppId", appid);
    localStorage.setItem("favicon", favicon);
  };

  const continueLoginFlow = async () => {
    try {
      const userSettings = appInfo.settings;
      const extUser = await Parse.Cloud.run("getUserDetails");
      if (extUser) {
        const IsDisabled = extUser?.get("IsDisabled") || false;
        if (!IsDisabled) {
          const userRole = extUser?.get("UserRole");
          const menu =
            userRole && userSettings?.find((menu) => menu.role === userRole);
          if (menu) {
            const _currentRole = userRole;
            const redirectUrl =
              location?.state?.from || `/${menu.pageType}/${menu.pageId}`;
            const _role = _currentRole.replace("contracts_", "");
            localStorage.setItem("_user_role", _role);
            const checkLanguage = extUser?.get("Language");
            if (checkLanguage) {
              checkLanguage && i18n.changeLanguage(checkLanguage);
            }
            const extInfo = JSON.parse(JSON.stringify(extUser));
            // Continue with storing user data and redirecting
            localStorage.setItem("Extand_Class", JSON.stringify([extUser]));
            localStorage.setItem("userEmail", extInfo.Email);
            localStorage.setItem("username", extInfo.Name);
            if (extInfo?.TenantId) {
              const tenant = {
                Id: extInfo?.TenantId?.objectId || "",
                Name: extInfo?.TenantId?.TenantName || ""
              };
              localStorage.setItem("TenantId", tenant?.Id);
              dispatch(showTenant(tenant?.Name));
              localStorage.setItem("TenantName", tenant?.Name);
            }
            localStorage.setItem("PageLanding", menu.pageId);
            localStorage.setItem("defaultmenuid", menu.menuId);
            localStorage.setItem("pageType", menu.pageType);
              setState({ ...state, loading: false });
              navigate(redirectUrl);
          } else {
            setState({ ...state, loading: false });
            setIsModal(true);
          }
        } else {
          showToast("danger", t("do-not-access-contact-admin"));
          logOutUser();
        }
      } else {
          showToast("danger", t("user-not-found"));
          logOutUser();
      }
    } catch (error) {
      console.error("Error during login flow", error);
      showToast("danger", error.message || t("something-went-wrong-mssg"));
    }
  };

  return errMsg ? (
    <div className="h-screen flex justify-center text-center items-center p-4 text-gray-500 text-base">
      {errMsg}
    </div>
  ) : (
    <>
      {state.loading && (
        <div
          aria-live="assertive"
          className="fixed w-full h-full flex justify-center items-center bg-black bg-opacity-30 z-50"
        >
          <Loader />
        </div>
      )}
      {appInfo && appInfo.appId ? (
        <>
          <div
            aria-labelledby="loginHeading"
            role="region"
            className="min-h-screen w-full flex flex-col md:flex-row bg-base-100"
          >
            {/* Brand panel - hidden on small screens */}
            <div className="hidden md:flex md:w-[44%] lg:w-[42%] relative overflow-hidden bg-gradient-to-br from-[#0B4B27] via-[#0F7A3D] to-[#1AA155] text-white flex-col justify-between p-10 lg:p-14">
              <div
                aria-hidden="true"
                className="login-blob pointer-events-none absolute -top-24 -right-20 w-72 h-72 rounded-full bg-white/10 blur-3xl"
              />
              <div
                aria-hidden="true"
                className="login-blob login-blob-delay pointer-events-none absolute -bottom-24 -left-16 w-80 h-80 rounded-full bg-white/10 blur-3xl"
              />

              <div className="relative z-10 inline-flex self-start bg-white/95 rounded-lg px-4 py-3 shadow-lg">
                {image && (
                  <img
                    src={image}
                    className="h-14 lg:h-16 w-auto object-contain"
                    alt="applogo"
                  />
                )}
              </div>

              <div className="relative z-10 my-auto py-10 space-y-6">
                <h2 className="text-3xl lg:text-[2.35rem] font-bold leading-tight">
                  Secure e-Signatures, built for Government workflows.
                </h2>
                <p className="text-white/80 text-sm lg:text-base max-w-md leading-relaxed">
                  Request, sign and track documents on a fully auditable,
                  legally-binding digital signature platform.
                </p>
                <ul className="space-y-3 pt-2">
                  {[
                    ["fa-shield-check", "Bank-grade encryption & full audit trail"],
                    ["fa-file-signature", "Legally binding digital signatures"],
                    ["fa-bolt", "Fast, paperless approvals"]
                  ].map(([icon, text]) => (
                    <li
                      key={text}
                      className="flex items-center gap-3 text-sm lg:text-[15px] text-white/90"
                    >
                      <span className="flex-none w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                        <i className={`fa-light ${icon}`} aria-hidden="true" />
                      </span>
                      {text}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="relative z-10 text-xs text-white/60">
                Power Planning &amp; Monitoring Company &middot; Ministry of
                Energy &middot; Govt. of Pakistan
              </p>
            </div>

            {/* Form panel */}
            <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
              <div className="w-full max-w-[420px] login-fade-in">
                <div className="md:hidden mb-8 flex justify-center">
                  {image && (
                    <img src={image} alt="applogo" className="h-14 object-contain" />
                  )}
                </div>

                <form onSubmit={handleLoginBtn} aria-label="Login Form">
                  <h1
                    id="loginHeading"
                    className="text-[28px] sm:text-[32px] font-bold text-base-content"
                  >
                    {t("welcome")}
                  </h1>
                  <p className="text-sm text-base-content/60 mt-1 mb-7">
                    {t("Login-to-your-account")}
                  </p>

                  <fieldset className="space-y-4">
                    <legend className="sr-only">
                      {t("Login-to-your-account")}
                    </legend>

                    <div>
                      <label
                        className="block text-xs font-semibold text-base-content/70 mb-1.5"
                        htmlFor="email"
                      >
                        {t("email")}
                      </label>
                      <div className="relative">
                        <i
                          className="fa-light fa-envelope absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 text-sm pointer-events-none"
                          aria-hidden="true"
                        />
                        <input
                          id="email"
                          type="email"
                          className="op-input op-input-bordered w-full h-11 pl-9 text-sm focus:outline-none transition-colors"
                          name="email"
                          autoComplete="username"
                          value={state.email}
                          onChange={handleChange}
                          required
                          onInvalid={(e) =>
                            e.target.setCustomValidity(t("input-required"))
                          }
                          onInput={(e) => e.target.setCustomValidity("")}
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        className="block text-xs font-semibold text-base-content/70 mb-1.5"
                        htmlFor="password"
                      >
                        {t("password")}
                      </label>
                      <div className="relative">
                        <i
                          className="fa-light fa-lock absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 text-sm pointer-events-none"
                          aria-hidden="true"
                        />
                        <input
                          id="password"
                          type={state.passwordVisible ? "text" : "password"}
                          className="op-input op-input-bordered w-full h-11 pl-9 pr-10 text-sm focus:outline-none transition-colors"
                          name="password"
                          value={state.password}
                          autoComplete="current-password"
                          onChange={handleChange}
                          onInvalid={(e) =>
                            e.target.setCustomValidity(
                              t("input-required")
                            )
                          }
                          onInput={(e) => e.target.setCustomValidity("")}
                          required
                        />
                        <button
                          type="button"
                          className="absolute cursor-pointer top-1/2 right-3 -translate-y-1/2 text-base-content/50 hover:text-base-content transition-colors"
                          onClick={togglePasswordVisibility}
                          aria-label={
                            state.passwordVisible
                              ? "Hide password"
                              : "Show password"
                          }
                        >
                          {state.passwordVisible ? (
                            <i className="fa-light fa-eye-slash text-sm" /> // Close eye icon
                          ) : (
                            <i className="fa-light fa-eye text-sm" /> // Open eye icon
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-box border-2 border-[#0F7A3D]/25 bg-[#0F7A3D]/[0.06] px-4 py-4">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <label
                          className="flex items-center gap-2"
                          htmlFor="captcha"
                        >
                          <span className="flex-none w-8 h-8 rounded-full bg-[#0F7A3D]/15 flex items-center justify-center">
                            <i
                              className="fa-light fa-shield-halved text-[#0F7A3D] text-sm"
                              aria-hidden="true"
                            />
                          </span>
                          <span>
                            <span className="block text-[10px] font-bold uppercase tracking-wide text-[#0F7A3D]/80">
                              Security Check
                            </span>
                            <span className="block text-sm font-semibold text-base-content">
                              What is{" "}
                              <span className="font-extrabold text-base tabular-nums select-none">
                                {captcha.question || "..."}
                              </span>
                              ?
                            </span>
                          </span>
                        </label>
                        <button
                          type="button"
                          className="flex-none op-btn op-btn-ghost op-btn-sm op-btn-circle text-[#0F7A3D] hover:bg-[#0F7A3D]/10"
                          onClick={loadCaptcha}
                          aria-label="Refresh captcha"
                        >
                          <i className="fa-light fa-rotate text-base" />
                        </button>
                      </div>
                      <input
                        id="captcha"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="Enter your answer"
                        className="op-input op-input-bordered w-full h-11 text-sm font-semibold bg-base-100 focus:outline-none"
                        value={captchaAnswer}
                        onChange={(e) => setCaptchaAnswer(e.target.value)}
                        required
                      />
                    </div>

                    <div className="flex justify-end">
                      <NavLink
                        to="/forgetpassword"
                        className="text-[13px] op-link op-link-primary underline-offset-2 focus:outline-none"
                      >
                        {t("forgot-password")}?
                      </NavLink>
                    </div>
                  </fieldset>

                  <button
                    type="submit"
                    className="op-btn op-btn-primary w-full h-11 mt-6 text-sm font-semibold shadow-md hover:shadow-lg transition-shadow"
                    disabled={state.loading}
                  >
                    {state.loading ? t("loading") : t("login")}
                  </button>
                </form>

                <div className="mt-8 flex justify-center">
                  <SelectLanguage isProfile />
                </div>
              </div>
            </div>
          </div>
          {state.alertMsg && (
            <Alert type={state.alertType}>{state.alertMsg}</Alert>
          )}
          <ModalUi
            isOpen={isModal}
            title={t("additional-info")}
            showClose={false}
          >
            <form className="px-4 py-3 text-base-content">
              <div className="mb-3">
                <label
                  htmlFor="Company"
                  style={{ display: "flex" }}
                  className="block text-xs font-semibold"
                >
                  {t("company")}{" "}
                  <span className="text-[red] text-[13px]">*</span>
                </label>
                <input
                  type="text"
                  className="op-input op-input-bordered op-input-sm focus:outline-none hover:border-base-content w-full text-xs"
                  id="Company"
                  value={userDetails.Company}
                  onChange={(e) =>
                    setUserDetails({
                      ...userDetails,
                      Company: e.target.value
                    })
                  }
                  onInvalid={(e) =>
                    e.target.setCustomValidity(t("input-required"))
                  }
                  onInput={(e) => e.target.setCustomValidity("")}
                  required
                />
              </div>
              <div className="mb-3">
                <label
                  htmlFor="JobTitle"
                  style={{ display: "flex" }}
                  className="block text-xs font-semibold"
                >
                  {t("job-title")}
                  <span className="text-[red] text-[13px]">*</span>
                </label>
                <input
                  type="text"
                  className="op-input op-input-bordered op-input-sm focus:outline-none hover:border-base-content w-full text-xs"
                  id="JobTitle"
                  value={userDetails.Destination}
                  onChange={(e) =>
                    setUserDetails({
                      ...userDetails,
                      Destination: e.target.value
                    })
                  }
                  onInvalid={(e) =>
                    e.target.setCustomValidity(t("input-required"))
                  }
                  onInput={(e) => e.target.setCustomValidity("")}
                  required
                />
              </div>
              <div className="mt-4 gap-2 flex flex-row">
                <button
                  type="button"
                  className="op-btn op-btn-primary"
                  onClick={(e) => handleSubmitbtn(e)}
                >
                  {t("login")}
                </button>
                <button
                  type="button"
                  className="op-btn op-btn-ghost text-base-content"
                  onClick={logOutUser}
                >
                  {t("cancel")}
                </button>
              </div>
            </form>
          </ModalUi>
        </>
      ) : (
        <div
          aria-live="assertive"
          className="fixed w-full h-full flex justify-center items-center z-50"
        >
          <Loader />
        </div>
      )}
    </>
  );
}
export default Login;
