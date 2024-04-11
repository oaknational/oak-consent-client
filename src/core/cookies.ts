import Cookies from "js-cookie";

const COOKIE_NAME = "oak_consent";

export function setCookie(value: string) {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  document.cookie = `${COOKIE_NAME}=${value}; expires=${date.toUTCString()}; sameSite=lax; path=/; domain=${
    window.location.hostname
  }`;
}
export function getCookie() {
  return Cookies.get(COOKIE_NAME);
}
