import React, { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Papa from "papaparse";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

function parseRows(rows) {
  return rows
    .map((r) => ({
      date: new Date(r.date),
      dateKey: r.date,
      store: r.store,
      sales: parseFloat(r.sales) || 0,
      adspend: parseFloat(r.adspend) || 0,
      orders: parseFloat(r.orders) || 0,
      roi:
        parseFloat(r.roi) || (parseFloat(r.adspend) > 0 ? (parseFloat(r.sales) || 0) / parseFloat(r.adspend) : 0),
    }))
    .filter((x) => x.date && !isNaN(x.date))
    .sort((a, b) => a.date - b.date);
}

export default function Dashboard() {
  const [raw, setRaw] = useState([]);
  const [csvUrl, setCsvUrl] = useState("");
  const [selectedStores, setSelectedStores] = useState(new Set());
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);

  useEffect(() => {
    const sampleCSV = `date,store,sales,adspend,orders,roi
2025-07-25,Magic Box,12500,4000,78,3.12
2025-07-26,Magic Box,9800,3500,60,2.8
2025-07-27,Magic Box,14500,4200,90,3.45
2025-07-25,Tee-Pop,16700,5000,88,3.34
2025-07-26,Tee-Pop,12000,3700,70,3.24
2025-07-27,Tee-Pop,18200,5200,95,3.5`;
    Papa.parse(sampleCSV, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => setRaw(parseRows(res.data)),
    });
  }, []);

  // ===== Filters =====
  const filtered = useMemo(() => {
    return raw.filter((d) => {
      const dateOk = (!from || d.date >= from) && (!to || d.date <= to);
      const storeOk = selectedStores.size === 0 || selectedStores.has(d.store);
      return dateOk && storeOk;
    });
  }, [raw, from, to, selectedStores]);

  const stores = useMemo(() => [...new Set(raw.map((d) => d.store))], [raw]);
  const displayedStores = selectedStores.size ? [...selectedStores] : stores;

  const dataByStore = useMemo(() => {
    const map = {};
    for (const d of filtered) {
      if (!map[d.store]) map[d.store] = [];
      map[d.store].push(d);
    }
    return map;
  }, [filtered]);

  // ===== KPIs =====
  const kpis = useMemo(() => {
    const totalSales = filtered.reduce((s, d) => s + d.sales, 0);
    const totalAd = filtered.reduce((s, d) => s + d.adspend, 0);
    const totalOrders = filtered.reduce((s, d) => s + d.orders, 0);
    const roi = totalAd > 0 ? totalSales / totalAd : 0;
    return { totalSales, totalAd, totalOrders, roi };
  }, [filtered]);

  // ===== Tables =====
  const tableTotal = useMemo(() => {
    const totals = {};
    for (const row of filtered) {
      if (!totals[row.store]) totals[row.store] = { store: row.store, sales: 0, adspend: 0, orders: 0 };
      totals[row.store].sales += row.sales;
      totals[row.store].adspend += row.adspend;
      totals[row.store].orders += row.orders;
    }
    return Object.values(totals)
      .map((t) => ({ ...t, roi: t.adspend > 0 ? t.sales / t.adspend : 0 }))
      .sort((a, b) => b.sales - a.sales);
  }, [filtered]);

  const dailySummary = useMemo(() => {
    const byDate = new Map();
    for (const row of filtered) {
      const key = row.dateKey;
      if (!byDate.has(key)) byDate.set(key, { date: key, sales: 0, adspend: 0 });
      const agg = byDate.get(key);
      agg.sales += row.sales;
      agg.adspend += row.adspend;
    }
    const arr = [...byDate.values()].sort((a, b) => new Date(a.date) - new Date(b.date));
    // compute day-over-day +/- % on Sales
    for (let i = 0; i < arr.length; i++) {
      const prev = arr[i - 1];
      const cur = arr[i];
      const roi = cur.adspend > 0 ? cur.sales / cur.adspend : 0;
      const profit = cur.sales - cur.adspend;
      const profitPct = cur.sales > 0 ? (profit / cur.sales) * 100 : 0;
      const changePct = prev && prev.sales > 0 ? ((cur.sales - prev.sales) / prev.sales) * 100 : null;
      arr[i] = { ...cur, roi, profit, profitPct, changePct };
    }
    return arr;
  }, [filtered]);

  // ===== Helpers =====
  const formatTHB = (n) => n?.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const formatPct = (x) => (x === null || x === undefined ? "-" : `${x >= 0 ? "+" : ""}${x.toFixed(2)}%`);

  const handleFetchFromUrl = async () => {
    try {
      const res = await fetch(csvUrl);
      const text = await res.text();
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => setRaw(parseRows(res.data)),
      });
    } catch (e) {
      alert("Unable to fetch CSV. Make sure your Google Sheet is published as CSV.");
    }
  };

  const toggleStore = (store) => {
    const next = new Set(selectedStores);
    if (next.has(store)) next.delete(store);
    else next.add(store);
    setSelectedStores(next);
  };

  return (
    <div className="p-6 bg-gradient-to-b from-slate-50 to-white min-h-screen">
      {/* ===== Header ===== */}
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">FB Shops Performance Dashboard</h1>
          <p className="text-sm text-slate-500">Daily sales • Ad spend • ROI • Orders — per shop & overall</p>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="https://.../pub?output=csv" value={csvUrl} onChange={(e) => setCsvUrl(e.target.value)} className="w-[320px]"/>
          <Button onClick={handleFetchFromUrl}>Refresh from URL</Button>
        </div>
      </header>

      {/* ===== KPI Cards ===== */}
      <Card className="rounded-2xl shadow-sm mb-6 p-4">
        <div className="grid md:grid-cols-4 gap-4">
          <div><div className="text-slate-500 text-sm">Total Sales</div><div className="text-2xl font-semibold">฿{formatTHB(kpis.totalSales)}</div></div>
          <div><div className="text-slate-500 text-sm">Ad Spend</div><div className="text-2xl font-semibold">฿{formatTHB(kpis.totalAd)}</div></div>
          <div><div className="text-slate-500 text-sm">ROI</div><div className="text-2xl font-semibold">{(kpis.roi || 0).toFixed(2)}x</div></div>
          <div><div className="text-slate-500 text-sm">Orders</div><div className="text-2xl font-semibold">{formatTHB(kpis.totalOrders)}</div></div>
        </div>
      </Card>

      {/* ===== Filters ===== */}
      <Card className="rounded-2xl shadow-sm mb-6 p-4">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-slate-600 mb-1">From date</div>
            <Input type="date" onChange={(e) => setFrom(e.target.value ? new Date(e.target.value) : null)} />
          </div>
          <div>
            <div className="text-sm text-slate-600 mb-1">To date</div>
            <Input type="date" onChange={(e) => setTo(e.target.value ? new Date(e.target.value) : null)} />
          </div>
          <div>
            <div className="text-sm text-slate-600 mb-2">Stores</div>
            <div className="flex flex-wrap gap-4">
              {stores.map((store) => (
                <label key={store} className="flex items-center gap-2">
                  <Checkbox checked={selectedStores.has(store)} onCheckedChange={() => toggleStore(store)} />
                  <span>{store}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <Button variant="outline" className="mt-4" onClick={() => { setFrom(null); setTo(null); setSelectedStores(new Set()); }}>Clear filters</Button>
      </Card>

      {/* ===== Tabs ===== */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="by-store">By Store</TabsTrigger>
          <TabsTrigger value="table">Table</TabsTrigger>
        </TabsList>

        {/* ---- Overview ---- */}
        <TabsContent value="overview" className="mt-4 space-y-6">
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-4">
              <h3 className="font-medium mb-4">Daily Sales vs Ad Spend</h3>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={filtered}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dateKey" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="sales" name="Sales" stroke="#3b82f6" />
                    <Line type="monotone" dataKey="adspend" name="Ad Spend" stroke="#10b981" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Overview: Tables under graph */}
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-4 overflow-auto">
              <h3 className="font-medium mb-4">Total by Store</h3>
              <table className="w-full text-sm mb-6">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th>Store</th>
                    <th>Sales</th>
                    <th>Ad Spend</th>
                    <th>ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {tableTotal.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td>{r.store}</td>
                      <td>฿{formatTHB(r.sales)}</td>
                      <td>฿{formatTHB(r.adspend)}</td>
                      <td>{(r.roi || 0).toFixed(2)}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3 className="font-medium mb-4">Daily Summary</h3>
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th>Date</th>
                    <th>Ad Spend</th>
                    <th>Sales</th>
                    <th>ROI</th>
                    <th>+/- %</th>
                    <th>Profit %</th>
                    <th>Net Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {dailySummary.map((d, i) => (
                    <tr key={i} className="border-t">
                      <td>{d.date}</td>
                      <td>฿{formatTHB(d.adspend)}</td>
                      <td>฿{formatTHB(d.sales)}</td>
                      <td>{(d.roi || 0).toFixed(2)}x</td>
                      <td>{formatPct(d.changePct)}</td>
                      <td>{(d.profitPct || 0).toFixed(2)}%</td>
                      <td>฿{formatTHB(d.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- By Store: 1 chart per store ---- */}
        <TabsContent value="by-store" className="mt-4 space-y-8">
          {displayedStores.map((store) => (
            <Card key={store} className="rounded-2xl shadow-sm">
              <CardContent className="p-4">
                <h2 className="text-lg font-medium mb-4">{store}</h2>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dataByStore[store]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="dateKey" />
                      <YAxis yAxisId="left" orientation="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="sales" name="Sales" stroke="#3b82f6" />
                      <Line yAxisId="right" type="monotone" dataKey="roi" name="ROI" stroke="#f97316" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ---- Table tab ---- */}
        <TabsContent value="table" className="mt-4 space-y-8">
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-4 overflow-auto">
              <h3 className="font-medium mb-4">Total by Store</h3>
              <table className="w-full text-sm mb-6">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th>Store</th>
                    <th>Sales</th>
                    <th>Ad Spend</th>
                    <th>ROI</th>
                    <th>Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {tableTotal.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td>{r.store}</td>
                      <td>฿{formatTHB(r.sales)}</td>
                      <td>฿{formatTHB(r.adspend)}</td>
                      <td>{(r.roi || 0).toFixed(2)}x</td>
                      <td>{r.orders || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Per-store daily records tables */}
              {displayedStores.map((store) => (
                <div key={store} className="mb-8">
                  <h4 className="font-medium mb-2">{store} Daily Records</h4>
                  <table className="w-full text-sm">
                    <thead className="text-left text-slate-500">
                      <tr>
                        <th>Date</th>
                        <th>Sales</th>
                        <th>Ad Spend</th>
                        <th>ROI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataByStore[store]?.map((r, i) => (
                        <tr key={i} className="border-t">
                          <td>{r.dateKey}</td>
                          <td>฿{formatTHB(r.sales)}</td>
                          <td>฿{formatTHB(r.adspend)}</td>
                          <td>{(r.roi || 0).toFixed(2)}x</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <footer className="text-xs text-slate-400 text-center py-6">
        Tip: In Google Sheets, use File → Share → Publish to web → CSV and paste the URL above for one-click refresh.
      </footer>
    </div>
  );
}
