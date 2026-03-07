import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRentTenantWhereForUser,
  getManagedLandlordEmail,
  isRentManagerUser,
} from "./rentAccess.js";

test("isRentManagerUser allows admin and landlord roles only", () => {
  assert.equal(isRentManagerUser({ roleName: "Admin" }), true);
  assert.equal(isRentManagerUser({ roleName: "Landlord" }), true);
  assert.equal(isRentManagerUser({ roleName: "Tenant" }), false);
});

test("getManagedLandlordEmail returns the normalized landlord email", () => {
  assert.equal(
    getManagedLandlordEmail({ roleName: "Landlord", email: " OWNER@Example.com " }),
    "owner@example.com"
  );
  assert.equal(getManagedLandlordEmail({ roleName: "Admin", email: "owner@example.com" }), null);
});

test("buildRentTenantWhereForUser gives admins organization-wide access", () => {
  assert.deepEqual(buildRentTenantWhereForUser({ roleName: "Admin", organizationId: 9 }), {
    organizationId: 9,
  });
});

test("buildRentTenantWhereForUser scopes landlords by landlord email", () => {
  assert.deepEqual(
    buildRentTenantWhereForUser({
      roleName: "Landlord",
      organizationId: 9,
      email: "owner@example.com",
    }),
    {
      organizationId: 9,
      landlordEmail: {
        equals: "owner@example.com",
        mode: "insensitive",
      },
    }
  );
});

test("buildRentTenantWhereForUser scopes tenants by tenant email", () => {
  assert.deepEqual(
    buildRentTenantWhereForUser({
      roleName: "Tenant",
      organizationId: 9,
      email: "tenant@example.com",
    }),
    {
      organizationId: 9,
      tenantEmail: {
        equals: "tenant@example.com",
        mode: "insensitive",
      },
    }
  );
});

test("buildRentTenantWhereForUser blocks scoped users without an email", () => {
  assert.deepEqual(buildRentTenantWhereForUser({ roleName: "Landlord", organizationId: 9 }), {
    organizationId: 9,
    id: -1,
  });
});
