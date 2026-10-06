import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runPhase6Tests() {
  console.log("=== RUNNING PHASE 6 VOUCHER MANAGEMENT VERIFICATION ===");

  const testOperator = `Tri-Test-${Date.now()}`;
  const testNominal = "50.000";

  // 1. Create a physical voucher with initial stock
  const initialStock = 20;
  const voucher = await prisma.$transaction(async (tx) => {
    const v = await tx.voucher.create({
      data: {
        operator: testOperator,
        nominal: testNominal,
        costPrice: 48500,
        sellingPrice: 52000,
        stock: initialStock,
        minStock: 5,
        isActive: true,
      },
    });

    await tx.voucherMovement.create({
      data: {
        voucherId: v.id,
        type: "INITIAL_STOCK",
        quantity: initialStock,
        previousStock: 0,
        newStock: initialStock,
        notes: "Initial test stock",
      },
    });

    return v;
  });

  console.log(`✓ Voucher Created: ID=${voucher.id}, Operator=${voucher.operator}, Nominal=${voucher.nominal}, Stock=${voucher.stock}`);

  // 2. Test Duplicate Operator + Nominal constraint
  let duplicateRejected = false;
  try {
    await prisma.voucher.create({
      data: {
        operator: testOperator,
        nominal: testNominal,
        costPrice: 48500,
        sellingPrice: 52000,
      },
    });
  } catch (e) {
    duplicateRejected = true;
  }
  console.log(`✓ Duplicate Operator + Nominal rejected properly: ${duplicateRejected}`);
  if (!duplicateRejected) throw new Error("Duplicate voucher should be rejected");

  // 3. Test Stock In (STOCK_IN)
  const incomingQty = 15;
  const stockInResult = await prisma.$transaction(async (tx) => {
    const v = await tx.voucher.findUniqueOrThrow({ where: { id: voucher.id } });
    const prev = v.stock;
    const next = prev + incomingQty;

    const updated = await tx.voucher.update({
      where: { id: voucher.id },
      data: { stock: next },
    });

    const m = await tx.voucherMovement.create({
      data: {
        voucherId: voucher.id,
        type: "STOCK_IN",
        quantity: incomingQty,
        previousStock: prev,
        newStock: next,
        notes: "Test Stock In pasokan 15 pcs",
      },
    });

    return { voucher: updated, movement: m };
  });

  console.log(`✓ Voucher Stock In Verified: Prev=${stockInResult.movement.previousStock} + ${incomingQty} -> New=${stockInResult.voucher.stock}`);
  if (stockInResult.voucher.stock !== initialStock + incomingQty) {
    throw new Error("Voucher Stock In calculation mismatch");
  }

  // 4. Verify Movement Log count
  const movements = await prisma.voucherMovement.findMany({
    where: { voucherId: voucher.id },
  });
  console.log(`✓ Voucher Movements recorded: count=${movements.length} (INITIAL_STOCK and STOCK_IN)`);
  if (movements.length !== 2) throw new Error("Expected 2 voucher movements");

  // 5. Clean up test voucher and movements
  await prisma.voucherMovement.deleteMany({ where: { voucherId: voucher.id } });
  await prisma.voucher.delete({ where: { id: voucher.id } });
  console.log("✓ Test voucher cleaned up successfully");

  console.log("=== ALL PHASE 6 TESTS PASSED! ===");
}

runPhase6Tests()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
