import { afterEach, describe, expect, it, jest } from "@jest/globals";

import { getCookie, setCookie } from "./cookies";

type StoredCookie = {
  name: string;
  value: string;
  domain: string | null;
  partitioned: boolean;
};

const LEGACY_VALUE = '{"user":"testUserId","app":"testApp","policies":[]}';
const CURRENT_VALUE =
  '{"user":"testUserId","app":"testApp","policies":[{"id":"1","v":1,"slug":"analytics","state":"denied"}]}';

/**
 * Written by <=2.2.0 with `Domain=<hostname>` and without `Partitioned`
 */
const legacyCookie = (): StoredCookie => ({
  name: "oak_consent",
  value: LEGACY_VALUE,
  domain: window.location.hostname,
  partitioned: false,
});

const currentCookie = (value = CURRENT_VALUE): StoredCookie => ({
  name: "oak_consent",
  value,
  domain: null,
  partitioned: true,
});

/**
 * Keys and orders cookies the way browsers do (name + domain + partition, oldest first),
 * which jsdom's cookie jar does not: it merges host-only and `Domain=` cookies into one
 */
function createCookieStore(initial: StoredCookie[]) {
  const cookies = [...initial];
  const indexOf = ({
    name,
    domain,
    partitioned,
  }: Omit<StoredCookie, "value">) =>
    cookies.findIndex(
      (c) =>
        c.name === name && c.domain === domain && c.partitioned === partitioned,
    );

  const cookieStore: NonNullable<Window["cookieStore"]> = {
    async get(nameOrOptions) {
      const name =
        typeof nameOrOptions === "string" ? nameOrOptions : nameOrOptions.name;
      return cookies.find((c) => c.name === name);
    },
    async getAll(name) {
      return cookies.filter((c) => c.name === name);
    },
    async set({ name, value, domain = null, partitioned = false }) {
      const cookie = { name, value, domain, partitioned };
      const index = indexOf(cookie);
      if (index === -1) {
        cookies.push(cookie);
      } else {
        // Replacing a cookie keeps its original creation order
        cookies[index] = cookie;
      }
    },
    async delete(nameOrOptions) {
      const {
        name,
        domain = null,
        partitioned = false,
      } = typeof nameOrOptions === "string"
        ? { name: nameOrOptions }
        : nameOrOptions;
      const index = indexOf({ name, domain, partitioned });
      if (index !== -1) {
        cookies.splice(index, 1);
      }
    },
  };

  return { cookieStore, cookies };
}

describe("cookies", () => {
  afterEach(() => {
    delete window.cookieStore;
  });

  describe("with the Cookie Store API", () => {
    it("should read the current cookie when a legacy cookie is also present", async () => {
      const { cookieStore } = createCookieStore([
        legacyCookie(),
        currentCookie(),
      ]);
      window.cookieStore = cookieStore;

      expect(await getCookie()).toBe(CURRENT_VALUE);
    });

    it("should remove the legacy cookie when the current cookie is also present", async () => {
      const { cookieStore, cookies } = createCookieStore([
        legacyCookie(),
        currentCookie(),
      ]);
      window.cookieStore = cookieStore;

      await getCookie();

      expect(cookies).toEqual([currentCookie()]);
    });

    it("should keep reading a legacy cookie when it is the only cookie", async () => {
      const { cookieStore, cookies } = createCookieStore([legacyCookie()]);
      window.cookieStore = cookieStore;

      expect(await getCookie()).toBe(LEGACY_VALUE);
      expect(cookies).toEqual([legacyCookie()]);
    });

    it("should replace the legacy cookie when setting the cookie", async () => {
      const { cookieStore, cookies } = createCookieStore([legacyCookie()]);
      window.cookieStore = cookieStore;

      await setCookie(CURRENT_VALUE);

      expect(cookies).toEqual([currentCookie()]);
      expect(await getCookie()).toBe(CURRENT_VALUE);
    });

    it("should update the current cookie when setting the cookie", async () => {
      const { cookieStore, cookies } = createCookieStore([
        currentCookie(LEGACY_VALUE),
      ]);
      window.cookieStore = cookieStore;

      await setCookie(CURRENT_VALUE);

      expect(cookies).toEqual([currentCookie()]);
    });

    it("should not try to remove a legacy cookie when there is only one cookie", async () => {
      // Deleting an unpartitioned cookie throws in cross-site iframes (e.g. Google Classroom)
      const { cookieStore } = createCookieStore([currentCookie(LEGACY_VALUE)]);
      const deleteSpy = jest.spyOn(cookieStore, "delete");
      window.cookieStore = cookieStore;

      await setCookie(CURRENT_VALUE);
      await getCookie();

      expect(deleteSpy).not.toHaveBeenCalled();
    });
  });
});
