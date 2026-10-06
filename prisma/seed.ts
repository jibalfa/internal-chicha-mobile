import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database ChiCha Mobile...");

  // 1. Clean up existing data if any
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.digitalTransaction.deleteMany();
  await prisma.digitalProduct.deleteMany();
  await prisma.voucherMovement.deleteMany();
  await prisma.voucher.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.user.deleteMany();

  // 2. Users with hashed passwords
  const passwordOwner = await bcrypt.hash("admin123", 10);
  const passwordKasir = await bcrypt.hash("kasir123", 10);

  const owner = await prisma.user.create({
    data: {
      name: "Owner ChiCha Mobile",
      username: "owner@chichamobile.com",
      password: passwordOwner,
      role: "OWNER",
      phone: "081234567890",
    },
  });

  const kasir = await prisma.user.create({
    data: {
      name: "Ahmad Kasir",
      username: "kasir",
      password: passwordKasir,
      role: "CASHIER",
      phone: "081234567891",
    },
  });

  console.log("Seeded users (owner, kasir)");

  // 3. Categories & Suppliers
  const catAksesoris = await prisma.category.create({
    data: { name: "Aksesoris", description: "Case, charger, tempered glass, audio" },
  });

  const supplier = await prisma.supplier.create({
    data: {
      name: "CV Aksesoris Perkasa",
      phone: "081999887766",
      address: "Mangga Dua Mall Lt. 3",
      contactPerson: "Ko Willy",
    },
  });

  // 4. Products (Accessories) with initial inventory movements
  const prodCharger = await prisma.product.create({
    data: {
      sku: "ACC-CHG-20W",
      name: "Fast Charger Type-C 20W Original",
      categoryId: catAksesoris.id,
      brand: "ChiCha Gear",
      costPrice: 45000,
      sellingPrice: 85000,
      stock: 25,
      minStock: 5,
      type: "ACCESSORY",
      supplierId: supplier.id,
      inventoryMovements: {
        create: {
          type: "INITIAL_STOCK",
          quantity: 25,
          previousStock: 0,
          newStock: 25,
          notes: "Saldo awal inventaris aksesoris",
          createdById: owner.id,
        },
      },
    },
  });

  const prodTG = await prisma.product.create({
    data: {
      sku: "ACC-TG-SAMA54",
      name: "Tempered Glass Full Cover Samsung A54",
      categoryId: catAksesoris.id,
      brand: "ProShield",
      costPrice: 10000,
      sellingPrice: 35000,
      stock: 30,
      minStock: 5,
      type: "ACCESSORY",
      supplierId: supplier.id,
      inventoryMovements: {
        create: {
          type: "INITIAL_STOCK",
          quantity: 30,
          previousStock: 0,
          newStock: 30,
          notes: "Saldo awal tempered glass",
          createdById: owner.id,
        },
      },
    },
  });

  // 5. Vouchers (Quantity-based physical stock)
  const voucherTsel10 = await prisma.voucher.create({
    data: {
      operator: "Telkomsel",
      nominal: "10.000",
      costPrice: 10200,
      sellingPrice: 12000,
      stock: 50,
      minStock: 10,
      movements: {
        create: {
          type: "INITIAL_STOCK",
          quantity: 50,
          previousStock: 0,
          newStock: 50,
          notes: "Stok awal voucher Telkomsel 10K",
        },
      },
    },
  });

  const voucherIsat10 = await prisma.voucher.create({
    data: {
      operator: "Indosat",
      nominal: "10.000",
      costPrice: 10100,
      sellingPrice: 12000,
      stock: 40,
      minStock: 10,
      movements: {
        create: {
          type: "INITIAL_STOCK",
          quantity: 40,
          previousStock: 0,
          newStock: 40,
          notes: "Stok awal voucher Indosat 10K",
        },
      },
    },
  });

  const voucherXL25 = await prisma.voucher.create({
    data: {
      operator: "XL",
      nominal: "25.000",
      costPrice: 24800,
      sellingPrice: 27000,
      stock: 30,
      minStock: 10,
      movements: {
        create: {
          type: "INITIAL_STOCK",
          quantity: 30,
          previousStock: 0,
          newStock: 30,
          notes: "Stok awal voucher XL 25K",
        },
      },
    },
  });

  // 6. Digital Products (Pulsa, PLN, Game, Data - no physical stock)
  await prisma.digitalProduct.createMany({
    data: [
      {
        category: "PULSA",
        provider: "Telkomsel",
        name: "Pulsa Telkomsel 10.000",
        nominal: 10000,
        costPrice: 10150,
        sellingPrice: 12000,
      },
      {
        category: "PULSA",
        provider: "Indosat",
        name: "Pulsa Indosat 15.000",
        nominal: 15000,
        costPrice: 15100,
        sellingPrice: 17000,
      },
      {
        category: "PLN",
        provider: "PLN",
        name: "Token Listrik PLN 50.000",
        nominal: 50000,
        costPrice: 50500,
        sellingPrice: 52500,
      },
      {
        category: "GAME",
        provider: "Mobile Legends",
        name: "86 Diamonds Mobile Legends",
        nominal: 20000,
        costPrice: 19500,
        sellingPrice: 23000,
      },
      {
        category: "DATA",
        provider: "Tri",
        name: "Paket Data Tri AlwaysOn 6GB",
        nominal: 35000,
        costPrice: 34000,
        sellingPrice: 38000,
      },
    ],
  });

  // 7. Store Settings
  try {
    await (prisma as any).storeSetting.upsert({
      where: { id: "default_store_setting" },
      update: {},
      create: {
        id: "default_store_setting",
        name: "CHICHA MOBILE",
        tagline: "Pusat Aksesoris & Pulsa",
        address: "Jl. Toko ChiCha Mobile",
        phone: "0812-3456-7890",
        receiptFooter: "Barang yang dibeli tidak dapat ditukar/dikembalikan. Terima kasih!",
        printCopies: 1,
        paperWidth: "58mm",
        autoPrint: false,
      },
    });
  } catch (err) {
    console.warn("Could not seed storeSetting:", err);
  }

  console.log("Seeding complete successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
