import { describe, expect, it } from "vitest";
import { phoneLinkProblem } from "./phone-link";

describe("phoneLinkProblem", () => {
  it.each([
    "http://localhost:3000",
    "https://localhost:3000",
    "http://app.localhost",
    "http://127.0.0.1:3000",
    "http://[::1]:3000",
  ])("signale une adresse locale : %s", (origin) => {
    expect(phoneLinkProblem(origin)).toBe("local");
  });

  it.each(["http://192.168.1.20:3000", "http://mon-pc.local:3000"])(
    "signale une adresse du réseau en HTTP : %s",
    (origin) => {
      expect(phoneLinkProblem(origin)).toBe("insecure");
    },
  );

  it("accepte une adresse HTTPS", () => {
    expect(phoneLinkProblem("https://abc.trycloudflare.com")).toBeNull();
    expect(phoneLinkProblem("https://192.168.1.20:3000")).toBeNull();
  });

  it("ignore une adresse invalide", () => {
    expect(phoneLinkProblem("pas une adresse")).toBeNull();
  });
});
