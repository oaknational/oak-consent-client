import Cookies from "js-cookie";

const COOKIE_NAME = "oak_consent";
const STORAGE_KEY = "oak_consent";

export async function setCookie(value: string) {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);

  // Try modern Cookie Store API first - Enable CHIPS for cross-site iframe support
  if (typeof window !== "undefined" && window.cookieStore) {
    try {
      await window.cookieStore.set({
        name: COOKIE_NAME,
        value: value,
        expires: date.getTime(),
        path: "/",
        sameSite: "none",
        partitioned: true,
      });
      return;
    } catch (error) {
      console.warn("[oak_consent] Cookie Store API failed:", error);
    }
  }

  const isSecure = window.location.protocol === "https:";

  // Fallback to js-cookie library
  try {
    Cookies.set(COOKIE_NAME, value, {
      expires: date,
      path: "/",
      sameSite: "none",
      secure: isSecure,
    });
  } catch (error) {
    console.error("[oak_consent] Error setting cookie with js-cookie:", error);
  }

  // Verify cookie was set
  const cookieSet = Cookies.get(COOKIE_NAME) !== undefined;

  if (!cookieSet) {
    // Final fallback to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (error) {
      console.error("[oak_consent] localStorage also failed:", error);
    }
  }
}

export async function getCookie() {
  // Try modern Cookie Store API first
  if (typeof window !== "undefined" && window.cookieStore) {
    try {
      const cookie = await window.cookieStore.get(COOKIE_NAME);
      if (cookie?.value) {
        return cookie.value;
      }
    } catch (error) {
      console.warn("[oak_consent] Cookie Store API get failed:", error);
    }
  }

  // Try js-cookie
  const cookieValue = Cookies.get(COOKIE_NAME);
  if (cookieValue) {
    return cookieValue;
  }

  // Fallback to localStorage
  try {
    const storageValue = localStorage.getItem(STORAGE_KEY);
    if (storageValue) {
      return storageValue;
    }
  } catch (error) {
    console.error("[oak_consent] Error reading from localStorage:", error);
  }

  return undefined;
}
