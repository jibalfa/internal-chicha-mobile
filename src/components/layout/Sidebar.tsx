"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  History,
  Ticket,
  SmartphoneNfc,
  Package,
  Users,
  BarChart3,
  TrendingUp,
  Receipt,
  UserCog,
  Settings2,
  X,
  Smartphone,
} from "lucide-react";
import { AuthSession } from "@/types";

interface SidebarProps {
  user: AuthSession | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ user, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const role = user?.role || "CASHIER";

  const navItems = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      roles: ["OWNER", "CASHIER"],
    },
    {
      title: "Kasir (POS)",
      href: "/pos",
      icon: ShoppingCart,
      roles: ["OWNER", "CASHIER"],
    },
    {
      title: "Riwayat Transaksi",
      href: "/transactions",
      icon: History,
      roles: ["OWNER", "CASHIER"],
    },
    {
      title: "Voucher HP",
      href: "/vouchers",
      icon: Ticket,
      roles: ["OWNER", "CASHIER"],
    },
    {
      title: "Produk Digital",
      href: "/digital",
      icon: SmartphoneNfc,
      roles: ["OWNER", "CASHIER"],
    },
    {
      title: "Aksesoris & Produk",
      href: "/products",
      icon: Package,
      roles: ["OWNER", "CASHIER"],
    },
    {
      title: "Mutasi Inventaris",
      href: "/inventory",
      icon: Package,
      roles: ["OWNER", "CASHIER"],
    },
    {
      title: "Pengeluaran",
      href: "/expenses",
      icon: Receipt,
      roles: ["OWNER"],
    },
    {
      title: "Laporan & Laba Rugi",
      href: "/reports",
      icon: BarChart3,
      roles: ["OWNER"],
    },
    {
      title: "Analisis Bisnis",
      href: "/analytics",
      icon: TrendingUp,
      roles: ["OWNER"],
    },
    {
      title: "Kelola Pengguna",
      href: "/users",
      icon: UserCog,
      roles: ["OWNER"],
    },
    {
      title: "Pengaturan Toko",
      href: "/settings",
      icon: Settings2,
      roles: ["OWNER"],
    },
  ];

  const filteredNav = navItems.filter((item) => item.roles.includes(role));

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-white text-base tracking-wide">ChiCha Mobile</span>
              <span className="block text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                Management System
              </span>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {filteredNav.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-semibold"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/80"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </div>

        {/* Role Status Tag */}
        <div className="p-3 border-t border-slate-800">
          <div className="bg-slate-800/60 rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold uppercase">
              {role[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.name || "Pengguna"}</p>
              <p className="text-[11px] text-indigo-400 font-medium uppercase tracking-wider">
                {role === "OWNER" ? "👑 Owner" : "🛒 Kasir"}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
