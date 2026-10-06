import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runPhase5Tests() {
  console.log("=== RUNNING PHASE 5 INVENTORY VERIFICATION ===");

  // 1. Get or create a sample product for testing
  let product = await prisma.product.findFirst({
    where: { isActive: true },
  });

  if (!product) {
    const category = await prisma.category.findFirst() || await prisma.category.create({
      data: { name: "Test Cat" },
    });
    product = await prisma.product.create({
      data: {
        sku: `TEST-INV-${Date.now()}`,
        name: "Test Inventory Item",
        categoryId: category.id,
        costPrice: 50000,
        sellingPrice: 75000,
        stock: 10,
        minStock: 2,
        type: "ACCESSORY",
      },
    });
  }

  const initialStock = product.stock;
  console.log(`✓ Testing with product: SKU=${product.sku}, Current Stock=${initialStock}`);

  // 2. Test Stock In (PURCHASE)
  const addQty = 7;
  const stockInResult = await prisma.$transaction(async (tx) => {
    const p = await tx.product.findUniqueOrThrow({ where: { id: product.id } });
    const prev = p.stock;
    const next = prev + addQty;

    const updated = await tx.product.update({
      where: { id: product.id },
      data: { stock: next },
    });

    const m = await tx.inventoryMovement.create({
      data: {
        productId: product.id,
        type: "PURCHASE",
        quantity: addQty,
        previousStock: prev,
        newStock: next,
        notes: "Test stock in restock",
      },
    });

    return { product: updated, movement: m };
  });

  console.log(`✓ Stock In Verified: Prev=${stockInResult.movement.previousStock} + ${addQty} -> New=${stockInResult.product.stock}`);
  if (stockInResult.product.stock !== initialStock + addQty) {
    throw new Error("Stock In calculation mismatch");
  }

  // 3. Test Stock Adjustment (ADJUSTMENT - Opname)
  // Let's adjust stock down by 2 (e.g. damaged goods)
  const targetActualStock = stockInResult.product.stock - 2;
  const adjustmentResult = await prisma.$transaction(async (tx) => {
    const p = await tx.product.findUniqueOrThrow({ where: { id: product.id } });
    const prev = p.stock;
    const diff = targetActualStock - prev; // should be -2

    const updated = await tx.product.update({
      where: { id: product.id },
      data: { stock: targetActualStock },
    });

    const m = await tx.inventoryMovement.create({
      data: {
        productId: product.id,
        type: "ADJUSTMENT",
        quantity: diff,
        previousStock: prev,
        newStock: targetActualStock,
        notes: "[Test Opname] Barang rusak 2 unit",
      },
    });

    return { product: updated, movement: m, diff };
  });

  console.log(`✓ Stock Adjustment Verified: Prev=${adjustmentResult.movement.previousStock} -> New=${adjustmentResult.product.stock} (diff=${adjustmentResult.diff})`);
  if (adjustmentResult.product.stock !== targetActualStock || adjustmentResult.diff !== -2) {
    throw new Error("Stock Adjustment calculation mismatch");
  }

  // 4. Restore original stock
  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: product.id },
      data: { stock: initialStock },
    });
    // Remove the two test movements
    await tx.inventoryMovement.delete({ where: { id: stockInResult.movement.id } });
    await tx.inventoryMovement.delete({ where: { id: adjustmentResult.movement.id } });
  });

  console.log(`✓ Restored original product stock to ${initialStock} and cleaned test movements`);
  console.log("=== ALL PHASE 5 TESTS PASSED! ===");
}

runPhase5Tests()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
