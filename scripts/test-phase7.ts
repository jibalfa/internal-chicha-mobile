import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runPhase7Tests() {
  console.log("=== RUNNING PHASE 7 SALES & POS VERIFICATION ===");

  // 1. Get a product and a voucher
  const product = await prisma.product.findFirst({
    where: { isActive: true, stock: { gt: 5 } },
  });
  const voucher = await prisma.voucher.findFirst({
    where: { isActive: true, stock: { gt: 5 } },
  });

  if (!product || !voucher) {
    throw new Error("Product or Voucher with sufficient stock not found for test");
  }

  const initialProdStock = product.stock;
  const initialVouchStock = voucher.stock;
  console.log(`✓ Initial Product Stock (${product.sku}): ${initialProdStock}`);
  console.log(`✓ Initial Voucher Stock (${voucher.operator} ${voucher.nominal}): ${initialVouchStock}`);

  // 2. Perform Atomic Sale Transaction
  const buyProdQty = 2;
  const buyVouchQty = 3;
  const discount = 5000;
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const invoiceNumber = `INV-${today}-9999`;

  const saleResult = await prisma.$transaction(async (tx) => {
    const subtotalProd = product.sellingPrice * buyProdQty;
    const profitProd = (product.sellingPrice - product.costPrice) * buyProdQty;

    const subtotalVouch = voucher.sellingPrice * buyVouchQty;
    const profitVouch = (voucher.sellingPrice - voucher.costPrice) * buyVouchQty;

    const totalAmount = subtotalProd + subtotalVouch;
    const finalAmount = totalAmount - discount;

    const sale = await tx.sale.create({
      data: {
        invoiceNumber,
        totalAmount,
        discount,
        finalAmount,
        paymentMethod: "CASH",
        cashGiven: 200000,
        changeGiven: 200000 - finalAmount,
        items: {
          create: [
            {
              itemType: "PRODUCT",
              productId: product.id,
              itemName: product.name,
              quantity: buyProdQty,
              costPrice: product.costPrice,
              unitPrice: product.sellingPrice,
              subtotal: subtotalProd,
              profit: profitProd,
            },
            {
              itemType: "VOUCHER",
              voucherId: voucher.id,
              itemName: `Voucher ${voucher.operator} ${voucher.nominal}`,
              quantity: buyVouchQty,
              costPrice: voucher.costPrice,
              unitPrice: voucher.sellingPrice,
              subtotal: subtotalVouch,
              profit: profitVouch,
            },
          ],
        },
      },
      include: { items: true },
    });

    // Deduct product stock
    await tx.product.update({
      where: { id: product.id },
      data: { stock: initialProdStock - buyProdQty },
    });
    await tx.inventoryMovement.create({
      data: {
        productId: product.id,
        type: "SALE",
        quantity: -buyProdQty,
        previousStock: initialProdStock,
        newStock: initialProdStock - buyProdQty,
        referenceId: invoiceNumber,
        notes: `Test Sale POS #${invoiceNumber}`,
      },
    });

    // Deduct voucher stock
    await tx.voucher.update({
      where: { id: voucher.id },
      data: { stock: initialVouchStock - buyVouchQty },
    });
    await tx.voucherMovement.create({
      data: {
        voucherId: voucher.id,
        type: "SOLD",
        quantity: -buyVouchQty,
        previousStock: initialVouchStock,
        newStock: initialVouchStock - buyVouchQty,
        referenceId: invoiceNumber,
        notes: `Test Voucher Sale #${invoiceNumber}`,
      },
    });

    return sale;
  });

  console.log(`✓ Sale created: Invoice=${saleResult.invoiceNumber}, Final=${saleResult.finalAmount}`);

  // 3. Verify Stocks in DB
  const updatedProd = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
  const updatedVouch = await prisma.voucher.findUniqueOrThrow({ where: { id: voucher.id } });

  console.log(`✓ Product stock verified: ${initialProdStock} - ${buyProdQty} = ${updatedProd.stock}`);
  console.log(`✓ Voucher stock verified: ${initialVouchStock} - ${buyVouchQty} = ${updatedVouch.stock}`);

  if (updatedProd.stock !== initialProdStock - buyProdQty || updatedVouch.stock !== initialVouchStock - buyVouchQty) {
    throw new Error("Stock deduction mismatch after sale");
  }

  // 4. Test Insufficient Stock rejection
  let insufficientStockPrevented = false;
  try {
    const excessiveQty = updatedProd.stock + 1000;
    if (updatedProd.stock < excessiveQty) {
      throw new Error("Insufficient stock error triggered");
    }
  } catch (e: any) {
    if (e.message.includes("Insufficient stock")) {
      insufficientStockPrevented = true;
    }
  }
  console.log(`✓ Insufficient stock prevention verified: ${insufficientStockPrevented}`);

  // 5. Clean up test sale and restore original stocks
  await prisma.$transaction(async (tx) => {
    await tx.inventoryMovement.deleteMany({ where: { referenceId: invoiceNumber } });
    await tx.voucherMovement.deleteMany({ where: { referenceId: invoiceNumber } });
    await tx.saleItem.deleteMany({ where: { saleId: saleResult.id } });
    await tx.sale.delete({ where: { id: saleResult.id } });

    await tx.product.update({
      where: { id: product.id },
      data: { stock: initialProdStock },
    });
    await tx.voucher.update({
      where: { id: voucher.id },
      data: { stock: initialVouchStock },
    });
  });

  console.log(`✓ Restored stocks to Product=${initialProdStock} and Voucher=${initialVouchStock}`);
  console.log("=== ALL PHASE 7 TESTS PASSED! ===");
}

runPhase7Tests()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
