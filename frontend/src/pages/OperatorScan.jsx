import { useState, useRef } from 'react';
import axios from 'axios';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  Camera, X, Search, CheckCircle2, ArrowRight, Smartphone
} from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const getAuthHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

export default function OperatorScan() {
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [batch, setBatch] = useState(null); // Found batch detail

  // Camera scanner states
  const [showScanner, setShowScanner] = useState(false);
  const scannerRef = useRef(null);

  const startScanner = () => {
    setShowScanner(true);
    setTimeout(() => {
      const html5QrCode = new Html5Qrcode('operator-qr-reader');
      scannerRef.current = html5QrCode;
      html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          handleBatchLookup(decodedText);
          stopScanner();
        },
        () => {}
      ).catch(err => {
        alert('Scanner failed to start. Enable camera permissions.');
        setShowScanner(false);
      });
    }, 300);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().then(() => {
        scannerRef.current.clear();
        scannerRef.current = null;
        setShowScanner(false);
      }).catch(() => {
        scannerRef.current = null;
        setShowScanner(false);
      });
    } else {
      setShowScanner(false);
    }
  };

  const handleBatchLookup = async (code) => {
    if (!code) return;
    let batchNumber = code.trim();

    // Check for JSON payload
    if (code.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(code);
        batchNumber = parsed.batch || parsed.batch_number || batchNumber;
      } catch (e) {}
    }

    setLoading(true);
    try {
      // Lookup batch
      const res = await axios.get(`${API}/wip/batches`, getAuthHeader());
      const all = res.data;
      const found = all.find(b => b.batch_number.toLowerCase() === batchNumber.toLowerCase());

      if (!found) {
        alert(`WIP Batch "${batchNumber}" not found in database. Make sure it has been mixed.`);
        return;
      }

      // Fetch full details of the found batch
      const fullRes = await axios.get(`${API}/wip/batches/${found.batch_id}`, getAuthHeader());
      setBatch(fullRes.data);
      setSearchTerm('');
    } catch (err) {
      alert('Error searching batch');
    } finally {
      setLoading(false);
    }
  };

  const handleMoveForward = async () => {
    if (!batch) return;
    setLoading(true);
    try {
      await axios.put(`${API}/wip/batches/${batch.batch_id}/move`, {}, getAuthHeader());
      alert(`Success! Batch moved forward.`);
      setBatch(null); // Clear screen to scan next
    } catch (err) {
      alert('Failed to transition batch stage');
    } finally {
      setLoading(false);
    }
  };

  const handleHoldQC = async () => {
    if (!batch) return;
    setLoading(true);
    try {
      await axios.put(`${API}/wip/batches/${batch.batch_id}/hold`, {}, getAuthHeader());
      alert(`Success! Batch put on QC Hold.`);
      setBatch(null); // Clear screen to scan next
    } catch (err) {
      alert('Failed to place batch on hold');
    } finally {
      setLoading(false);
    }
  };

  const calculateTimeAtStage = (timeline) => {
    if (!timeline || timeline.length === 0) return '0m';
    const current = timeline[timeline.length - 1];
    const entered = new Date(current.entered_at);
    const elapsedMinutes = Math.round((new Date() - entered) / 60000);
    const hours = Math.floor(elapsedMinutes / 60);
    const mins = elapsedMinutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getNextStageName = (currentStage) => {
    const stages = [
      'Compounding/Mixing',
      'Moulding',
      'Curing',
      'Trimming/Deflashing',
      'Inspection/QC',
      'Packaging',
      'Finished Goods'
    ];
    const idx = stages.indexOf(currentStage);
    if (idx !== -1 && idx < stages.length - 1) {
      return stages[idx + 1];
    }
    return 'Finished Goods Store';
  };

  return (
    <div className="max-w-md mx-auto space-y-6 animate-fadeIn py-4">
      
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-1.5">
            <Smartphone className="w-5 h-5 text-orange-500" /> Shop Floor Route Scanner
          </h1>
          <p className="text-slate-500 text-xxs font-semibold uppercase mt-0.5">Jayashree Polymers Compounding & Moulding</p>
        </div>
      </div>

      {/* Lookup Barcode panel */}
      {!batch && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xl space-y-6 text-center">
          
          <div className="space-y-2">
            <span className="text-3xl">🖨️</span>
            <h3 className="font-extrabold text-slate-800 text-sm">Scan WIP Batch Barcode</h3>
            <p className="text-slate-455 text-xxs leading-relaxed">Scan the QR code printed on the batch trolley or route sheet to move it to the next production step.</p>
          </div>

          <div className="flex justify-center py-2">
            <button
              onClick={startScanner}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs p-5 rounded-2xl transition shadow-lg flex items-center gap-2 justify-center w-full max-w-xs"
            >
              <Camera className="w-5 h-5" /> TAP TO START CAMERA
            </button>
          </div>

          <div className="relative flex items-center justify-center my-4">
            <div className="border-t border-slate-200 w-full absolute"></div>
            <span className="bg-white px-3 text-slate-400 text-[10px] font-bold uppercase relative z-10">Or enter manually</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Type Batch No (e.g. B/2026/00001)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleBatchLookup(searchTerm)}
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none"
            />
            <button
              onClick={() => handleBatchLookup(searchTerm)}
              className="bg-slate-800 hover:bg-slate-900 text-white p-2.5 rounded-xl font-bold text-xs transition"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}

      {/* Found batch detail action board */}
      {batch && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xl space-y-6 animate-fadeIn">
          
          <div className="flex items-center gap-2 text-green-600 text-xs font-extrabold">
            <CheckCircle2 className="w-5 h-5" />
            <span>WIP BATCH IDENTIFIED</span>
          </div>

          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <span className="text-slate-455 text-[10px] font-black block uppercase tracking-wider">Batch Reference</span>
              <span className="text-xl font-mono font-black text-slate-800 block mt-0.5">{batch.batch_number}</span>
            </div>

            <div className="space-y-3 text-xs font-semibold text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-400">Product:</span>
                <strong className="text-slate-855 text-right">{batch.item_name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Customer:</span>
                <strong className="text-slate-855">{batch.customer_name || 'Internal'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Batch Quantity:</span>
                <strong className="text-slate-855">{batch.quantity} Pcs</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Work Order:</span>
                <strong className="text-slate-855 font-mono">{batch.wo_number}</strong>
              </div>
            </div>

            <div className="border border-slate-200 p-4 rounded-xl bg-slate-50 space-y-2 text-xs font-bold text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Current Stage:</span>
                <strong className="text-slate-800 uppercase tracking-wider">{batch.stage_name}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold">Time spent here:</span>
                <strong className="text-orange-500">{calculateTimeAtStage(batch.timeline)}</strong>
              </div>
            </div>

            {/* Move to next stage card */}
            <div className="border border-orange-200 p-4 rounded-xl bg-orange-50/20 text-center space-y-3">
              <span className="text-[10px] text-orange-600 font-black block uppercase tracking-wider">ROUTE TRANSACTION</span>
              <div className="flex items-center justify-center gap-3 text-xs font-extrabold text-slate-700">
                <span className="bg-slate-200 px-3 py-1 rounded-lg">{batch.stage_name}</span>
                <ArrowRight className="w-5 h-5 text-orange-500" />
                <span className="bg-orange-500 text-white px-3 py-1 rounded-lg">{getNextStageName(batch.stage_name)}</span>
              </div>
            </div>

          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={handleMoveForward}
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs py-4 rounded-xl transition shadow-lg uppercase tracking-wider flex items-center justify-center gap-1.5"
            >
              {loading ? 'Processing...' : 'Confirm Move →'}
            </button>
            <div className="grid grid-cols-2 gap-2 text-xxs font-bold text-center">
              <button
                onClick={handleHoldQC}
                disabled={loading}
                className="bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl transition"
              >
                Put on QC Hold
              </button>
              <button
                onClick={() => setBatch(null)}
                className="border border-slate-250 hover:bg-slate-50 text-slate-655 py-3 rounded-xl transition"
              >
                Cancel
              </button>
            </div>
          </div>

        </div>
      )}

      {/* Camera scanner reader modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xxs flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-xl max-w-sm w-full border border-slate-200 shadow-2xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-800 text-sm">Scan Batch QR Code</span>
              <button onClick={stopScanner} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <div id="operator-qr-reader" className="w-full h-64 bg-slate-100 rounded-lg overflow-hidden border border-slate-250"></div>
            <p className="text-slate-405 text-xxs text-center">Center the batch sticker barcode / QR code to scan.</p>
          </div>
        </div>
      )}

    </div>
  );
}
