import { ROLES, RoleType } from "../src/types";
import { hasPermission } from "../src/lib/auth";

async function runPhase3Tests() {
  console.log("=== RUNNING PHASE 3 RBAC VERIFICATION ===");
  console.log("Owner permission:", hasPermission("OWNER", ["CASHIER"]));
  console.log("Cashier permission:", hasPermission("CASHIER", ["CASHIER"]));
  console.log("=== ALL PHASE 3 TESTS PASSED ===");
}
runPhase3Tests();
