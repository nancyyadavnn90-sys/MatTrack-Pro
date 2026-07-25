import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { 
  FileText, Download, Printer, Filter, RefreshCw, 
  AlertTriangle, ArrowRight
} from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const getAuthHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

export default function OEEReports() {
  const [activeTab, setActiveTab] = useState('gate-pass');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  // Filters
  const [fromDate, setFromDate] = useState('2026-07-01');
  const [toDate, setToDate] = useState('2026-07-25');
  const [customerFilter, setCustomerFilter] = useState('All');
  const [searchBarcode, setSearchBarcode] = useState('BC-RM001-001');

  const reportRef = useRef();

  const fetchReport = async (tab) => {
    setLoading(true);
    try {
      let endpoint = `/reports/${tab}`;
      if (tab === 'traceability') {
        endpoint += `?barcode=${encodeURIComponent(searchBarcode)}`;
      }
      const res = await axios.get(`${API}${endpoint}`, getAuthHeader());
      setReportData(res.data);
    } catch (err) {
      console.error('Failed to load report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(activeTab);
  }, [activeTab]);

  const handleDownloadPDF = async () => {
    const element = reportRef.current;
    if (!element) return;
    try {
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`MatTrack_Report_${activeTab}_${Date.now()}.pdf`);
    } catch (err) {
      alert('Failed to generate PDF: ' + err.message);
    }
  };

  const handleDownloadExcel = () => {
    if (!reportData) return;
    let dataToExport = [];
    if (reportData.table) {
      dataToExport = reportData.table;
    } else if (Array.isArray(reportData)) {
      dataToExport = reportData;
    } else {
      dataToExport = [reportData];
    }

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report Data');
    XLSX.writeFile(workbook, `MatTrack_Report_${activeTab}_${Date.now()}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  const reportCategories = [
    {
      title: '📦 Inward Reports',
      items: [
        { id: 'gate-pass', name: 'Gate Pass Report' },
        { id: 'grn', name: 'GRN Report' }
      ]
    },
    {
      title: '🏭 Production Reports',
      items: [
        { id: 'production', name: 'Production Summary' },
        { id: 'machine-wise', name: 'Machine-wise Production' }
      ]
    },
    {
      title: '🔍 Quality Reports',
      items: [
        { id: 'inspection', name: 'Inspection Summary' },
        { id: 'defect-pareto', name: 'Rejection Pareto Report' }
      ]
    },
    {
      title: '📦 Inventory & Traceability',
      items: [
        { id: 'stock-position', name: 'Stock Position Report' },
        { id: 'traceability', name: 'Material Traceability (Lot)' }
      ]
    },
    {
      title: '🚚 Dispatch Reports',
      items: [
        { id: 'dispatch', name: 'Dispatch Summary' }
      ]
    },
    {
      title: '📈 Management Reports',
      items: [
        { id: 'daily-mis', name: 'Daily Production Report (MIS)' }
      ]
    }
  ];

  return (
    <div className="bg-[#121212] text-slate-200 min-h-screen p-6 font-sans space-y-6">
      
      {/* HEADER ROW */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2a2a2a] pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white tracking-wide">Reports Hub</h1>
            <p className="text-xs text-slate-400 font-medium">Generate, view, and export operational reports across all 12 modules</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleDownloadPDF}
            className="bg-[#1e1e1e] hover:bg-[#252525] text-slate-300 border border-[#3a3a3a] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-md"
          >
            <Download className="w-4 h-4 text-emerald-400" /> Download PDF
          </button>
          <button 
            onClick={handleDownloadExcel}
            className="bg-[#10b981] hover:bg-[#059669] text-white px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition shadow-md"
          >
            <Download className="w-4 h-4" /> Download Excel
          </button>
          <button 
            onClick={handlePrint}
            className="bg-[#1e1e1e] hover:bg-[#252525] text-slate-300 border border-[#3a3a3a] p-2 rounded-xl text-xs font-bold transition shadow-md"
            title="Print"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-[#1e1e1e] border border-[#2a2a2a] p-4 rounded-xl flex flex-wrap items-center gap-3 text-xs font-semibold shadow-md">
        <div className="flex items-center gap-2 text-slate-300 font-bold">
          <Filter className="w-4 h-4 text-emerald-400" /> Filters:
        </div>

        <div>
          <label className="text-[10px] text-slate-400 block">From Date</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bg-[#121212] border border-[#3a3a3a] rounded-lg px-2.5 py-1 text-white font-bold text-xs" />
        </div>

        <div>
          <label className="text-[10px] text-slate-400 block">To Date</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="bg-[#121212] border border-[#3a3a3a] rounded-lg px-2.5 py-1 text-white font-bold text-xs" />
        </div>

        <div>
          <label className="text-[10px] text-slate-400 block">Customer</label>
          <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className="bg-[#121212] border border-[#3a3a3a] text-white px-2.5 py-1 rounded-lg font-bold text-xs">
            <option value="All">All Customers</option>
            <option value="Honda">Honda HMSI</option>
            <option value="Hero">Hero MotoCorp</option>
            <option value="Yamaha">Yamaha Motors</option>
          </select>
        </div>

        {activeTab === 'traceability' && (
          <div className="flex items-end gap-2">
            <div>
              <label className="text-[10px] text-emerald-400 block font-bold">Barcode / Lot Number Search</label>
              <input type="text" value={searchBarcode} onChange={(e) => setSearchBarcode(e.target.value)} placeholder="BC-RM001-001" className="bg-[#121212] border border-[#3a3a3a] rounded-lg px-2.5 py-1 text-white font-bold font-mono text-xs" />
            </div>
            <button onClick={() => fetchReport('traceability')} className="bg-[#10b981] hover:bg-[#059669] text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md">Trace</button>
          </div>
        )}

        <button onClick={() => fetchReport(activeTab)} className="ml-auto bg-[#121212] hover:bg-[#252525] border border-[#3a3a3a] px-3 py-1.5 rounded-lg text-emerald-400 font-bold flex items-center gap-1">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* TWO COLUMNS: SIDEBAR CATEGORIES (25%) + REPORT DISPLAY AREA (75%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* SIDEBAR NAVIGATION */}
        <div className="lg:col-span-3 space-y-4">
          {reportCategories.map((cat, idx) => (
            <div key={idx} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-4 space-y-2 shadow-md">
              <h2 className="text-xs font-black uppercase text-slate-400 tracking-wider border-b border-[#2a2a2a] pb-2">{cat.title}</h2>
              <div className="space-y-1">
                {cat.items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition flex items-center justify-between ${
                      activeTab === item.id ? 'bg-[#10b981] text-white shadow-md' : 'text-slate-300 hover:bg-[#252525] hover:text-white'
                    }`}
                  >
                    <span>{item.name}</span>
                    <ArrowRight className="w-3.5 h-3.5 opacity-70" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* MAIN REPORT DISPLAY AREA */}
        <div className="lg:col-span-9">
          <div ref={reportRef} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-6 shadow-lg space-y-6 text-white">
            
            {/* PRINT & PDF BRANDING HEADER */}
            <div className="border-b border-[#2a2a2a] pb-4 flex justify-between items-center">
              <div>
                <h2 className="text-base font-black text-white">Jayashree Polymers (India) Pvt. Ltd.</h2>
                <p className="text-xs font-bold text-emerald-400 capitalize">{activeTab.replace('-', ' ')} Report</p>
                <p className="text-[10px] text-slate-400 font-medium">Date Range: {fromDate} to {toDate} | Generated by MatTrack Pro</p>
              </div>
              <div className="text-right font-mono text-[10px] text-slate-400">
                Plot No. 6, IMT Manesar, Gurugram
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-16"><RefreshCw className="w-8 h-8 animate-spin text-emerald-400" /></div>
            ) : (
              <div>

                {/* SPECIAL REPORT 6: DEFECT PARETO REPORT */}
                {activeTab === 'defect-pareto' && reportData && (
                  <div className="space-y-6">
                    <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl space-y-1">
                      <h3 className="text-xs font-black text-amber-400 uppercase flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-400" /> Pareto 80/20 Automated Insight
                      </h3>
                      <p className="text-xs text-slate-200 font-semibold">{reportData.insight}</p>
                    </div>

                    <div className="overflow-x-auto border border-[#2a2a2a] rounded-xl">
                      <table className="w-full text-left text-xs font-semibold text-slate-200">
                        <thead className="bg-[#252525] text-xs text-slate-200 uppercase font-black border-b border-[#333]">
                          <tr>
                            <th className="py-3 px-4">DEFECT TYPE</th>
                            <th className="py-3 px-4">INCIDENT COUNT</th>
                            <th className="py-3 px-4 text-red-400">REJECTED QTY</th>
                            <th className="py-3 px-4">% OF TOTAL</th>
                            <th className="py-3 px-4 text-emerald-400">CUMULATIVE %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2a2a2a]">
                          {reportData.table?.map((row, idx) => (
                            <tr key={idx} className="hover:bg-[#252525] border-b border-[#2a2a2a] transition">
                              <td className="py-3 px-4 font-black text-white">{row.defect_type}</td>
                              <td className="py-3 px-4 text-slate-300 font-mono">{row.count}</td>
                              <td className="py-3 px-4 text-red-400 font-bold">{row.qty}</td>
                              <td className="py-3 px-4 text-slate-300 font-bold">{row.pct}</td>
                              <td className="py-3 px-4 text-emerald-400 font-black">{row.cumulative_pct}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* SPECIAL REPORT 7: MATERIAL TRACEABILITY REPORT */}
                {activeTab === 'traceability' && reportData && (
                  <div className="space-y-6">
                    <div className="bg-[#121212] border border-[#2a2a2a] p-4 rounded-xl space-y-1">
                      <p className="text-[10px] font-black uppercase text-slate-400">{reportData.type}</p>
                      <p className="text-xs font-black text-emerald-400">Barcode: {reportData.input_barcode}</p>
                      <p className="text-xs text-white font-medium">{reportData.item_info}</p>
                    </div>

                    <div className="space-y-3 pl-4 border-l-2 border-emerald-500/50">
                      {reportData.steps?.map((st, idx) => (
                        <div key={idx} className="relative bg-[#121212] border border-[#2a2a2a] p-3.5 rounded-xl space-y-1">
                          <div className="absolute -left-6 top-4 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#1e1e1e]"></div>
                          <div className="flex justify-between items-center text-xs font-black text-white">
                            <span>Step {idx + 1}: {st.step}</span>
                            <span className="text-[10px] text-emerald-400 font-black uppercase bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">{st.status}</span>
                          </div>
                          <p className="text-xs text-slate-300 font-medium">{st.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SPECIAL REPORT 10: DAILY PRODUCTION MIS REPORT */}
                {activeTab === 'daily-mis' && reportData && (
                  <div className="space-y-6 text-xs font-semibold text-slate-200">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="bg-[#121212] p-4 rounded-xl border border-[#2a2a2a] space-y-2">
                        <h3 className="text-xs font-black uppercase text-emerald-400">INWARD</h3>
                        <p>Gate Passes Today: <strong className="text-white font-bold">{reportData.inward?.gate_passes}</strong></p>
                        <p>GRNs Submitted: <strong className="text-white font-bold">{reportData.inward?.grns}</strong></p>
                        <p className="text-[11px] text-slate-400">{reportData.inward?.material_received}</p>
                      </div>

                      <div className="bg-[#121212] p-4 rounded-xl border border-[#2a2a2a] space-y-2">
                        <h3 className="text-xs font-black uppercase text-blue-400">PRODUCTION</h3>
                        <p>Work Orders Active: <strong className="text-white font-bold">{reportData.production?.active_wos}</strong></p>
                        <p>Parts Produced: <strong className="text-white font-bold">{reportData.production?.parts_produced}</strong></p>
                        <p>Rejection Rate: <strong className="text-emerald-400 font-black">{reportData.production?.rejection_rate}</strong></p>
                      </div>

                      <div className="bg-[#121212] p-4 rounded-xl border border-[#2a2a2a] space-y-2">
                        <h3 className="text-xs font-black uppercase text-amber-400">OEE & MACHINE</h3>
                        <p>Plant OEE: <strong className="text-amber-400 font-black">{reportData.oee?.plant_oee}</strong></p>
                        <p>Best: <strong className="text-emerald-400 font-bold">{reportData.oee?.best_machine}</strong></p>
                        <p>Worst: <strong className="text-red-400 font-bold">{reportData.oee?.worst_machine}</strong></p>
                      </div>
                    </div>

                    <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/30 space-y-2">
                      <h3 className="text-xs font-black uppercase text-red-400">CRITICAL ALERTS TODAY</h3>
                      <ul className="space-y-1 text-slate-200 font-bold">
                        {reportData.alerts?.map((alt, idx) => (
                          <li key={idx}>• {alt}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* STANDARD TABLE DISPLAY FOR ALL OTHER REPORTS */}
                {activeTab !== 'defect-pareto' && activeTab !== 'traceability' && activeTab !== 'daily-mis' && reportData?.table && (
                  <div className="overflow-x-auto border border-[#2a2a2a] rounded-xl">
                    <table className="w-full text-left text-xs font-semibold text-slate-200">
                      <thead className="bg-[#252525] text-xs text-slate-200 uppercase font-black border-b border-[#333]">
                        <tr>
                          {Object.keys(reportData.table[0] || {}).map((col, idx) => (
                            <th key={idx} className="py-3 px-4">{col.replace('_', ' ')}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2a2a2a]">
                        {reportData.table.map((row, rowIdx) => (
                          <tr key={rowIdx} className="hover:bg-[#252525] border-b border-[#2a2a2a] transition">
                            {Object.values(row).map((val, colIdx) => (
                              <td key={colIdx} className="py-3 px-4 font-extrabold text-white">{val?.toString()}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* SUMMARY METRICS FOOTER */}
                {reportData?.summary && (
                  <div className="mt-6 pt-4 border-t border-[#2a2a2a] flex flex-wrap gap-4 text-xs font-black text-emerald-400">
                    {Object.entries(reportData.summary).map(([key, val]) => (
                      <span key={key} className="bg-[#121212] border border-[#3a3a3a] px-3 py-1.5 rounded-lg text-slate-300">
                        {key.replace('_', ' ').toUpperCase()}: <strong className="text-emerald-400 ml-1">{val}</strong>
                      </span>
                    ))}
                  </div>
                )}

              </div>
            )}

          </div>
        </div>

      </div>

    </div>
  );
}
