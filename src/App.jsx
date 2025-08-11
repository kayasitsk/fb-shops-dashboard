import React, { useMemo, useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Checkbox } from "@/components/ui/checkbox.jsx";
import Papa from "papaparse";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs.jsx";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
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
      roi: parseFloat(r.roi) || (parseFloat(r.adspend) > 0 ? (parseFloat(r.sales) || 0) / parseFloat(r.adspend) : 0),
    }))
    .filter((x) => x.date && !isNaN(x.date))
    .sort((a, b) => a.date - b.date);
}

export default function App() {
  const [tab, setTab] = useState("overview");
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
    Papa.parse(sampleCSV, { header: true, skipEmptyLines: true, complete: (res) => setRaw(parseRows(res.data)) });
  }, []);

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

  const kpis = useMemo(() => {
    const totalSales = filtered.reduce((s, d) => s + d.sales, 0);
    const totalAd = filtered.reduce((s, d) => s + d.adspend, 0);
    const totalOrders = filtered.reduce((s, d) => s + d.orders, 0);
    const roi = totalAd > 0 ? totalSales / totalAd : 0;
    return { totalSales, totalAd, totalOrders, roi };
  }, [filtered]);

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

  const formatTHB = (n) => n?.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const formatPct = (x) => (x === null || x === undefined ? "-" : `${x >= 0 ? "+" : ""}${x.toFixed(2)}%`);

  const handleFetchFromUrl = async () => {
    try {
      const res = await fetch(csvUrl);
      const text = await res.text();
      Papa.parse(text, { header: true, skipEmptyLines: true, complete: (res) => setRaw(parseRows(res.data)) });
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
    <div className="container">
      <div className="spread mb-6">
        <div>
          <h1 className="title">FB Shops Performance Dashboard</h1>
          <div className="sub">Daily sales • Ad spend • ROI • Orders — per shop & overall</div>
        </div>
        <div className="hstack">
          <Input placeholder="https://.../pub?output=csv" value={csvUrl} onChange={(e) => setCsvUrl(e.target.value)} />
          <Button onClick={handleFetchFromUrl}>Refresh from URL</Button>
        </div>
      </div>

      <Card className="mb-6"><CardContent>
        <div className="grid grid-4">
          <div><div className="k-title">Total Sales</div><div className="k-value">฿{formatTHB(kpis.totalSales)}</div></div>
          <div><div className="k-title">Ad Spend</div><div className="k-value">฿{formatTHB(kpis.totalAd)}</div></div>
          <div><div className="k-title">ROI</div><div className="k-value">{(kpis.roi || 0).toFixed(2)}x</div></div>
          <div><div className="k-title">Orders</div><div className="k-value">{formatTHB(kpis.totalOrders)}</div></div>
        </div>
      </CardContent></Card>

      <Card className="mb-6 filters"><CardContent>
        <div className="grid" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
          <div>
            <div className="label">From date</div>
            <Input type="date" onChange={(e)=>setFrom(e.target.value?new Date(e.target.value):null)} />
          </div>
          <div>
            <div className="label">To date</div>
            <Input type="date" onChange={(e)=>setTo(e.target.value?new Date(e.target.value):null)} />
          </div>
          <div>
            <div className="label">Stores</div>
            <div className="hstack" style={{flexWrap:'wrap'}}>
              {stores.map(s=>(
                <label key={s} className="hstack">
                  <Checkbox checked={selectedStores.has(s)} onChange={()=>toggleStore(s)} />
                  <span>{s}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4"><Button onClick={()=>{setFrom(null);setTo(null);setSelectedStores(new Set())}}>Clear filters</Button></div>
      </CardContent></Card>

      <Tabs value={tab} onChange={setTab}>
        <TabsList value={tab} onChange={setTab}>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="by-store">By Store</TabsTrigger>
          <TabsTrigger value="table">Table</TabsTrigger>
        </TabsList>

        <TabsContent when="overview" value={tab}>
          <div className="space-y-6 mt-4">
            <Card><CardContent>
              <h3 className="section-title">Daily Sales vs Ad Spend</h3>
              <div style={{height:320}}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={filtered}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dateKey" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="sales" name="Sales" />
                    <Line type="monotone" dataKey="adspend" name="Ad Spend" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent></Card>

            <Card><CardContent>
              <h3 className="section-title">Total by Store</h3>
              <table className="table mb-6">
                <thead><tr>
                  <th>Store</th><th>Sales</th><th>Ad Spend</th><th>ROI</th>
                </tr></thead>
                <tbody>
                  {tableTotal.map((r,i)=>(
                    <tr key={i}>
                      <td>{r.store}</td>
                      <td>฿{formatTHB(r.sales)}</td>
                      <td>฿{formatTHB(r.adspend)}</td>
                      <td>{(r.roi||0).toFixed(2)}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h3 className="section-title">Daily Summary</h3>
              <table className="table">
                <thead><tr>
                  <th>Date</th><th>Ad Spend</th><th>Sales</th><th>ROI</th><th>+/- %</th><th>Profit %</th><th>Net Profit</th>
                </tr></thead>
                <tbody>
                  {dailySummary.map((d,i)=>(
                    <tr key={i}>
                      <td>{d.date}</td>
                      <td>฿{formatTHB(d.adspend)}</td>
                      <td>฿{formatTHB(d.sales)}</td>
                      <td>{(d.roi||0).toFixed(2)}x</td>
                      <td>{formatPct(d.changePct)}</td>
                      <td>{(d.profitPct||0).toFixed(2)}%</td>
                      <td>฿{formatTHB(d.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent when="by-store" value={tab}>
          <div className="space-y-8 mt-4">
            {displayedStores.map((store)=>(
              <Card key={store}><CardContent>
                <h2 className="section-title">{store}</h2>
                <div style={{height:300}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dataByStore[store]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="dateKey" />
                      <YAxis yAxisId="left" orientation="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="sales" name="Sales" />
                      <Line yAxisId="right" type="monotone" dataKey="roi" name="ROI" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent></Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent when="table" value={tab}>
          <div className="space-y-8 mt-4">
            <Card><CardContent>
              <h3 className="section-title">Total by Store</h3>
              <table className="table mb-6">
                <thead><tr>
                  <th>Store</th><th>Sales</th><th>Ad Spend</th><th>ROI</th><th>Orders</th>
                </tr></thead>
                <tbody>
                  {tableTotal.map((r,i)=>(
                    <tr key={i}>
                      <td>{r.store}</td>
                      <td>฿{formatTHB(r.sales)}</td>
                      <td>฿{formatTHB(r.adspend)}</td>
                      <td>{(r.roi||0).toFixed(2)}x</td>
                      <td>{r.orders||"-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {displayedStores.map((store)=>(
                <div key={store} className="mb-8">
                  <h4 className="section-title">{store} Daily Records</h4>
                  <table className="table">
                    <thead><tr>
                      <th>Date</th><th>Sales</th><th>Ad Spend</th><th>ROI</th>
                    </tr></thead>
                    <tbody>
                      {dataByStore[store]?.map((r,i)=>(
                        <tr key={i}>
                          <td>{r.dateKey}</td>
                          <td>฿{formatTHB(r.sales)}</td>
                          <td>฿{formatTHB(r.adspend)}</td>
                          <td>{(r.roi||0).toFixed(2)}x</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>

      <div className="footer">Tip: In Google Sheets, use File → Share → Publish to web → CSV and paste the URL above for one-click refresh.</div>
    </div>
  );
}
