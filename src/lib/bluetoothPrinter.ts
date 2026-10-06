/**
 * Universal Thermal ESC/POS Printer Manager for ChiCha Mobile POS
 * Supports:
 * 1. Web Serial API (Bluetooth Serial / Virtual COM Port / USB Thermal) - Highly recommended on Windows PC/Laptop
 * 2. Web Bluetooth API (Bluetooth Low Energy / BLE GATT) - Recommended on Android/Mobile & BLE Printers
 * 3. Browser Print fallback
 */

// Common Bluetooth GATT Service UUIDs for Thermal Printers
export const THERMAL_PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "0000ae00-0000-1000-8000-00805f9b34fb",
  "0000fff0-0000-1000-8000-00805f9b34fb",
  "0000ff02-0000-1000-8000-00805f9b34fb",
  "0000fee7-0000-1000-8000-00805f9b34fb",
];

// ESC/POS Commands
export const ESC = 0x1b;
export const GS = 0x1d;

export class ESCPOSBuilder {
  private buffer: number[] = [];
  private width: number = 32; // 58mm = 32 cols, 80mm = 48 cols

  constructor(paperWidth: "58mm" | "80mm" = "58mm") {
    this.width = paperWidth === "80mm" ? 48 : 32;
    this.init();
  }

  init(): this {
    this.buffer.push(ESC, 0x40); // ESC @ Initialize
    return this;
  }

  alignCenter(): this {
    this.buffer.push(ESC, 0x61, 0x01);
    return this;
  }

  alignLeft(): this {
    this.buffer.push(ESC, 0x61, 0x00);
    return this;
  }

  alignRight(): this {
    this.buffer.push(ESC, 0x61, 0x02);
    return this;
  }

  bold(enable: boolean = true): this {
    this.buffer.push(ESC, 0x45, enable ? 0x01 : 0x00);
    return this;
  }

  doubleHeight(enable: boolean = true): this {
    this.buffer.push(GS, 0x21, enable ? 0x10 : 0x00);
    return this;
  }

  doubleSize(enable: boolean = true): this {
    this.buffer.push(GS, 0x21, enable ? 0x11 : 0x00);
    return this;
  }

  line(text: string = ""): this {
    const bytes = new TextEncoder().encode(text + "\n");
    for (let i = 0; i < bytes.length; i++) {
      this.buffer.push(bytes[i]);
    }
    return this;
  }

  divider(char: string = "-"): this {
    return this.line(char.repeat(this.width));
  }

  doubleDivider(): this {
    return this.line("=".repeat(this.width));
  }

  twoColumns(leftText: string, rightText: string): this {
    const spaceCount = this.width - leftText.length - rightText.length;
    if (spaceCount > 0) {
      this.line(leftText + " ".repeat(spaceCount) + rightText);
    } else {
      this.line(leftText);
      this.alignRight().line(rightText).alignLeft();
    }
    return this;
  }

  feed(lines: number = 3): this {
    this.buffer.push(ESC, 0x64, lines);
    return this;
  }

  cut(): this {
    this.buffer.push(GS, 0x56, 0x41, 0x00);
    return this;
  }

