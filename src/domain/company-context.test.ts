import { describe, expect, it } from "vitest";
import { selectActiveCompany } from "./company-context";

const companies = [{ companyId: "company-a" }, { companyId: "company-b" }];

describe("active company selection", () => {
  it("requires an explicit selection for multiple memberships", () => {
    expect(selectActiveCompany(companies, null)).toBeUndefined();
    expect(selectActiveCompany(companies, "company-b")).toEqual({ companyId: "company-b" });
  });

  it("never accepts a company outside the fresh membership set", () => {
    expect(selectActiveCompany(companies, "company-c")).toBeUndefined();
  });

  it("may automatically select the sole active membership", () => {
    expect(selectActiveCompany([companies[0]], null)).toEqual({ companyId: "company-a" });
  });
});
