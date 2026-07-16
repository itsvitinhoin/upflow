import assert from "node:assert/strict";
import test from "node:test";
import { isCommercialDepartmentName } from "../../src/lib/project-creation-access";

test("project creation recognizes canonical Commercial and Comercial departments", () => {
  assert.equal(isCommercialDepartmentName("Commercial"), true);
  assert.equal(isCommercialDepartmentName("Commercial Operations"), true);
  assert.equal(isCommercialDepartmentName("Comercial"), true);
  assert.equal(isCommercialDepartmentName("Comercial / Vendas"), true);
  assert.equal(isCommercialDepartmentName("Non-commercial"), false);
  assert.equal(isCommercialDepartmentName("Marketing"), false);
  assert.equal(isCommercialDepartmentName(null), false);
});