  getBuffer(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

export interface PrintSaleData {
  invoiceNumber: string;
  createdAt: string | Date;
  cashierName?: string;
  customerName?: string;
  paymentMethod: string;
  totalAmount: number;
  discount: number;
  finalAmount: number;
  cashGiven: number;
  changeGiven: number;
  items: Array<{
    itemName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
}

export function formatRupiahSimple(num: number): string {
  return (num || 0).toLocaleString("id-ID");
}

export interface ReceiptStoreInfo {
  name?: string | null;
  tagline?: string | null;
  address?: string | null;
  phone?: string | null;
  receiptFooter?: string | null;
}

export function buildSaleReceiptBuffer(
  data: PrintSaleData,
  paperWidth: "58mm" | "80mm" = "58mm",
  storeInfo?: ReceiptStoreInfo
): Uint8Array {
  const builder = new ESCPOSBuilder(paperWidth);

  let storeName = storeInfo?.name;
  let storeTagline = storeInfo?.tagline;
  let storeAddress = storeInfo?.address;
  let storePhone = storeInfo?.phone;
  let receiptFooter = storeInfo?.receiptFooter;

  if (typeof window !== "undefined") {
    if (!storeName) storeName = localStorage.getItem("chicha_store_name") || "CHICHA MOBILE";
    if (storeTagline === undefined || storeTagline === null) {
      storeTagline = localStorage.getItem("chicha_store_tagline") || "";
    }
    if (storeAddress === undefined || storeAddress === null) {
      storeAddress = localStorage.getItem("chicha_store_address") || "";
    }
    if (storePhone === undefined || storePhone === null) {
      storePhone = localStorage.getItem("chicha_store_phone") || "";
    }
    if (receiptFooter === undefined || receiptFooter === null) {
      receiptFooter = localStorage.getItem("chicha_store_footer") || "Barang yang dibeli tidak dapat ditukar/dikembalikan.\nTerima kasih atas kunjungan Anda!";
    }
  } else {
    if (!storeName) storeName = "CHICHA MOBILE";
  }

  const dateStr = new Date(data.createdAt).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeStr = new Date(data.createdAt).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // 1. Header
  builder
    .alignCenter()
    .bold(true)
    .doubleSize(true)
    .line((storeName || "CHICHA MOBILE").toUpperCase())
    .doubleSize(false)
    .bold(false);

  if (storeTagline && storeTagline.trim()) {
    builder.line(storeTagline.trim());
  }
  if (storeAddress && storeAddress.trim()) {
    builder.line(storeAddress.trim());
  }
  if (storePhone && storePhone.trim()) {
    builder.line(`Telp/WA: ${storePhone.trim()}`);
  }
  builder.doubleDivider();

  // 2. Transaction Info
  builder
    .alignLeft()
    .twoColumns("No. Faktur", data.invoiceNumber)
    .twoColumns("Waktu", `${dateStr} ${timeStr}`)
    .twoColumns("Kasir", data.cashierName || "Kasir")
    .divider();

  // 3. Items
  data.items.forEach((item) => {
    builder.line(item.itemName);
    const qtyPrice = `  ${item.quantity} x ${formatRupiahSimple(item.unitPrice)}`;
    const subtotalStr = formatRupiahSimple(item.subtotal);
    builder.twoColumns(qtyPrice, subtotalStr);
  });

  builder.divider();

  // 4. Totals
  builder.twoColumns("Subtotal", formatRupiahSimple(data.totalAmount));
  if (data.discount > 0) {
    builder.twoColumns("Diskon", `-${formatRupiahSimple(data.discount)}`);
  }

  builder
    .bold(true)
    .twoColumns("TOTAL BAYAR", `Rp ${formatRupiahSimple(data.finalAmount)}`)
    .bold(false);

  builder
    .twoColumns("Metode Bayar", data.paymentMethod)
    .twoColumns("Uang Diterima", formatRupiahSimple(data.cashGiven));

  if (data.paymentMethod === "CASH") {
    builder
      .bold(true)
      .twoColumns("Kembalian", `Rp ${formatRupiahSimple(data.changeGiven)}`)
      .bold(false);
  }

  // 5. Footer
  builder.doubleDivider().alignCenter();
  if (receiptFooter && receiptFooter.trim()) {
    const footerLines = receiptFooter.trim().split("\n");
    footerLines.forEach((lineText) => {
      builder.line(lineText.trim());
    });
  } else {
    builder
      .bold(true)
      .line("TERIMA KASIH")
      .bold(false)
      .line("Barang yang dibeli tidak dapat")
      .line("ditukar/dikembalikan.");
  }

  builder.feed(3).cut();

  return builder.getBuffer();
}

export type PrinterConnectionType = "SERIAL" | "BLUETOOTH" | "NONE";

/**
 * Universal Thermal Printer Manager with Web Serial (Bluetooth COM / USB) & Web Bluetooth (BLE)
 */
export class UniversalPrinterManager {
  private static instance: UniversalPrinterManager;

  // Connection mode
  private connectionType: PrinterConnectionType = "NONE";

  // Web Bluetooth state
  private btDevice: any = null;
  private btCharacteristic: any = null;

  // Web Serial state (Bluetooth COM Port / USB Serial)
  private serialPort: any = null;

  private isConnecting: boolean = false;

  private constructor() {}

  public static getInstance(): UniversalPrinterManager {
    if (!UniversalPrinterManager.instance) {
      UniversalPrinterManager.instance = new UniversalPrinterManager();
    }
    return UniversalPrinterManager.instance;
  }

  public isBluetoothSupported(): boolean {
    return typeof window !== "undefined" && "bluetooth" in navigator;
  }

  public isSerialSupported(): boolean {
    return typeof window !== "undefined" && "serial" in navigator;
  }

  public isConnected(): boolean {
    if (this.connectionType === "SERIAL") {
      return !!(this.serialPort && this.serialPort.readable && this.serialPort.writable);
    }
    if (this.connectionType === "BLUETOOTH") {
      return !!(this.btDevice && this.btDevice.gatt && this.btDevice.gatt.connected && this.btCharacteristic);
    }
    return false;
  }

  public getConnectionType(): PrinterConnectionType {
    return this.connectionType;
  }

  public getConnectedDeviceName(): string | null {
    if (!this.isConnected()) return null;
    if (this.connectionType === "SERIAL") {
      return localStorage.getItem("chicha_serial_printer_name") || "Bluetooth Serial Printer";
    }
    if (this.connectionType === "BLUETOOTH") {
      return this.btDevice?.name || "Bluetooth Thermal Printer";
    }
    return null;
  }

  public getSavedPrinterInfo(): { type: PrinterConnectionType; name: string } | null {
    if (typeof window === "undefined") return null;
    const savedType = localStorage.getItem("chicha_printer_type") as PrinterConnectionType;
    if (savedType === "SERIAL") {
      const name = localStorage.getItem("chicha_serial_printer_name") || "Bluetooth Serial Port";
      return { type: "SERIAL", name };
    }
    if (savedType === "BLUETOOTH") {
      const name = localStorage.getItem("chicha_bt_printer_name") || "Bluetooth BLE Printer";
      return { type: "BLUETOOTH", name };
    }
    return null;
  }

  /**
   * Auto-connect on page mount if previously connected (CUKUP SEKALI)
   */
  public async tryAutoConnect(): Promise<{ success: boolean; deviceName?: string; type?: PrinterConnectionType }> {
    if (this.isConnected()) {
      return {
        success: true,
        deviceName: this.getConnectedDeviceName() || "Thermal Printer",
        type: this.connectionType,
      };
    }

    // Try Web Serial auto-connect
    if (this.isSerialSupported()) {
      try {
        const nav: any = navigator;
        const ports = await nav.serial.getPorts();
        if (ports && ports.length > 0) {
          const port = ports[0];
          await port.open({ baudRate: 9600 });
          this.serialPort = port;
          this.connectionType = "SERIAL";
          const name = localStorage.getItem("chicha_serial_printer_name") || "Printer Thermal (Serial/BT)";
          return { success: true, deviceName: name, type: "SERIAL" };
        }
      } catch (e) {
        console.warn("Serial auto-connect attempt:", e);
      }
    }

    // Try Web Bluetooth auto-connect
    if (this.isBluetoothSupported() && this.btDevice) {
      try {
        await this.setupBluetoothGatt(this.btDevice);
        this.connectionType = "BLUETOOTH";
        return { success: true, deviceName: this.btDevice.name || "Bluetooth Printer", type: "BLUETOOTH" };
      } catch (e) {
        console.warn("Bluetooth auto-connect attempt:", e);
      }
    }

    return { success: false };
  }

  /**
   * Connect via Web Serial (Bluetooth Outgoing COM Port / USB) - Solves Windows GATT failure 100%
   */
  public async connectSerial(customName?: string): Promise<{ success: boolean; deviceName?: string; error?: string }> {
    if (!this.isSerialSupported()) {
      return {
        success: false,
        error: "Browser Anda tidak mendukung Web Serial API. Gunakan Google Chrome atau Microsoft Edge terbaru di Windows/PC.",
      };
    }

    try {
      this.isConnecting = true;
      const nav: any = navigator;

      const port = await nav.serial.requestPort();
      if (!port) {
        throw new Error("Tidak ada port printer yang dipilih.");
      }

      // Close if already open
      try {
        await port.open({ baudRate: 9600 });
      } catch (openErr: any) {
        if (!openErr.message?.includes("already open")) {
          // Try 115200 or 38400
          try {
            await port.open({ baudRate: 115200 });
          } catch (e) {
            throw openErr;
          }
        }
      }

      this.serialPort = port;
      this.connectionType = "SERIAL";
      const devName = customName || "Bluetooth Thermal Printer (COM/Serial)";

      if (typeof window !== "undefined") {
        localStorage.setItem("chicha_printer_type", "SERIAL");
        localStorage.setItem("chicha_serial_printer_name", devName);
      }

      return { success: true, deviceName: devName };
    } catch (err: any) {
      console.error("Serial Connect Error:", err);
      if (err.name === "NotFoundError" || err.message?.includes("No port selected") || err.message?.includes("User cancelled")) {
        return { success: false, error: "Pemilihan port printer dibatalkan." };
      }
      return {
        success: false,
        error: `Gagal membuka port serial: ${err.message || "Pastikan printer sudah ter-pairing di Windows Bluetooth."}`,
      };
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Connect via Web Bluetooth BLE (For Mobile / BLE Thermal Printers)
   */
  public async connectBluetooth(): Promise<{ success: boolean; deviceName?: string; error?: string }> {
    if (!this.isBluetoothSupported()) {
      return {
        success: false,
        error: "Browser Anda tidak mendukung Web Bluetooth. Gunakan Google Chrome atau Edge.",
      };
    }

    try {
      this.isConnecting = true;
      const nav: any = navigator;

      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: THERMAL_PRINTER_SERVICES,
      });

      if (!device) {
        throw new Error("Tidak ada printer bluetooth yang dipilih.");
      }

      this.btDevice = device;
      const deviceName = device.name || "Bluetooth Thermal Printer";

      device.addEventListener("gattserverdisconnected", () => {
        console.warn("Bluetooth printer disconnected");
        this.btCharacteristic = null;
      });

      await this.setupBluetoothGatt(device);
      this.connectionType = "BLUETOOTH";

      if (typeof window !== "undefined") {
        localStorage.setItem("chicha_printer_type", "BLUETOOTH");
        localStorage.setItem("chicha_bt_printer_name", deviceName);
        localStorage.setItem("chicha_bt_printer_id", device.id);
      }

      return { success: true, deviceName };
    } catch (err: any) {
      console.error("Web Bluetooth Connect Error:", err);
      if (err.name === "NotFoundError" || err.message?.includes("User cancelled")) {
        return { success: false, error: "Pemilihan printer bluetooth dibatalkan." };
      }

      if (err.message?.includes("Connection attempt failed") || err.name === "NetworkError") {
        return {
          success: false,
          error:
            "Koneksi BLE gagal (Printer menggunakan Bluetooth Classic). Untuk Windows/PC, silakan gunakan tombol 'Koneksi Serial / Bluetooth COM' yang 100% stabil.",
        };
      }

      return { success: false, error: err.message || "Gagal menghubungkan printer bluetooth." };
    } finally {
      this.isConnecting = false;
    }
  }

  private async setupBluetoothGatt(device: any): Promise<void> {
    const server = await device.gatt.connect();
    let writableChar: any = null;

    for (const serviceUuid of THERMAL_PRINTER_SERVICES) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        const characteristics = await service.getCharacteristics();
        for (const char of characteristics) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            writableChar = char;
            break;
          }
        }
        if (writableChar) break;
      } catch (e) {}
    }

