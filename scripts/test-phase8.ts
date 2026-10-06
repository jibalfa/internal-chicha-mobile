import { PrismaClient } from "@prisma/client";
import { calculateDigitalProfit } from "../src/lib/calculations";

const prisma = new PrismaClient();

async function runPhase8Tests() {
  console.log("=== RUNNING PHASE 8 DIGITAL TRANSACTIONS VERIFICATION ===");

  // 1. Snapshot physical inventory count & voucher stock
  const initialInvMovements = await prisma.inventoryMovement.count();
  const initialVouchMovements = await prisma.voucherMovement.count();

  // 2. Create a test digital product
  const digitalProduct = await prisma.digitalProduct.create({
    data: {
      category: "PLN",
      provider: "PLN",
      name: "Token PLN 20.000 (Test)",
      nominal: 20000,
      costPrice: 20200,
      sellingPrice: 22500,
      isActive: true,
    },
  });

  console.log(`✓ Digital Product Created: ID=${digitalProduct.id}, Name=${digitalProduct.name}`);

  // 3. Create a Digital Transaction in PENDING status
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const trxNumber = `DGT-${today}-9999`;

  const pendingProfit = calculateDigitalProfit(digitalProduct.sellingPrice, digitalProduct.costPrice, "PENDING");
  const trx = await prisma.digitalTransaction.create({
    data: {
      trxNumber,
      digitalProductId: digitalProduct.id,
      destinationNumber: "14234567890",
      costPrice: digitalProduct.costPrice,
      sellingPrice: digitalProduct.sellingPrice,
      profit: pendingProfit,
      status: "PENDING",
      notes: "Test token PLN",
    },
  });

  console.log(`✓ Digital Transaction Created (PENDING): TrxNo=${trx.trxNumber}, Profit=${trx.profit} (expect 0)`);
  if (trx.profit !== 0) throw new Error("Pending digital transaction must have 0 profit");

  // 4. Update status to SUCCESS
  const successProfit = calculateDigitalProfit(digitalProduct.sellingPrice, digitalProduct.costPrice, "SUCCESS");
  const updatedSuccess = await prisma.digitalTransaction.update({
    where: { id: trx.id },
    data: {
      status: "SUCCESS",
      profit: successProfit,
    },
  });

  console.log(`✓ Digital Transaction Updated to SUCCESS: Status=${updatedSuccess.status}, Profit=${updatedSuccess.profit} (expect 2300)`);
  if (updatedSuccess.profit !== 2300) throw new Error("Success digital transaction profit mismatch");

  // 5. Update status to REFUNDED
  const refundProfit = calculateDigitalProfit(digitalProduct.sellingPrice, digitalProduct.costPrice, "REFUNDED");
  const updatedRefund = await prisma.digitalTransaction.update({
    where: { id: trx.id },
    data: {
      status: "REFUNDED",
      profit: refundProfit,
    },
  });

  console.log(`✓ Digital Transaction Updated to REFUNDED: Status=${updatedRefund.status}, Profit=${updatedRefund.profit} (expect 0)`);
  if (updatedRefund.profit !== 0) throw new Error("Refunded digital transaction profit must be 0");

  // 6. Verify Critical Business Rule: NO physical inventory was modified!
  const finalInvMovements = await prisma.inventoryMovement.count();
  const finalVouchMovements = await prisma.voucherMovement.count();
  console.log(`✓ Physical inventory integrity: Initial=${initialInvMovements}, Final=${finalInvMovements}`);
  console.log(`✓ Physical voucher integrity: Initial=${initialVouchMovements}, Final=${finalVouchMovements}`);

  if (finalInvMovements !== initialInvMovements || finalVouchMovements !== initialVouchMovements) {
    throw new Error("Digital transaction illegally touched physical inventory!");
  }

  // 7. Clean up test data
  await prisma.digitalTransaction.delete({ where: { id: trx.id } });
  await prisma.digitalProduct.delete({ where: { id: digitalProduct.id } });
  console.log("✓ Test digital transaction & product cleaned up successfully");

  console.log("=== ALL PHASE 8 TESTS PASSED! ===");
}

runPhase8Tests()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
