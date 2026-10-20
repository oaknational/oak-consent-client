import Cookies from "js-cookie";

const COOKIE_NAME = "oak_consent";
const STORAGE_KEY = "oak_consent";

async function countCookies() {
  if (window.cookieStore) {
    try {
      return (await window.cookieStore.getAll(COOKIE_NAME)).length;
    } catch (error) {
      console.warn("[oak_consent] Cookie Store API getAll failed:", error);
    }
  }

  return document.cookie
    .split("; ")
    .filter((cookie) => cookie.startsWith(`${COOKIE_NAME}=`)).length;
}

/**
 * <=2.2.0 set the cookie with `Domain=<hostname>` and without `Partitioned`, so browsers store it
 * separately from the current host-only, partitioned cookie. When both exist the legacy cookie is
 * returned first because it is older, hiding every consent saved since.
 *
 * A legacy cookie on its own holds the user's only consents, so it is only removed alongside another.
 */
async function removeLegacyCookieIfDuplicated() {
  try {
    if ((await countCookies()) < 2) {
      return;
    }

    const options = { domain: window.location.hostname, path: "/" };

    if (window.cookieStore) {
      try {
        await window.cookieStore.delete({ name: COOKIE_NAME, ...options });
        return;
      } catch (error) {
        console.warn("[oak_consent] Cookie Store API delete failed:", error);
      }
    }

    Cookies.remove(COOKIE_NAME, options);
  } catch (error) {
    console.error("[oak_consent] Error removing legacy cookie:", error);
  }
}

export async function setCookie(value: string) {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);

  // Try modern Cookie Store API first.
  // OWA runs inside Google Classroom's cross-site iframe, where browsers don't store or send
  // `SameSite=Lax` cookies, hence `SameSite=None`. Browsers that block third-party cookies still
  // allow a `Partitioned` (CHIPS) cookie, kept in a separate jar per top-level site, so consent
  // given inside Classroom is stored apart from consent given on the site itself.
  // Name, Domain, Path and Partitioned make up the cookie's identity: changing any of them creates
  // a second cookie instead of replacing this one (see removeLegacyCookieIfDuplicated).
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
      await removeLegacyCookieIfDuplicated();
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

  await removeLegacyCookieIfDuplicated();

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
  if (typeof window !== "undefined") {
    await removeLegacyCookieIfDuplicated();
  }

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
