import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runPhase4Tests() {
  console.log("=== RUNNING PHASE 4 PRODUCTS & CATEGORIES VERIFICATION ===");

  // 1. Create a Category
  const testCat = await prisma.category.upsert({
    where: { name: "Kabel & Adaptor" },
    update: {},
    create: {
      name: "Kabel & Adaptor",
      description: "Kabel data lightning, type-c, micro-usb",
    },
  });
  console.log(`✓ Category Created/Found: ID=${testCat.id}, Name=${testCat.name}`);

  // 2. Create a Supplier
  const testSup = await prisma.supplier.create({
    data: {
      name: "PT Kabel Nusantara Perkasa",
      phone: "081299991111",
      contactPerson: "Pak Budi Kabel",
    },
  });
  console.log(`✓ Supplier Created: ID=${testSup.id}, Name=${testSup.name}`);

  // 3. Create an Accessory Product with Initial Movement
  const testProdSKU = `ACC-CBL-60W-${Date.now()}`;
  const prod = await prisma.$transaction(async (tx) => {
    const p = await tx.product.create({
      data: {
        sku: testProdSKU,
        name: "Kabel Type-C to Type-C 60W Braided",
        categoryId: testCat.id,
        brand: "ChiCha Gear",
        costPrice: 20000,
        sellingPrice: 45000,
        stock: 15,
        minStock: 5,
        supplierId: testSup.id,
        type: "ACCESSORY",
        isActive: true,
      },
    });

    await tx.inventoryMovement.create({
      data: {
        productId: p.id,
        type: "INITIAL_STOCK",
        quantity: 15,
        previousStock: 0,
        newStock: 15,
        notes: "Initial stock verification test",
      },
    });

    return p;
  });

  console.log(`✓ Product Created: ID=${prod.id}, SKU=${prod.sku}, Stock=${prod.stock}`);

  // 4. Verify Inventory Movement was created
  const movements = await prisma.inventoryMovement.findMany({
    where: { productId: prod.id },
  });
  console.log(`✓ Inventory Movement recorded: count=${movements.length}, type=${movements[0]?.type}, qty=${movements[0]?.quantity}`);
  if (movements.length !== 1 || movements[0].type !== "INITIAL_STOCK" || movements[0].quantity !== 15) {
    throw new Error("Initial inventory movement verification failed");
  }

  // 5. Test Duplicate SKU rejection
  let duplicateRejected = false;
  try {
    await prisma.product.create({
      data: {
        sku: testProdSKU,
        name: "Duplicate Cable",
        categoryId: testCat.id,
        costPrice: 10000,
        sellingPrice: 20000,
      },
    });
  } catch (e) {
    duplicateRejected = true;
  }
  console.log(`✓ Duplicate SKU rejected properly: ${duplicateRejected}`);
  if (!duplicateRejected) throw new Error("Duplicate SKU should have been rejected");

  // 6. Test Low Stock Filtering
  const lowStockProds = await prisma.product.findMany({
    where: {
      stock: { lte: 5 },
      isActive: true,
    },
  });
  console.log(`✓ Low stock query executed: found ${lowStockProds.length} items with stock <= 5`);

  // 7. Clean up test data
  await prisma.inventoryMovement.deleteMany({ where: { productId: prod.id } });
  await prisma.product.delete({ where: { id: prod.id } });
  await prisma.supplier.delete({ where: { id: testSup.id } });
  console.log("✓ Test artifacts cleaned up successfully");

  console.log("=== ALL PHASE 4 TESTS PASSED! ===");
}

runPhase4Tests()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