    if (!writableChar) {
      try {
        const services = await server.getPrimaryServices();
        for (const service of services) {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              writableChar = char;
              break;
            }
          }
          if (writableChar) break;
        }
      } catch (e) {}
    }

    if (!writableChar) {
      throw new Error("Karakteristik penulisan ESC/POS tidak ditemukan pada printer bluetooth ini.");
    }

    this.btCharacteristic = writableChar;
  }

  /**
   * Disconnect any active printer
   */
  public async disconnect(): Promise<void> {
    if (this.connectionType === "SERIAL" && this.serialPort) {
      try {
        await this.serialPort.close();
      } catch (e) {}
      this.serialPort = null;
    }

    if (this.connectionType === "BLUETOOTH" && this.btDevice && this.btDevice.gatt) {
      try {
        this.btDevice.gatt.disconnect();
      } catch (e) {}
      this.btDevice = null;
      this.btCharacteristic = null;
    }

    this.connectionType = "NONE";
  }

  /**
   * Send ESC/POS binary data to connected printer
   */
  public async print(data: Uint8Array): Promise<{ success: boolean; error?: string }> {
    if (!this.isConnected()) {
      const auto = await this.tryAutoConnect();
      if (!auto.success) {
        return {
          success: false,
          error: "Printer belum terhubung. Silakan klik tombol 'Hubungkan Printer' di atas.",
        };
      }
    }

    // 1. Print via Web Serial (Bluetooth COM / USB)
    if (this.connectionType === "SERIAL" && this.serialPort) {
      try {
        const writer = this.serialPort.writable.getWriter();
        await writer.write(data);
        writer.releaseLock();
        return { success: true };
      } catch (err: any) {
        console.error("Serial Print Error:", err);
        return { success: false, error: "Gagal mengirim data cetak ke Serial Port: " + err.message };
      }
    }

    // 2. Print via Web Bluetooth (BLE)
    if (this.connectionType === "BLUETOOTH" && this.btCharacteristic) {
      try {
        const CHUNK_SIZE = 100;
        for (let i = 0; i < data.length; i += CHUNK_SIZE) {
          const chunk = data.slice(i, i + CHUNK_SIZE);
          if (this.btCharacteristic.writeValueWithoutResponse) {
            await this.btCharacteristic.writeValueWithoutResponse(chunk);
          } else {
            await this.btCharacteristic.writeValue(chunk);
          }
          await new Promise((r) => setTimeout(r, 25));
        }
        return { success: true };
      } catch (err: any) {
        console.error("Bluetooth Print Error:", err);
        return { success: false, error: "Gagal mengirim data cetak ke Bluetooth: " + err.message };
      }
    }

    return { success: false, error: "Koneksi printer tidak aktif." };
  }

  /**
   * Print test receipt
   */
  public async printTest(): Promise<{ success: boolean; error?: string }> {
    const builder = new ESCPOSBuilder("58mm");
    builder
      .alignCenter()
      .bold(true)
      .line("TEST PRINTER THERMAL")
      .line("CHICHA MOBILE POS")
      .bold(false)
      .divider()
      .line("Koneksi Berhasil & Siap Cetak!")
      .line(new Date().toLocaleString("id-ID"))
      .divider()
      .feed(2)
      .cut();

    return await this.print(builder.getBuffer());
  }
}

export const printerManager = UniversalPrinterManager.getInstance();
export const bluetoothPrinter = printerManager; // Backwards compatibility
