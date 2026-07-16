import { describe, expect, it } from "vitest";
import { authEmailForSignIn } from "./auth-identifier";

describe("authEmailForSignIn", () => {
  it("maps reserved test account names to internal emails", () => {
    expect(authEmailForSignIn(" TEST-01 ")).toBe("test-01@papermint.test");
    expect(authEmailForSignIn("test-05")).toBe("test-05@papermint.test");
  });

  it("leaves normal email sign-ins unchanged", () => {
    expect(authEmailForSignIn(" Founder@Example.com ")).toBe("founder@example.com");
    expect(authEmailForSignIn("test-06")).toBe("test-06");
  });
});
