import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Factory, CheckCircle2, AlertTriangle,
  Plus, Printer, Trash2, ShieldCheck, HelpCircle, Layers,
  ChevronRight, Wrench, Ban, Save, Search, BarChart2, Eye, Camera
} from 'lucide-react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return {
    headers: { Authorization: `Bearer ${token}` }
  };
};

export default function Moulding() {
  const [activeTab, setActiveTab] = useState('jobcards'); // 'moulds', 'jobcards', 'production', 'purge'
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Loaded Master Data
  const [moulds, setMoulds] = useState([]);
  const [jobCards, setJobCards] = useState([]);
  const [machines, setMachines] = useState([]);
  const [activeWorkOrders, setActiveWorkOrders] = useState([]);
  const [approvedBatches, setApprovedBatches] = useState([]);
  const [finishedItems, setFinishedItems] = useState([]);
  const [operators, setOperators] = useState([]);
  const [purgeHistory, setPurgeHistory] = useState([]);

  // Detail / Modal view states
  const [selectedMouldId, setSelectedMouldId] = useState(null);
  const [mouldDetail, setMouldDetail] = useState(null);
  const [mouldCompatibleMachines, setMouldCompatibleMachines] = useState([]);
  const [showNewMouldModal, setShowNewMouldModal] = useState(false);
  const [showNewJobCardModal, setShowNewJobCardModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [selectedJobCard, setSelectedJobCard] = useState(null);
  const [jobCardSummary, setJobCardSummary] = useState({ total_shots: 0, total_good: 0, total_rejected: 0, total_downtime: 0 });
  const [jobCardEntries, setJobCardEntries] = useState([]);
  
  // WIP Barcode Label Modal State
  const [showWipModal, setShowWipModal] = useState(false);
  const [wipLabel, setWipLabel] = useState(null);
  const [scannedBatchInfo, setScannedBatchInfo] = useState(null);
  
  // Mould verification & standalone scan rejections
  const [mouldVerified, setMouldVerified] = useState(false);
  const [showRejectionScanModal, setShowRejectionScanModal] = useState(false);
  const [scannedRejectionJc, setScannedRejectionJc] = useState(null);
  const [rejectionScanForm, setRejectionScanForm] = useState({
    wip_barcode: '',
    reason_code: '',
    rejected_qty: '',
    operator_id: '',
    shift: 'Morning',
    remarks: ''
  });

  // Camera scanner WebRTC states
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [activeScannerTarget, setActiveScannerTarget] = useState(null);

  // Form State: New Mould
  const [newMould, setNewMould] = useState({
    mould_code: '',
    mould_name: '',
    item_id: '',
    mould_type: 'Compression',
    cavities: 4,
    total_shots_allowed: 500000,
    mould_material: 'H13 Steel',
    platen_length: 500,
    platen_width: 500,
    platen_height: 150,
    weight_kg: 100,
    maintenance_due_shots: 480000
  });

  // Machine Master State
  const [showNewMachineModal, setShowNewMachineModal] = useState(false);
  const [newMachine, setNewMachine] = useState({
    machine_code: '',
    machine_name: '',
    capacity_tons: '',
    platen_length: '',
    platen_width: '',
    daylights: 1,
    heating_type: 'Electric',
    max_temperature: 200,
    max_pressure: 200,
    ideal_cycle_time: 5,
    status: 'Idle'
  });

  // Purging Log Detail Modal states
  const [selectedPurgeDetail, setSelectedPurgeDetail] = useState(null);
  const [showPurgeDetailModal, setShowPurgeDetailModal] = useState(false);

  // Selected machine details
  const [selectedMachineId, setSelectedMachineId] = useState(null);

  // Next Stage (Trimming/QC) Entry states
  const [nextStageBarcode, setNextStageBarcode] = useState('');
  const [nextStageInwardInfo, setNextStageInwardInfo] = useState(null);
  const [showQcReportForm, setShowQcReportForm] = useState(false);
  const [qcAcceptedQty, setQcAcceptedQty] = useState('');
  const [qcRejectedQty, setQcRejectedQty] = useState('');
  const [qcDefectType, setQcDefectType] = useState('');
  const [qcDefectDesc, setQcDefectDesc] = useState('');
  const [qcSeverity, setQcSeverity] = useState('Minor');
  const [qcRemarks, setQcRemarks] = useState('');
  const [qcSuccessReportNumber, setQcSuccessReportNumber] = useState(null);

  // Form State: New Job Card
  const [newJobCard, setNewJobCard] = useState({
    wo_id: '',
    item_id: '',
    customer_id: '',
    fb_id: '',
    compound_weight_required: 15.500,
    mould_id: '',
    machine_id: '',
    planned_qty: 1000,
    shots_required: 125,
    moulding_temp: 160,
    moulding_pressure: 150,
    curing_time: 4,
    preform_weight_g: 150,
    degassing_cycles: 2,
    planned_start: '',
    planned_end: ''
  });

  // Form State: Mould Maintenance
  const [maintenanceForm, setMaintenanceForm] = useState({
    maintenance_type: 'Scheduled Servicing',
    done_by: '',
    remarks: '',
    next_due_shots: ''
  });

  // Form State: Shift Production Entry
  const [prodEntry, setProdEntry] = useState({
    jc_id: '',
    shift: 'Morning',
    operator_id: '',
    shots_completed: '',
    good_parts: '',
    rejected_parts: 0,
    downtime_minutes: 0,
    downtime_reason: '',
    remarks: '',
    rejections: [] // { reason_code, rejected_qty, remarks }
  });

  // Form State: Machine Purging Waste
  const [purgeEntry, setPurgeEntry] = useState({
    machine_id: '',
    operator_id: '',
    purge_reason: 'End of Shift',
    compound_used: 'EPDM Purge Compound',
    quantity_kg: ''
  });

  // Rejection reasons list
  const rejectionReasons = [
    { code: 'REJ-01', name: 'Short Fill', desc: 'Incomplete part due to short rubber volume' },
    { code: 'REJ-02', name: 'Flash / Overflow', desc: 'Excess rubber flash at parting line' },
    { code: 'REJ-03', name: 'Blow Hole', desc: 'Trapped air bubble inside part' },
    { code: 'REJ-04', name: 'Surface Crack', desc: 'Cracks on product skin' },
    { code: 'REJ-05', name: 'Tear', desc: 'Part torn during demoulding' },
    { code: 'REJ-06', name: 'Undercure', desc: 'Soft or sticky rubber' },
    { code: 'REJ-07', name: 'Overcure', desc: 'Brittle or cracked rubber' },
    { code: 'REJ-08', name: 'Dimensional Reject', desc: 'Out of drawing size specification' },
    { code: 'REJ-09', name: 'Knit Line', desc: 'Incomplete bonding line' },
    { code: 'REJ-10', name: 'Foreign Particle', desc: 'Embedded dust or impurities' },
    { code: 'REJ-11', name: 'Sink Mark', desc: 'Surface depression' },
    { code: 'REJ-12', name: 'Wrong Compound', desc: 'Mixed correct parts in wrong compound slab' }
  ];

  // Shift List
  const shifts = ['Morning', 'Evening', 'Night'];

  // Downtime Reasons
  const downtimeReasons = [
    'Machine Breakdown',
    'Mould Changeover',
    'No Raw Material / No Compound',
    'Power Failure',
    'Planned Maintenance',
    'Operator Unavailable',
    'Quality Hold',
    'Trial / Setup'
  ];

  useEffect(() => {
    fetchMoulds();
    fetchJobCards();
    fetchMachines();
    fetchDropdowns();
    fetchPurgeHistory();
  }, []);

  const showSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const showError = (msg) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(''), 5000);
  };

  const fetchMoulds = async () => {
    try {
      const res = await axios.get(`${API}/moulding/moulds`, getAuthHeader());
      setMoulds(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchJobCards = async () => {
    try {
      const res = await axios.get(`${API}/moulding/job-cards`, getAuthHeader());
      setJobCards(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMachines = async () => {
    try {
      const res = await axios.get(`${API}/moulding/machines`, getAuthHeader());
      setMachines(res.data || []);
    } catch (err) {
      console.error('Failed to load press machines', err);
    }
  };

  const fetchPurgeHistory = async () => {
    try {
      const res = await axios.get(`${API}/moulding/purge`, getAuthHeader());
      setPurgeHistory(res.data || []);
    } catch (err) {
      console.error('Failed to load purge logs', err);
    }
  };

  const handleScanJobCardQR = (scannedCode) => {
    if (!scannedCode) return;
    let jcNumber = scannedCode.trim();
    
    // Try parsing JSON first (if scanned from the printed job card QR code)
    try {
      const parsed = JSON.parse(scannedCode);
      if (parsed && parsed.jc) {
        jcNumber = parsed.jc;
      }
    } catch (e) {
      // Not JSON, treat as raw barcode string
    }

    const cleanCode = jcNumber.trim().toLowerCase();
    
    // Strip WIP- prefix if scanned from a finished parts tray WIP barcode
    const targetJcNumber = cleanCode.startsWith('wip-') ? cleanCode.replace('wip-', '') : cleanCode;
    
    const jc = jobCards.find(j => {
      const normalizedJc = j.jc_number?.toLowerCase().replace(/[/-]/g, '');
      const normalizedTarget = targetJcNumber.replace(/[/-]/g, '');
      return normalizedJc === normalizedTarget;
    });

    if (jc) {
      showSuccess(`Scan Verified: Job Card "${jc.jc_number}" matched. Opening production entry console.`);
      handleJobCardSelect(jc);
    } else {
      showError(`Scan Error: Scanned barcode "${scannedCode}" does not match any active Job Card.`);
    }
  };

  const handleScanCompoundBarcode = async (barcode) => {
    if (!barcode) return;
    try {
      const res = await axios.get(`${API}/moulding/batches/lookup/${barcode}`, getAuthHeader());
      const batch = res.data;
      
      setScannedBatchInfo(batch);

      // If status is not Approved, block and show error!
      if (batch.status !== 'Approved') {
        showError(`Scan Blocked: Compound batch "${barcode}" is NOT approved by QC! Status: ${batch.status}`);
        setNewJobCard(prev => ({ ...prev, fb_id: '' }));
        return;
      }
      
      // Auto-fill active work order matching the batch item if none is selected
      if (!newJobCard.wo_id) {
        const matchingWO = activeWorkOrders.find(w => parseInt(w.item_id) === parseInt(batch.item_id));
        if (matchingWO) {
          handleWOChange(matchingWO.wo_id.toString());
          showSuccess(`Auto-selected Work Order ${matchingWO.wo_number} matching recipe "${batch.item_name}".`);
        } else {
          showError(`No active Work Order found for scanned recipe "${batch.item_name}".`);
          setNewJobCard(prev => ({ ...prev, fb_id: '' }));
          return;
        }
      } else {
        // Recipe Mismatch Check (batch item_id vs selected WO item_id)
        if (newJobCard.item_id && parseInt(batch.item_id) !== parseInt(newJobCard.item_id)) {
          showError(`Scan Denied: Recipe mismatch! Work order requires item ID ${newJobCard.item_id}, but scanned compound batch is for item ID ${batch.item_id} (${batch.item_name}).`);
          setNewJobCard(prev => ({ ...prev, fb_id: '' }));
          return;
        }
      }
      
      // Ensure batch exists in approvedBatches list so it can be selected
      setApprovedBatches(prev => {
        const exists = prev.some(b => parseInt(b.fb_id) === parseInt(batch.fb_id));
        if (!exists) return [...prev, batch];
        return prev;
      });

      // Auto-select in form
      setNewJobCard(prev => ({
        ...prev,
        fb_id: batch.fb_id
      }));
      showSuccess(`Scan Verified: Compound batch "${barcode}" (${batch.item_name}) is approved and loaded.`);
    } catch (err) {
      showError(err.response?.data?.message || `Failed to lookup compound barcode "${barcode}".`);
      setScannedBatchInfo(null);
    }
  };

  const handleScanMouldBarcode = async (code) => {
    if (!code) return;
    try {
      const res = await axios.get(`${API}/moulding/moulds/lookup/${code}`, getAuthHeader());
      const mould = res.data;
      
      if (mould.status === 'Under Maintenance') {
        showError(`Scan Blocked: Mould "${code}" is Under Maintenance and cannot be selected.`);
        return;
      }
      if (mould.status === 'Condemned') {
        showError(`Scan Blocked: Mould "${code}" is Condemned (retired) and cannot be selected.`);
        return;
      }
      
      // Auto select mould and compatible machines
      handleMouldChangeInJob(mould.mould_id);
      showSuccess(`Scan Verified: Mould "${code}" is available and compatible.`);
    } catch (err) {
      showError(err.response?.data?.message || `Failed to lookup mould barcode "${code}".`);
    }
  };

  const handleVerifyMouldBarcode = (scannedCode) => {
    if (!scannedCode || !selectedJobCard) return;
    if (scannedCode.trim().toLowerCase() === selectedJobCard.mould_code?.toLowerCase()) {
      setMouldVerified(true);
      showSuccess(`Mould Verified! Mould "${scannedCode}" matches the Job Card requirements.`);
    } else {
      setMouldVerified(false);
      showError(`Mould Mismatch! This Job Card requires mould "${selectedJobCard.mould_code}", but you scanned "${scannedCode}"!`);
    }
  };

  const handleScanWipForRejection = (wipBarcode) => {
    if (!wipBarcode) return;
    const cleanBarcode = wipBarcode.trim().toLowerCase();
    const targetJcNumber = cleanBarcode.startsWith('wip-') ? cleanBarcode.replace('wip-', '') : cleanBarcode;
    
    const jc = jobCards.find(j => {
      const normalizedJc = j.jc_number?.toLowerCase().replace(/[/-]/g, '');
      const normalizedTarget = targetJcNumber.replace(/[/-]/g, '');
      return normalizedJc === normalizedTarget;
    });
    
    if (jc) {
      setScannedRejectionJc(jc);
      setRejectionScanForm(prev => ({
        ...prev,
        wip_barcode: wipBarcode
      }));
      showSuccess(`WIP Batch recognized: source Job Card ${jc.jc_number}.`);
    } else {
      setScannedRejectionJc(null);
      showError(`WIP Batch barcode "${wipBarcode}" does not match any active Job Card.`);
    }
  };

  const handleSaveStandaloneRejection = async (e) => {
    e.preventDefault();
    if (!scannedRejectionJc) return showError('Scan a valid WIP Batch barcode first.');
    if (!rejectionScanForm.operator_id) return showError('Select operator.');
    if (!rejectionScanForm.reason_code) return showError('Select rejection reason.');
    if (!rejectionScanForm.rejected_qty || parseInt(rejectionScanForm.rejected_qty) <= 0) return showError('Enter valid rejection quantity.');

    setLoading(true);
    try {
      await axios.post(`${API}/moulding/rejections/log`, {
        jc_id: scannedRejectionJc.jc_id,
        machine_id: scannedRejectionJc.machine_id,
        operator_id: rejectionScanForm.operator_id,
        shift: rejectionScanForm.shift,
        reason_code: rejectionScanForm.reason_code,
        rejected_qty: rejectionScanForm.rejected_qty,
        remarks: rejectionScanForm.remarks
      }, getAuthHeader());

      showSuccess('Rejection log entry recorded successfully against batch!');
      setShowRejectionScanModal(false);
      setScannedRejectionJc(null);
      setRejectionScanForm({
        wip_barcode: '',
        reason_code: '',
        rejected_qty: '',
        operator_id: '',
        shift: 'Morning',
        remarks: ''
      });
      
      // Refresh lists
      fetchJobCards();
      if (selectedJobCard && selectedJobCard.jc_id === scannedRejectionJc.jc_id) {
        handleJobCardSelect(selectedJobCard);
      }
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to log rejection.');
    } finally {
      setLoading(false);
    }
  };

  const handleLookupWipForNextStage = async (wipBarcode) => {
    if (!wipBarcode) return;
    const trimmed = wipBarcode.trim();
    try {
      const res = await axios.get(`${API}/moulding/wip/lookup/${encodeURIComponent(trimmed)}`, getAuthHeader());
      setNextStageInwardInfo(res.data);
      showSuccess(`WIP Batch verified: ${trimmed} is ready for inwarding.`);
    } catch (err) {
      showError(err.response?.data?.message || `WIP barcode "${trimmed}" not found. Ensure job card is completed.`);
      setNextStageInwardInfo(null);
    }
  };

  const handleInwardToNextStage = async () => {
    if (!nextStageInwardInfo) return showError('Please scan or lookup a valid WIP batch first.');
    setLoading(true);
    try {
      const res = await axios.post(`${API}/moulding/next-stage`, {
        batch_number: nextStageInwardInfo.batch_number,
        stage_id: 3, // Trimming/QC
        remarks: `Inwarded to Trimming & QC via next stage scan.`
      }, getAuthHeader());
      showSuccess(res.data.message || 'WIP Batch successfully moved to Trimming/QC!');
      
      // Update batch_id inside nextStageInwardInfo if returned from API
      if (res.data.batch_id) {
        setNextStageInwardInfo(prev => ({ ...prev, batch_id: res.data.batch_id }));
      }
      
      setShowQcReportForm(true);
      setQcAcceptedQty(nextStageInwardInfo.quantity || 0);
      setQcRejectedQty(0);
      setQcDefectType('');
      setQcDefectDesc('');
      setQcSeverity('Minor');
      setQcRemarks('');
      setQcSuccessReportNumber(null);
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to inward WIP batch to Trimming/QC.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitNextStageQcReport = async (e) => {
    e.preventDefault();
    if (!nextStageInwardInfo) return;
    
    const acc = parseFloat(qcAcceptedQty || 0);
    const rej = parseFloat(qcRejectedQty || 0);
    const total = parseFloat(nextStageInwardInfo.quantity || 0);
    
    if (acc + rej !== total) {
      return showError(`Accepted quantity (${acc}) + Rejected quantity (${rej}) must equal Inspected quantity (${total}).`);
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API}/qc/inspections`, {
        inspection_type: 'In-Process',
        reference_id: nextStageInwardInfo.batch_id || nextStageInwardInfo.reference_id,
        item_id: nextStageInwardInfo.item_id,
        inspected_qty: total,
        accepted_qty: acc,
        rejected_qty: rej,
        remarks: qcRemarks,
        defect_type: rej > 0 ? qcDefectType : 'None',
        defect_description: rej > 0 ? qcDefectDesc : '',
        severity: rej > 0 ? qcSeverity : 'Minor',
        batch_number: nextStageInwardInfo.batch_number
      }, getAuthHeader());
      
      showSuccess(`In-Process QC Report submitted successfully! Inspection Code: ${res.data.inspection_number}`);
      setQcSuccessReportNumber(res.data.inspection_number);
      setShowQcReportForm(false);
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to submit QC Inspection Report.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCameraScanner = (target) => {
    setActiveScannerTarget(target);
    setShowCameraModal(true);
  };

  const handleCloseCamera = () => {
    setShowCameraModal(false);
    setActiveScannerTarget(null);
  };

  const handleCameraScanSuccess = (decodedText) => {
    if (!decodedText) return;
    if (activeScannerTarget === 'compound') {
      handleScanCompoundBarcode(decodedText);
    } else if (activeScannerTarget === 'mould') {
      handleScanMouldBarcode(decodedText);
    } else if (activeScannerTarget === 'jobcard') {
      handleScanJobCardQR(decodedText);
    } else if (activeScannerTarget === 'rejection') {
      handleScanWipForRejection(decodedText);
    } else if (activeScannerTarget === 'mould_verify') {
      handleVerifyMouldBarcode(decodedText);
    } else if (activeScannerTarget === 'nextstage') {
      handleLookupWipForNextStage(decodedText);
    }
  };

  const fetchDropdowns = async () => {
    try {
      // Work orders
      const woRes = await axios.get(`${API}/moulding/active-work-orders`, getAuthHeader());
      setActiveWorkOrders(woRes.data);

      // Approved final batches
      const fbRes = await axios.get(`${API}/moulding/approved-batches`, getAuthHeader());
      setApprovedBatches(fbRes.data);

      // Finished goods items
      const itemsRes = await axios.get(`${API}/inventory/items`, getAuthHeader());
      setFinishedItems(itemsRes.data.filter(i => i.category === 'Finished Good'));

      // Users/Operators list
      const usersRes = await axios.get(`${API}/inventory/users`, getAuthHeader());
      setOperators(usersRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleMouldSelect = async (id) => {
    setSelectedMouldId(id);
    try {
      const res = await axios.get(`${API}/moulding/moulds/${id}`, getAuthHeader());
      setMouldDetail(res.data);
    } catch (err) {
      showError('Failed to fetch mould maintenance logs.');
    }
  };

  const handleCreateMould = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/moulding/moulds`, newMould, getAuthHeader());
      showSuccess('New steel tooling mould added successfully!');
      setShowNewMouldModal(false);
      fetchMoulds();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to register mould.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMachine = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/moulding/machines`, newMachine, getAuthHeader());
      showSuccess('New press machine registered successfully!');
      setShowNewMachineModal(false);
      fetchMachines();
      setNewMachine({
        machine_code: '',
        machine_name: '',
        capacity_tons: '',
        platen_length: '',
        platen_width: '',
        daylights: 1,
        heating_type: 'Electric',
        max_temperature: 200,
        max_pressure: 200,
        ideal_cycle_time: 5,
        status: 'Idle'
      });
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to register press machine.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogMaintenance = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/moulding/moulds/${selectedMouldId}/maintenance`, maintenanceForm, getAuthHeader());
      showSuccess('Mould maintenance logged. Shots counter reset!');
      setShowMaintenanceModal(false);
      handleMouldSelect(selectedMouldId);
      fetchMoulds();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to submit log.');
    } finally {
      setLoading(false);
    }
  };

  const handleWOChange = (woId) => {
    const selectedWO = activeWorkOrders.find(w => w.wo_id === parseInt(woId));
    if (selectedWO) {
      setNewJobCard(prev => ({
        ...prev,
        wo_id: woId,
        item_id: selectedWO.item_id,
        customer_id: selectedWO.customer_id || '',
        planned_qty: selectedWO.planned_qty
      }));
      // Auto-suggest compatible mould if matching item_id
      const matchedMould = moulds.find(m => m.item_id === selectedWO.item_id);
      if (matchedMould) {
        setNewJobCard(prev => {
          const shots = Math.ceil(selectedWO.planned_qty / matchedMould.cavities);
          return {
            ...prev,
            mould_id: matchedMould.mould_id,
            shots_required: shots
          };
        });
      }
    }
  };

  const handleMouldChangeInJob = async (mouldId) => {
    const mld = moulds.find(m => m.mould_id === parseInt(mouldId));
    if (mld) {
      setNewJobCard(prev => {
        const shots = Math.ceil(prev.planned_qty / mld.cavities);
        return {
          ...prev,
          mould_id: mouldId,
          shots_required: shots
        };
      });
      try {
        const res = await axios.get(`${API}/moulding/moulds/${mouldId}`, getAuthHeader());
        setMouldCompatibleMachines(res.data.compatibleMachines || []);
      } catch (err) {
        console.error('Failed to get compatible machines:', err);
      }
    } else {
      setMouldCompatibleMachines([]);
    }
  };

  const handleCreateJobCard = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/moulding/job-cards`, newJobCard, getAuthHeader());
      showSuccess('Moulding production job card generated successfully!');
      setShowNewJobCardModal(false);
      fetchJobCards();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to create job card.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartJob = async (jcId) => {
    setLoading(true);
    try {
      await axios.put(`${API}/moulding/job-cards/${jcId}/start`, {}, getAuthHeader());
      showSuccess('Moulding press heating cycles started!');
      fetchJobCards();
    } catch (err) {
      showError('Failed to start production run.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteJob = async (jcId) => {
    setLoading(true);
    try {
      const res = await axios.put(`${API}/moulding/job-cards/${jcId}/complete`, {}, getAuthHeader());
      const { wip_batch_number, total_good } = res.data;

      // Set WIP Label — keep selectedJobCard alive so modal can reference it
      setWipLabel({
        wip_number: wip_batch_number || `WIP-${selectedJobCard.jc_number}`,
        item_name: selectedJobCard.item_name,
        item_code: selectedJobCard.item_code,
        wo_number: selectedJobCard.wo_number,
        good_qty: total_good || selectedJobCard.planned_qty,
        completed_date: new Date().toLocaleDateString(),
        machine_code: selectedJobCard.machine_code,
        machine_name: selectedJobCard.machine_name
      });
      setShowWipModal(true);

      showSuccess('Job card completed! WIP barcode generated — print and attach to the parts tray.');
      fetchJobCards();
      // selectedJobCard stays alive until WIP modal is dismissed
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to complete production run.');
    } finally {
      setLoading(false);
    }
  };

  // Job card summaries & runs
  const handleJobCardSelect = async (jc) => {
    setSelectedJobCard(jc);
    setMouldVerified(false);
    try {
      const summaryRes = await axios.get(`${API}/moulding/summary/${jc.jc_id}`, getAuthHeader());
      setJobCardSummary(summaryRes.data);

      const entriesRes = await axios.get(`${API}/moulding/entries/${jc.jc_id}`, getAuthHeader());
      setJobCardEntries(entriesRes.data);

      // Pre-fill production entry
      setProdEntry({
        jc_id: jc.jc_id,
        shift: 'Morning',
        operator_id: '',
        shots_completed: '',
        good_parts: '',
        rejected_parts: 0,
        downtime_minutes: 0,
        downtime_reason: '',
        remarks: '',
        rejections: []
      });
    } catch (err) {
      showError('Failed to load production logs for job card.');
    }
  };

  const handleAddDefectLine = (code, qty) => {
    if (!qty || qty <= 0) return;
    const reasonObj = rejectionReasons.find(r => r.code === code);
    setProdEntry(prev => {
      const currentList = [...prev.rejections];
      const match = currentList.find(c => c.reason_code === code);
      if (match) {
        match.rejected_qty = parseInt(match.rejected_qty) + parseInt(qty);
      } else {
        currentList.push({
          reason_code: code,
          rejected_qty: parseInt(qty),
          name: reasonObj ? reasonObj.name : code
        });
      }
      const totalRej = currentList.reduce((sum, item) => sum + item.rejected_qty, 0);
      const shots = parseInt(prev.shots_completed || 0);
      const totalCav = shots * (selectedJobCard?.cavities || 1);
      const good = Math.max(0, totalCav - totalRej);

      return {
        ...prev,
        rejections: currentList,
        rejected_parts: totalRej,
        good_parts: good
      };
    });
  };

  const handleShotsInput = (shotsVal) => {
    const shots = parseInt(shotsVal || 0);
    const totalCav = shots * (selectedJobCard?.cavities || 1);
    setProdEntry(prev => {
      const totalRej = prev.rejections.reduce((sum, item) => sum + item.rejected_qty, 0);
      return {
        ...prev,
        shots_completed: shotsVal,
        good_parts: Math.max(0, totalCav - totalRej)
      };
    });
  };

  const handleRemoveDefectLine = (code) => {
    setProdEntry(prev => {
      const currentList = prev.rejections.filter(c => c.reason_code !== code);
      const totalRej = currentList.reduce((sum, item) => sum + item.rejected_qty, 0);
      const shots = parseInt(prev.shots_completed || 0);
      const totalCav = shots * (selectedJobCard?.cavities || 1);
      const good = Math.max(0, totalCav - totalRej);

      return {
        ...prev,
        rejections: currentList,
        rejected_parts: totalRej,
        good_parts: good
      };
    });
  };

  const handleSaveProductionEntry = async (e) => {
    e.preventDefault();
    if (!prodEntry.operator_id) return showError('Please select a machine operator.');
    if (!prodEntry.shots_completed || prodEntry.shots_completed <= 0) return showError('Enter completed shots.');

    setLoading(true);
    try {
      await axios.post(`${API}/moulding/entries`, {
        ...prodEntry,
        machine_id: selectedJobCard.machine_id
      }, getAuthHeader());

      showSuccess('Shift production entry saved. Compound stock deducted!');
      handleJobCardSelect(selectedJobCard);
      fetchMoulds();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to save entry.');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePurgeLog = async (e) => {
    e.preventDefault();
    if (!purgeEntry.machine_id) return showError('Select a press machine.');
    if (!purgeEntry.quantity_kg) return showError('Enter purge compound quantity.');

    setLoading(true);
    try {
      await axios.post(`${API}/moulding/purge`, purgeEntry, getAuthHeader());
      showSuccess('Purge log saved.');
      fetchPurgeHistory();
      setPurgeEntry({
        machine_id: '',
        operator_id: '',
        purge_reason: 'End of Shift',
        compound_used: 'EPDM Purge Compound',
        quantity_kg: ''
      });
    } catch (err) {
      showError('Failed to submit purge log.');
    } finally {
      setLoading(false);
    }
  };

  // Generate printable job card PDF
  const handlePrintJobCardPDF = () => {
    if (!selectedJobCard) return;
    
    const qrPayload = JSON.stringify({
      jc: selectedJobCard.jc_number,
      item: selectedJobCard.item_name,
      cust: selectedJobCard.customer_name || 'Internal',
      mould: selectedJobCard.mould_code,
      machine: selectedJobCard.machine_code,
      qty: selectedJobCard.planned_qty,
      fb: selectedJobCard.fb_number
    });

    const qrImageUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=' + encodeURIComponent(qrPayload);
    const compoundBarcodeUrl = 'https://bwipjs-api.metafloor.com/?bcid=code128&text=' + encodeURIComponent(selectedJobCard.fb_number || 'N/A') + '&scale=2&rotate=N&includetext=true';

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
      <head>
        <title>Job Card - ${selectedJobCard.jc_number}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; padding: 20px; color: #000; font-size: 12px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #000; padding-bottom: 14px; margin-bottom: 16px; }
          .company h1 { font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
          .company p { font-size: 10px; color: #555; margin-top: 3px; }
          .jc-qr { display: flex; align-items: center; gap: 12px; }
          .jc-info { text-align: right; }
          .jc-info h2 { font-size: 22px; font-weight: 900; color: #000; letter-spacing: 1px; }
          .jc-info .sub { font-size: 10px; color: #555; margin-top: 2px; }
          .qr-box { border: 2px solid #000; padding: 3px; background: #fff; }
          .qr-label { font-size: 8px; font-weight: bold; text-align: center; margin-top: 3px; text-transform: uppercase; color: #444; letter-spacing: 0.5px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid #000; margin-bottom: 14px; }
          .info-cell { padding: 7px 10px; border-bottom: 1px solid #ccc; }
          .info-cell:nth-child(odd) { border-right: 1px solid #ccc; }
          .info-cell .label { font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
          .info-cell .value { font-size: 12px; font-weight: bold; margin-top: 1px; }
          .specs-box { border: 1px solid #000; padding: 10px 14px; border-radius: 4px; margin-bottom: 14px; }
          .specs-title { font-size: 10px; font-weight: bold; text-transform: uppercase; text-align: center; border-bottom: 1px solid #ccc; padding-bottom: 6px; margin-bottom: 8px; letter-spacing: 1px; }
          .specs-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; text-align: center; }
          .spec-item .label { font-size: 9px; color: #777; }
          .spec-item .value { font-size: 15px; font-weight: 900; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px; }
          th, td { border: 1px solid #999; padding: 7px 8px; }
          th { background: #eee; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 30px; }
          .sig-box .line { border-bottom: 1px solid #000; height: 36px; }
          .sig-box p { margin-top: 4px; font-size: 10px; color: #555; }
          .barcodes-footer { margin-top: 24px; border-top: 2px dashed #000; padding-top: 16px; display: flex; gap: 24px; justify-content: center; align-items: flex-start; }
          .bc-item { text-align: center; }
          .bc-item .bc-label { font-size: 8px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; font-weight: bold; }
          .bc-item .bc-num { font-size: 9px; font-weight: bold; margin-top: 5px; letter-spacing: 1px; }
          @media print { body { padding: 10mm; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company">
            <h1>Jayashree Polymers Group</h1>
            <p>Moulding Department &mdash; Job Card / Production Order</p>
          </div>
          <div class="jc-qr">
            <div class="jc-info">
              <h2>${selectedJobCard.jc_number}</h2>
              <div class="sub">Issued: ${new Date(selectedJobCard.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</div>
              <div class="sub" style="margin-top:4px;">Status: <strong>${selectedJobCard.status || 'Issued'}</strong></div>
            </div>
            <div>
              <div class="qr-box">
                <img src="${qrImageUrl}" style="width:90px;height:90px;display:block;" alt="Job Card QR" />
              </div>
              <p class="qr-label">Scan at Machine</p>
            </div>
          </div>
        </div>

        <!-- 7 Required Fields -->
        <div class="info-grid">
          <div class="info-cell">
            <div class="label">Job Card Number</div>
            <div class="value">${selectedJobCard.jc_number}</div>
          </div>
          <div class="info-cell">
            <div class="label">Work Order</div>
            <div class="value">${selectedJobCard.wo_number}</div>
          </div>
          <div class="info-cell">
            <div class="label">Product Name</div>
            <div class="value">${selectedJobCard.item_name} (${selectedJobCard.item_code})</div>
          </div>
          <div class="info-cell">
            <div class="label">Customer</div>
            <div class="value">${selectedJobCard.customer_name || 'Internal'}</div>
          </div>
          <div class="info-cell">
            <div class="label">Mould Tool</div>
            <div class="value">${selectedJobCard.mould_name || ''} (${selectedJobCard.mould_code})</div>
          </div>
          <div class="info-cell">
            <div class="label">Press Machine</div>
            <div class="value">${selectedJobCard.machine_name || ''} (${selectedJobCard.machine_code})</div>
          </div>
          <div class="info-cell">
            <div class="label">Planned Quantity</div>
            <div class="value">${selectedJobCard.planned_qty} pcs &mdash; ${selectedJobCard.shots_required} shots (${selectedJobCard.cavities} cavities)</div>
          </div>
          <div class="info-cell">
            <div class="label">Compound Batch No.</div>
            <div class="value">${selectedJobCard.fb_number}</div>
          </div>
        </div>

        <!-- Curing Specs -->
        <div class="specs-box">
          <div class="specs-title">Curing Specifications</div>
          <div class="specs-grid">
            <div class="spec-item"><div class="label">Moulding Temp</div><div class="value">${selectedJobCard.moulding_temp_c || 160} &deg;C</div></div>
            <div class="spec-item"><div class="label">Pressure</div><div class="value">${selectedJobCard.pressure_bar || 150} bar</div></div>
            <div class="spec-item"><div class="label">Curing Time</div><div class="value">${selectedJobCard.curing_time_min || 4} min</div></div>
            <div class="spec-item"><div class="label">Preform Wt.</div><div class="value">${selectedJobCard.preform_weight_g || 150} g</div></div>
            <div class="spec-item"><div class="label">Degassing</div><div class="value">${selectedJobCard.degassing_cycles || 2} cycles</div></div>
          </div>
        </div>

        <!-- Production Log -->
        <table>
          <thead><tr><th>Shift Date</th><th>Shift</th><th>Operator</th><th>Shots</th><th>Good Parts</th><th>Rejected</th><th>Downtime</th></tr></thead>
          <tbody>
            ${jobCardEntries.length > 0
              ? jobCardEntries.map(e => `<tr><td>${new Date(e.entry_date).toLocaleDateString()}</td><td>${e.shift}</td><td>${e.operator_name}</td><td>${e.shots_completed}</td><td>${e.good_parts}</td><td>${e.rejected_parts}</td><td>${e.downtime_minutes > 0 ? e.downtime_minutes + ' min' : '-'}</td></tr>`).join('')
              : '<tr><td colspan="7" style="text-align:center;padding:20px;color:#888;">No production entries recorded yet.</td></tr>'
            }
          </tbody>
        </table>

        <!-- Signatures -->
        <div class="signatures">
          <div class="sig-box"><div class="line"></div><p>Shift Supervisor</p></div>
          <div class="sig-box"><div class="line"></div><p>QA Inspector</p></div>
          <div class="sig-box"><div class="line"></div><p>Authorized Operator</p></div>
        </div>

        <!-- Scannable Barcodes Footer -->
        <div class="barcodes-footer">
          <div class="bc-item">
            <div class="bc-label">Job Card QR &mdash; Scan at Machine</div>
            <img src="${qrImageUrl}" style="width:100px;height:100px;border:1px solid #ccc;padding:3px;" alt="QR" />
            <div class="bc-num">${selectedJobCard.jc_number}</div>
          </div>
          <div class="bc-item">
            <div class="bc-label">Compound Batch Barcode</div>
            <img src="${compoundBarcodeUrl}" style="height:55px;display:block;margin:auto;" alt="Compound Barcode" />
            <div class="bc-num">${selectedJobCard.fb_number}</div>
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 800);
  };

  const handlePrintCompoundBatchTag = (batch) => {
    if (!batch) return;
    const printLabelWindow = window.open('', '_blank');
    printLabelWindow.document.write(`
      <html>
      <head>
        <title>Print Compound Batch Tag</title>
        <style>
          body { font-family: monospace; margin: 0; padding: 20px; text-align: center; }
          .tag { border: 2px dashed #000; padding: 15px; border-radius: 8px; max-width: 300px; margin: auto; }
          .title { font-weight: bold; font-size: 14px; margin: 0; }
          .subtitle { font-size: 9px; text-transform: uppercase; color: #666; margin: 2px 0 10px; }
          .barcode { margin: 15px 0; border: 1px solid #ccc; padding: 10px; display: inline-block; background: #fff; }
          .label-info { text-align: left; font-size: 11px; margin-top: 10px; border-top: 1px solid #ccc; padding-top: 10px; line-height: 1.5; }
          .flex-row { display: flex; justify-content: space-between; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="tag">
          <h2 class="title">JAYASHREE POLYMERS</h2>
          <p class="subtitle">MIXING FINAL BATCH TAG</p>
          <div class="barcode">
            <img src="https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(batch.fb_number)}&scale=2&rotate=N&includetext=false" style="height:40px; display:block; margin:auto;" />
            <span style="font-weight:bold; letter-spacing:2px; font-size:12px; display:block; margin-top:5px;">${batch.fb_number}</span>
          </div>
          <div class="label-info">
            <div class="flex-row"><span>COMPOUND / RECIPE:</span><strong>${batch.item_name}</strong></div>
            <div class="flex-row"><span>ITEM CODE:</span><strong>${batch.item_code}</strong></div>
            <div class="flex-row"><span>BATCH WEIGHT:</span><strong>${batch.weight_kg} KG</strong></div>
            <div class="flex-row"><span>STATUS:</span><strong style="color:green;">${batch.status}</strong></div>
            <div class="flex-row"><span>PRODUCED DATE:</span><strong>${new Date(batch.created_at || new Date()).toLocaleDateString()}</strong></div>
          </div>
        </div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
      </html>
    `);
    printLabelWindow.document.close();
  };

  // Camera scanner lifecycle hook
  useEffect(() => {
    let html5Qrcode;
    if (showCameraModal) {
      // Delay initialization slightly to guarantee the div exists in DOM
      const timer = setTimeout(() => {
        try {
          html5Qrcode = new Html5Qrcode("camera-reader-element");
          
          const qrCodeSuccessCallback = (decodedText) => {
            // Play success beep
            try {
              const context = new (window.AudioContext || window.webkitAudioContext)();
              const oscillator = context.createOscillator();
              const gainNode = context.createGain();
              oscillator.connect(gainNode);
              gainNode.connect(context.destination);
              oscillator.frequency.value = 1000;
              gainNode.gain.setValueAtTime(0.8, context.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
              oscillator.start();
              oscillator.stop(context.currentTime + 0.12);
            } catch (e) {
              console.log('Beep failed', e);
            }

            handleCameraScanSuccess(decodedText);
          };

          const config = { 
            fps: 10, 
            qrbox: (width, height) => {
              const minSize = Math.min(width, height);
              const qrBoxSize = Math.floor(minSize * 0.7);
              return { width: qrBoxSize, height: qrBoxSize };
            }
          };

          html5Qrcode.start(
            { facingMode: "environment" },
            config,
            qrCodeSuccessCallback
          ).catch(err => {
            console.error("Camera start failed", err);
          });
        } catch (err) {
          console.error("Scanner setup failed", err);
        }
      }, 300);

      return () => {
        clearTimeout(timer);
        if (html5Qrcode) {
          if (html5Qrcode.isScanning) {
            html5Qrcode.stop().catch(err => console.error("Camera stop failed", err));
          }
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCameraModal]);

  return (
    <div className="space-y-6">
      {/* Messages */}
      {successMessage && (
        <div className="bg-green-100 border border-green-300 text-green-800 rounded-xl p-3.5 text-xs font-semibold animate-pulse shadow-md flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-green-600 flex-shrink-0" />
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="bg-red-100 border border-red-300 text-red-800 rounded-xl p-3.5 text-xs font-semibold shadow-md flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          {errorMessage}
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <Factory className="w-6 h-6 text-orange-500" />
            Moulding Production Module
          </h2>
          <p className="text-slate-450 text-xs mt-0.5 font-medium">
            Manage steel tooling masters, press job cards, operator logs, defect rejections, and purges.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowNewMouldModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Mould
          </button>
          <button
            onClick={() => { setScannedBatchInfo(null); setShowNewJobCardModal(true); }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition shadow-md"
          >
            <Plus className="w-4 h-4" />
            Create Job Card
          </button>
          <button
            onClick={() => {
              setScannedRejectionJc(null);
              setRejectionScanForm({
                wip_barcode: '',
                reason_code: '',
                rejected_qty: '',
                operator_id: '',
                shift: 'Morning',
                remarks: ''
              });
              setShowRejectionScanModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 border border-orange-500 text-orange-600 hover:bg-orange-50 rounded-xl text-xs font-bold transition shadow-sm"
          >
            <span>⚡</span>
            Scan Rejection
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 text-xs font-bold gap-4">
        {[
          { id: 'jobcards', name: 'Moulding Job Cards', count: jobCards.length },
          { id: 'moulds', name: 'Mould Master (Steel Tooling)', count: moulds.length },
          { id: 'machines', name: 'Machine Master (Press Registry)', count: machines.length },
          { id: 'purge', name: 'Purging Log Book', count: null },
          { id: 'nextstage', name: 'Trimming/QC Entry', count: null }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => { setActiveTab(t.id); setSelectedJobCard(null); setSelectedMouldId(null); setSelectedMachineId(null); setNextStageInwardInfo(null); }}
            className={`pb-3 px-1 transition border-b-2 flex items-center gap-2 ${
              activeTab === t.id ? 'border-orange-500 text-orange-500' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.name}
            {t.count !== null && (
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${activeTab === t.id ? 'bg-orange-100 text-orange-600' : 'bg-slate-200 text-slate-600'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Area 1: Job Cards */}
      {activeTab === 'jobcards' && !selectedJobCard && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50 flex-wrap gap-2">
            <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Active Moulding Job Cards</h3>
            <div className="flex items-center gap-3">
              <div className="relative flex items-center gap-1.5">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    placeholder="Scan Job Card QR (e.g. JC/2026/00002)..."
                    className="bg-white border border-slate-300 focus:border-orange-500 rounded-xl px-3 py-1.5 text-[10.5px] font-bold focus:outline-none w-64 text-slate-800 shadow-inner"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleScanJobCardQR(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    onBlur={e => {
                      if (e.target.value.trim()) {
                        handleScanJobCardQR(e.target.value.trim());
                        e.target.value = '';
                      }
                    }}
                  />
                  <span className="absolute right-3 text-[10px] text-slate-400">⚡</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenCameraScanner('jobcard')}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl text-slate-650 transition"
                  title="Scan using Camera"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>
              <span className="text-[10px] text-slate-400 font-bold bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg">Total: {jobCards.length}</span>
            </div>
          </div>

          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="px-6 py-3">JOB CARD NO</th>
                  <th className="px-6 py-3">PRODUCT</th>
                  <th className="px-6 py-3">MOULD & CAVITIES</th>
                  <th className="px-6 py-3">MACHINE</th>
                  <th className="px-6 py-3">COMPOUND BATCH</th>
                  <th className="px-6 py-3 text-right">TARGET QTY</th>
                  <th className="px-6 py-3 text-center">STATUS</th>
                  <th className="px-6 py-3 text-center">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {jobCards.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-10 text-slate-400">
                      No moulding job cards found. Click "Create Job Card" above to initialize a production run.
                    </td>
                  </tr>
                ) : (
                  jobCards.map(jc => (
                    <tr key={jc.jc_id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-800 block">{jc.jc_number}</span>
                        <span className="text-[10px] text-slate-400">{jc.wo_number}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-800 block">{jc.item_name}</span>
                        <span className="text-[10px] text-slate-400">{jc.customer_name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-800 block">{jc.mould_code}</span>
                        <span className="text-[10px] text-slate-400">{jc.cavities} Cavities ({jc.shots_required} Shots)</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-800 block">{jc.machine_name}</span>
                        <span className="text-[10px] text-slate-400">{jc.machine_code}</span>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-600">{jc.fb_number}</td>
                      <td className="px-6 py-4 text-right font-extrabold text-slate-800">{jc.planned_qty} pcs</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          jc.status === 'Pending' ? 'bg-slate-100 text-slate-500' :
                          jc.status === 'In Progress' ? 'bg-orange-100 text-orange-600' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {jc.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleJobCardSelect(jc)}
                            className="p-1 text-slate-500 hover:text-orange-500 transition"
                            title="Open Run Console"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {jc.status === 'Pending' && (
                            <button
                              onClick={() => handleStartJob(jc.jc_id)}
                              className="px-2.5 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold text-[10px] transition"
                            >
                              Start Run
                            </button>
                          )}
                          {jc.status === 'In Progress' && (
                            <button
                              onClick={() => handleJobCardSelect(jc)}
                              className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-[10px] transition"
                            >
                              Log Production
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Job Card Execution Console */}
      {activeTab === 'jobcards' && selectedJobCard && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Console Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header controls */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex justify-between items-center shadow-sm">
              <button
                onClick={() => setSelectedJobCard(null)}
                className="text-slate-500 hover:text-slate-800 text-xs font-bold flex items-center gap-1"
              >
                ← Back to List
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handlePrintJobCardPDF}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1"
                >
                  <Printer className="w-4 h-4" />
                  Print Job Card
                </button>
                {selectedJobCard.status === 'In Progress' && (
                  <button
                    onClick={() => handleCompleteJob(selectedJobCard.jc_id)}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition"
                  >
                    Complete Job
                  </button>
                )}
              </div>
            </div>

            {/* Shift logging form */}
            {selectedJobCard.status === 'In Progress' && (
              <form onSubmit={handleSaveProductionEntry} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-orange-500" />
                    Operator Shift Entry Form
                  </h3>
                  <p className="text-slate-400 text-xs">Record shots, accepted yields, and defect rejections below.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-medium">
                  <div>
                    <label className="block text-slate-450 uppercase text-[9.5px] font-bold mb-1">Select Shift</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                      value={prodEntry.shift}
                      onChange={e => setProdEntry(prev => ({ ...prev, shift: e.target.value }))}
                    >
                      {shifts.map(s => <option key={s} value={s}>{s} Shift</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-450 uppercase text-[9.5px] font-bold mb-1">Select Press Operator</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                      value={prodEntry.operator_id}
                      required
                      onChange={e => setProdEntry(prev => ({ ...prev, operator_id: e.target.value }))}
                    >
                      <option value="">-- Choose Operator --</option>
                      {operators.map(u => <option key={u.user_id} value={u.user_id}>{u.name} ({u.role})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-450 uppercase text-[9.5px] font-bold mb-1">Shots Completed</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 80"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2"
                      value={prodEntry.shots_completed}
                      onChange={e => handleShotsInput(e.target.value)}
                    />
                  </div>
                </div>

                {/* Rejection logger */}
                <div className="border-t border-slate-200 pt-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-xs text-slate-800">Quality Reject Logger</h4>
                    <span className="text-[10px] text-slate-450">Select defects to deduct from gross yield</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                    <div className="md:col-span-2 text-xs">
                      <label className="block text-slate-450 uppercase text-[9.5px] font-bold mb-1">Defect Reason</label>
                      <select id="defect-select-code" className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2">
                        {rejectionReasons.map(r => (
                          <option key={r.code} value={r.code}>{r.code} - {r.name} ({r.desc})</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        id="defect-select-qty"
                        placeholder="Qty"
                        defaultValue=""
                        className="w-20 bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs text-center"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const code = document.getElementById('defect-select-code').value;
                          const qty = document.getElementById('defect-select-qty').value;
                          handleAddDefectLine(code, qty);
                          document.getElementById('defect-select-qty').value = '';
                        }}
                        className="px-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {prodEntry.rejections.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5">
                      <p className="font-bold text-slate-800 text-[10px] uppercase">Logged Defects Check:</p>
                      {prodEntry.rejections.map(r => (
                        <div key={r.reason_code} className="flex justify-between items-center py-1 border-b border-slate-100 last:border-0">
                          <span className="font-medium text-slate-700">{r.name} ({r.reason_code})</span>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-red-600">{r.rejected_qty} pcs</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveDefectLine(r.reason_code)}
                              className="text-slate-400 hover:text-red-500 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Downtime logger */}
                <div className="border-t border-slate-200 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
                  <div>
                    <label className="block text-slate-450 uppercase text-[9.5px] font-bold mb-1">Downtime Duration (Minutes)</label>
                    <input
                      type="number"
                      placeholder="e.g. 30"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2"
                      value={prodEntry.downtime_minutes}
                      onChange={e => setProdEntry(prev => ({ ...prev, downtime_minutes: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-450 uppercase text-[9.5px] font-bold mb-1">Downtime Reason</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2"
                      value={prodEntry.downtime_reason}
                      onChange={e => setProdEntry(prev => ({ ...prev, downtime_reason: e.target.value }))}
                    >
                      <option value="">-- No Downtime --</option>
                      {downtimeReasons.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-4 flex justify-between items-center">
                  <div className="text-xs">
                    <p className="text-slate-450">Gross Parts Calculated: <strong className="text-slate-800">{(parseInt(prodEntry.shots_completed || 0) * (selectedJobCard?.cavities || 1))}</strong></p>
                    <p className="text-slate-450">Net Good Parts: <strong className="text-green-700">{prodEntry.good_parts || 0}</strong></p>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-md"
                  >
                    <Save className="w-4 h-4" />
                    Save Shift Entry
                  </button>
                </div>
              </form>
            )}

            {/* Run logs list */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
                <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Run Logs History</h3>
              </div>
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="px-6 py-3">SHIFT DATE</th>
                      <th className="px-6 py-3">SHIFT</th>
                      <th className="px-6 py-3">OPERATOR</th>
                      <th className="px-6 py-3 text-right">SHOTS DONE</th>
                      <th className="px-6 py-3 text-right">GOOD PARTS</th>
                      <th className="px-6 py-3 text-right">REJECTED</th>
                      <th className="px-6 py-3 text-right">DOWNTIME</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {jobCardEntries.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center py-10 text-slate-400">
                          No shift production runs recorded yet.
                        </td>
                      </tr>
                    ) : (
                      jobCardEntries.map(e => (
                        <tr key={e.entry_id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-3 text-slate-500">{new Date(e.entry_date).toLocaleDateString()}</td>
                          <td className="px-6 py-3 font-bold">{e.shift}</td>
                          <td className="px-6 py-3">{e.operator_name}</td>
                          <td className="px-6 py-3 text-right font-bold text-slate-700">{e.shots_completed}</td>
                          <td className="px-6 py-3 text-right font-bold text-green-700">{e.good_parts}</td>
                          <td className="px-6 py-3 text-right font-bold text-red-600">{e.rejected_parts}</td>
                          <td className="px-6 py-3 text-right text-slate-600">
                            {e.downtime_minutes > 0 ? `${e.downtime_minutes} min (${e.downtime_reason})` : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Job Card Details Column */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
              <div className="border-b border-slate-200 pb-3">
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-extrabold uppercase">
                  {selectedJobCard.status}
                </span>
                <h3 className="font-extrabold text-slate-800 text-sm mt-1">{selectedJobCard.jc_number}</h3>
                <p className="text-slate-400 text-xs">Work Order: {selectedJobCard.wo_number}</p>
              </div>

              {/* Progress Summary */}
              <div className="space-y-3 text-xs">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">Production Output Progress</h4>
                
                {jobCardSummary.entry_count > 0 ? (
                  <>
                    <div className="space-y-1">
                      <div className="flex justify-between font-bold text-slate-750">
                        <span>Good Yield</span>
                        <span>{jobCardSummary.total_good} / {selectedJobCard.planned_qty} pcs</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-green-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, (jobCardSummary.total_good / selectedJobCard.planned_qty) * 100)}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="space-y-1 pt-2">
                      <div className="flex justify-between font-bold text-slate-750">
                        <span>Shots Completed</span>
                        <span>{jobCardSummary.total_shots} / {selectedJobCard.shots_required} shots</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-orange-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, (jobCardSummary.total_shots / selectedJobCard.shots_required) * 100)}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 text-center text-[11px] font-bold">
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-2">
                        <span className="text-[9px] text-slate-400 block uppercase">Total Rejects</span>
                        <span className="text-sm text-red-600 mt-0.5 block">{jobCardSummary.total_rejected} pcs</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-2">
                        <span className="text-[9px] text-slate-400 block uppercase">Rejection Rate</span>
                        <span className="text-sm text-slate-700 mt-0.5 block">
                          {jobCardSummary.total_shots > 0
                            ? ((jobCardSummary.total_rejected / (jobCardSummary.total_shots * (selectedJobCard.cavities || 1))) * 100).toFixed(2)
                            : '0.00'}%
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                    <p className="text-slate-400 font-bold">No production data yet</p>
                    <p className="text-slate-350 text-[10px] mt-1">{selectedJobCard.status === 'In Progress' ? 'Log shift entries on the left to start tracking output.' : selectedJobCard.status === 'Pending' ? 'Start the job card first to begin recording production.' : 'This job card was completed without recorded shift entries.'}</p>
                  </div>
                )}
              </div>

              {/* Recipe instructions */}
              <div className="border-t border-slate-200 pt-4 space-y-3 text-xs">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">Moulding Parameters</h4>
                <div className="grid grid-cols-2 gap-3 bg-slate-50/50 rounded-2xl p-4 border border-slate-100">
                  <div>
                    <span className="text-[9px] text-slate-450 block uppercase">Temperature</span>
                    <span className="font-extrabold text-slate-700">{selectedJobCard.moulding_temp}°C</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-450 block uppercase">Hydraulic Pressure</span>
                    <span className="font-extrabold text-slate-700">{selectedJobCard.moulding_pressure} bar</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-450 block uppercase">Curing Time</span>
                    <span className="font-extrabold text-slate-700">{selectedJobCard.curing_time} minutes</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-450 block uppercase">Tool Cavities</span>
                    <span className="font-extrabold text-slate-700">{selectedJobCard.cavities} cavity</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-450 block uppercase">Preform Weight</span>
                    <span className="font-extrabold text-slate-700">{selectedJobCard.preform_weight_g || 150} g</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-450 block uppercase">Degassing Vents</span>
                    <span className="font-extrabold text-slate-700">{selectedJobCard.degassing_cycles || 2} cycles</span>
                  </div>
                </div>
              </div>

              {/* Mould Verification Scanner Card */}
              <div className="border-t border-slate-200 pt-4 space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">Mould Platen Verification</h4>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                    mouldVerified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700 animate-pulse'
                  }`}>
                    {mouldVerified ? 'Verified ✅' : 'Required ⚠️'}
                  </span>
                </div>
                <div className="border border-slate-200 border-dashed rounded-2xl p-4 bg-slate-50 space-y-3">
                  {mouldVerified ? (
                    <div className="text-center py-1 space-y-1">
                      <p className="font-extrabold text-green-700 text-xs">Mould Loaded Correctly</p>
                      <p className="text-[10px] text-slate-500 font-medium">Tool: {selectedJobCard.mould_name} ({selectedJobCard.mould_code})</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[10px] text-slate-450 font-medium">Scan the QR/Barcode on physical mould box to confirm fitment:</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Scan Mould Barcode..."
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-[11px] font-bold focus:outline-none focus:border-orange-500"
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleVerifyMouldBarcode(e.target.value);
                              e.target.value = '';
                            }
                          }}
                          onBlur={e => {
                            if (e.target.value.trim()) {
                              handleVerifyMouldBarcode(e.target.value.trim());
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleOpenCameraScanner('mould_verify')}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl text-slate-650 transition flex items-center justify-center"
                          title="Scan using Camera"
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>



          </div>
        </div>
      )}

      {/* Tab Area 4: Machine Master list */}
      {activeTab === 'machines' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Machine List Column */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Moulding Press Machine Master Registry</h3>
                <p className="text-[9.5px] text-slate-400 mt-0.5">Total Presses: {machines.length}</p>
              </div>
              <button
                onClick={() => setShowNewMachineModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[10.5px] font-bold transition shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Register Press
              </button>
            </div>
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="px-6 py-3">MACHINE CODE</th>
                    <th className="px-6 py-3">MACHINE NAME</th>
                    <th className="px-6 py-3">TYPE</th>
                    <th className="px-6 py-3 text-center">TONNAGE</th>
                    <th className="px-6 py-3 text-center">PLATEN SIZE</th>
                    <th className="px-6 py-3 text-center">DAYLIGHTS</th>
                    <th className="px-6 py-3">HEATING TYPE</th>
                    <th className="px-6 py-3">MAX TEMP / PRESSURE</th>
                    <th className="px-6 py-3 text-center">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-750">
                  {machines.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="text-center py-10 text-slate-400 font-bold">
                        No machines registered.
                      </td>
                    </tr>
                  ) : (
                    machines.map(m => (
                      <tr 
                        key={m.machine_id} 
                        className={`hover:bg-slate-50/50 cursor-pointer transition border-l-2 ${selectedMachineId === m.machine_id ? 'bg-orange-50/30 border-orange-500' : 'border-transparent'}`}
                        onClick={() => setSelectedMachineId(m.machine_id)}
                      >
                        <td className="px-6 py-4 font-bold text-slate-800">{m.machine_code}</td>
                        <td className="px-6 py-4">{m.machine_name}</td>
                        <td className="px-6 py-4 font-bold text-orange-600">{m.moulding_type || m.machine_type}</td>
                        <td className="px-6 py-4 text-center font-bold">{m.capacity_tons || '—'} Ton</td>
                        <td className="px-6 py-4 text-center">{m.platen_length && m.platen_width ? `${m.platen_length} × ${m.platen_width} mm` : '—'}</td>
                        <td className="px-6 py-4 text-center">{m.daylights || 1} level</td>
                        <td className="px-6 py-4">{m.heating_type || 'Electric'}</td>
                        <td className="px-6 py-4">{m.max_temperature || 200}°C / {m.max_pressure || 200} Bar</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            m.status === 'Running' || m.status === 'Active' ? 'bg-green-100 text-green-700' :
                            m.status === 'Idle' ? 'bg-slate-100 text-slate-600' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Machine Detail Column */}
          <div className="lg:col-span-1">
            {selectedMachineId ? (() => {
              const m = machines.find(mac => mac.machine_id === selectedMachineId);
              if (!m) return null;
              
              const activeJob = jobCards.find(jc => jc.machine_id === m.machine_id && jc.status === 'In Progress');
              const machinePurges = purgeHistory.filter(p => p.machine_id === m.machine_id);

              return (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm animate-in fade-in duration-200">
                  <div className="border-b border-slate-200 pb-4 flex justify-between items-start">
                    <div>
                      <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-600 text-[10px] font-extrabold uppercase tracking-wide">
                        {m.moulding_type || m.machine_type} Press
                      </span>
                      <h3 className="font-extrabold text-slate-800 text-sm mt-1.5">{m.machine_name}</h3>
                      <p className="text-slate-455 text-xs font-bold">Code: {m.machine_code}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      m.status === 'Running' || m.status === 'Active' ? 'bg-green-100 text-green-700' :
                      m.status === 'Idle' ? 'bg-slate-100 text-slate-600' : 'bg-red-100 text-red-700'
                    }`}>
                      {m.status}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Technical Specifications</span>
                    <div className="grid grid-cols-2 gap-3 text-[11px] font-bold text-slate-700">
                      <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-2.5">
                        <span className="text-slate-450 block text-[8px] uppercase">Press Tonnage</span>
                        <span className="text-slate-800 mt-0.5 block text-xs">{m.capacity_tons || '—'} Tons</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-2.5">
                        <span className="text-slate-450 block text-[8px] uppercase">Platen Size</span>
                        <span className="text-slate-800 mt-0.5 block text-xs">{m.platen_length && m.platen_width ? `${m.platen_length} × ${m.platen_width} mm` : '—'}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-2.5">
                        <span className="text-slate-455 block text-[8px] uppercase">Daylight Levels</span>
                        <span className="text-slate-800 mt-0.5 block text-xs">{m.daylights || 1} level</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-2.5">
                        <span className="text-slate-455 block text-[8px] uppercase">Heating Method</span>
                        <span className="text-slate-800 mt-0.5 block text-xs">{m.heating_type || 'Electric'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-4 space-y-2">
                    <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Live Production Status</span>
                    {activeJob ? (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-3.5 space-y-2 text-xs font-semibold text-slate-700">
                        <div className="flex justify-between">
                          <span className="text-[10px] text-green-700 font-extrabold uppercase">Running Job Card</span>
                          <span className="text-green-800 font-extrabold">{activeJob.jc_number}</span>
                        </div>
                        <div className="space-y-1">
                          <span className="text-slate-800 block text-xs font-extrabold">{activeJob.item_name}</span>
                          <div className="flex justify-between text-[10px] text-slate-450">
                            <span>Planned: {activeJob.planned_qty} Pcs</span>
                            <span>Mould: {activeJob.mould_code}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center text-slate-400 font-bold text-[10px] py-4">
                        No active moulding production running.
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-200 pt-4 space-y-3">
                    <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Recent Purges ({machinePurges.length})</span>
                    {machinePurges.length === 0 ? (
                      <p className="text-[10px] text-slate-400 font-bold text-center py-2">No purge history recorded for this press.</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {machinePurges.slice(0, 3).map(p => (
                          <div key={p.purge_id} className="border border-slate-100 hover:border-slate-200 rounded-xl p-2.5 flex justify-between items-center text-[10.5px]">
                            <div>
                              <span className="font-bold text-slate-850 block">{p.purge_reason}</span>
                              <span className="text-[9px] text-slate-400 font-medium">{new Date(p.purge_date).toLocaleDateString()}</span>
                            </div>
                            <span className="font-extrabold text-orange-600">{parseFloat(p.quantity_kg).toFixed(3)} Kg</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })() : (
              <div className="bg-white border border-slate-200 border-dashed rounded-2xl p-8 text-center text-slate-455 text-xs flex flex-col items-center justify-center h-64 shadow-sm">
                <BarChart2 className="w-10 h-10 text-slate-355 mb-2" />
                <p className="font-extrabold text-slate-700">No Press Selected</p>
                <p className="text-slate-400 text-[10.5px] mt-1.5 max-w-[200px] mx-auto">Click on any press machine in the registry table to view technical specifications, current active job cards, and purge OEE history logs.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Area 2: Mould Master list */}
      {activeTab === 'moulds' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Mould List Column */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
              <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Mould Registry Directory</h3>
            </div>
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="px-6 py-3">MOULD CODE</th>
                    <th className="px-6 py-3">NAME & SPEC</th>
                    <th className="px-6 py-3">CAVITIES</th>
                    <th className="px-6 py-3">SHOTS USED / LIMIT</th>
                    <th className="px-6 py-3 text-center">STATUS</th>
                    <th className="px-6 py-3 text-center">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {moulds.map(mld => {
                    const ratio = mld.shots_used / mld.total_shots_allowed;
                    const dueSoon = mld.shots_used >= mld.maintenance_due_shots;
                    return (
                      <tr
                        key={mld.mould_id}
                        className={`hover:bg-slate-50/50 cursor-pointer ${selectedMouldId === mld.mould_id ? 'bg-orange-50/30' : ''}`}
                        onClick={() => handleMouldSelect(mld.mould_id)}
                      >
                        <td className="px-6 py-4">
                          <span className="font-bold text-slate-800 block">{mld.mould_code}</span>
                          <span className="text-[10px] text-slate-400">{mld.mould_material}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-slate-800 block">{mld.mould_name}</span>
                          <span className="text-[10px] text-slate-400">{mld.item_code}</span>
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-700">{mld.cavities} cavities</td>
                        <td className="px-6 py-4">
                          <div className="space-y-1 w-32">
                            <span className="font-bold text-slate-700 block text-[10px]">
                              {mld.shots_used.toLocaleString()} / {mld.total_shots_allowed.toLocaleString()}
                            </span>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${dueSoon ? 'bg-red-500' : 'bg-green-600'}`}
                                style={{ width: `${Math.min(100, ratio * 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            mld.status === 'Available' ? 'bg-green-100 text-green-700' :
                            mld.status === 'Under Maintenance' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {mld.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                const pw = window.open('', '_blank');
                                
                                const mouldQrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=' + encodeURIComponent(mld.mould_code);
                                const mouldBcUrl = 'https://bwipjs-api.metafloor.com/?bcid=code128&text=' + encodeURIComponent(mld.mould_code) + '&scale=2&rotate=N&includetext=false';
                                
                                pw.document.write(`
                                  <html>
                                  <head>
                                    <title>Mould Tag - ${mld.mould_code}</title>
                                    <style>
                                      * { box-sizing: border-box; margin: 0; padding: 0; }
                                      body { font-family: Arial, sans-serif; padding: 20px; text-align: center; }
                                      .tag { border: 2px dashed #000; padding: 16px; border-radius: 8px; max-width: 320px; margin: auto; }
                                      .title { font-weight: 900; font-size: 16px; margin: 0; letter-spacing: 1px; }
                                      .subtitle { font-size: 9px; text-transform: uppercase; color: #555; margin: 2px 0 12px; letter-spacing: 1px; font-weight: bold; }
                                      
                                      .barcodes-row { display: flex; justify-content: center; gap: 16px; align-items: center; margin: 12px 0 16px; }
                                      .bc-box { border: 1px solid #ccc; padding: 4px; border-radius: 4px; }
                                      .bc-label { font-size: 8px; font-weight: bold; color: #444; margin-bottom: 4px; letter-spacing: 0.5px; }
                                      
                                      .info { text-align: left; font-size: 11px; border-top: 1px solid #ddd; padding-top: 12px; }
                                      .row { display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding: 4px 0; }
                                      .row:last-child { border-bottom: none; }
                                      .row span { color: #666; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
                                      .row strong { font-weight: bold; font-size: 12px; color: #000; }
                                      
                                      @media print { body { padding: 0; } }
                                    </style>
                                  </head>
                                  <body>
                                    <div class="tag">
                                      <h2 class="title">JAYASHREE POLYMERS</h2>
                                      <p class="subtitle">Steel Mould Tooling Tag</p>
                                      
                                      <div class="barcodes-row">
                                        <div>
                                          <div class="bc-label">QR CODE SCAN</div>
                                          <div class="bc-box"><img src="${mouldQrUrl}" style="width:70px;height:70px;display:block;" /></div>
                                        </div>
                                        <div>
                                          <div class="bc-label">BARCODE SCAN</div>
                                          <div class="bc-box" style="padding: 10px 4px;">
                                            <img src="${mouldBcUrl}" style="height:46px;display:block;" />
                                            <div style="font-size:10px; font-weight:bold; letter-spacing:1.5px; margin-top:2px;">${mld.mould_code}</div>
                                          </div>
                                        </div>
                                      </div>
                                      
                                      <div class="info">
                                        <div class="row"><span>Mould ID:</span><strong>${mld.mould_code}</strong></div>
                                        <div class="row"><span>Mould Name:</span><strong>${mld.mould_name}</strong></div>
                                        <div class="row"><span>Cavities:</span><strong>${mld.cavities}</strong></div>
                                        <div class="row"><span>Type:</span><strong>${mld.mould_type}</strong></div>
                                        <div class="row"><span>Material:</span><strong>${mld.mould_material}</strong></div>
                                      </div>
                                    </div>
                                    <script>window.onload=function(){window.print();setTimeout(function(){window.close();},500);};</script>
                                  </body>
                                  </html>
                                `);
                                pw.document.close();
                              }}
                              className="p-1.5 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg text-orange-600 transition flex-shrink-0"
                              title="Print Mould Barcode Tag"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mould Detail / Maintenance History Column */}
          <div className="lg:col-span-1">
            {mouldDetail ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
                <div className="border-b border-slate-200 pb-4 flex justify-between items-start">
                  <div>
                    <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-600 text-[10px] font-extrabold uppercase tracking-wide">
                      {mouldDetail.mould.mould_type}
                    </span>
                    <h3 className="font-extrabold text-slate-800 text-sm mt-1.5">{mouldDetail.mould.mould_name}</h3>
                    <p className="text-slate-450 text-xs font-semibold">Mould ID: {mouldDetail.mould.mould_code}</p>
                    {/* Live Barcode Preview */}
                    <div className="mt-3 p-2 bg-slate-50 border border-slate-200 rounded-xl text-center">
                      <img
                        src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(mouldDetail.mould.mould_code)}&scale=2&rotate=N&includetext=true`}
                        alt={mouldDetail.mould.mould_code}
                        className="h-8 object-contain mx-auto"
                      />
                      <p className="text-[8px] text-slate-400 font-bold mt-1 uppercase tracking-wider">Scan this to auto-select mould</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    mouldDetail.mould.status === 'Available' ? 'bg-green-100 text-green-700' :
                    mouldDetail.mould.status === 'Under Maintenance' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {mouldDetail.mould.status}
                  </span>
                </div>

                {/* Associated Product */}
                <div className="space-y-1 text-xs">
                  <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Associated Product</span>
                  <span className="font-extrabold text-slate-800 block text-[12.5px]">{mouldDetail.mould.item_name}</span>
                  <span className="text-[10px] text-slate-400 font-bold">Code: {mouldDetail.mould.item_code}</span>
                </div>

                {/* Progress bar to threshold */}
                <div className="space-y-2 text-xs border-t border-slate-200 pt-4">
                  <div className="flex justify-between font-bold text-slate-750">
                    <span>Tooling Shots Progress</span>
                    <span>{((mouldDetail.mould.shots_used / mouldDetail.mould.total_shots_allowed) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        mouldDetail.mould.shots_used >= mouldDetail.mould.maintenance_due_shots ? 'bg-red-500 animate-pulse' : 'bg-green-600'
                      }`}
                      style={{ width: `${Math.min(100, (mouldDetail.mould.shots_used / mouldDetail.mould.total_shots_allowed) * 100)}%` }}
                    ></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-[9.5px] font-bold pt-1.5">
                    <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-2">
                      <span className="text-slate-400 block text-[8px] uppercase">Shots Used</span>
                      <span className="text-slate-850 mt-0.5 block text-xs">{mouldDetail.mould.shots_used.toLocaleString()}</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-2">
                      <span className="text-slate-400 block text-[8px] uppercase">Remaining</span>
                      <span className="text-green-700 mt-0.5 block text-xs">{(mouldDetail.mould.total_shots_allowed - mouldDetail.mould.shots_used).toLocaleString()}</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-2">
                      <span className="text-slate-400 block text-[8px] uppercase">Max Limit</span>
                      <span className="text-slate-850 mt-0.5 block text-xs">{mouldDetail.mould.total_shots_allowed.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Alert Warning for Maintenance */}
                {mouldDetail.mould.shots_used >= mouldDetail.mould.maintenance_due_shots && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2 text-xs text-red-950">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <div>
                      <p className="font-bold">Maintenance Overdue!</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">This tool has crossed its servicing threshold ({mouldDetail.mould.maintenance_due_shots.toLocaleString()} shots). Stop production and send to maintenance shop.</p>
                    </div>
                  </div>
                )}

                {/* Technical Specifications */}
                <div className="space-y-2 text-xs border-t border-slate-200 pt-4">
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">Technical Specifications</h4>
                  <div className="grid grid-cols-2 gap-2.5 bg-slate-50/50 border border-slate-100 rounded-2xl p-4">
                    <div>
                      <span className="text-[9px] text-slate-400 block uppercase">Cavities</span>
                      <span className="font-bold text-slate-700">{mouldDetail.mould.cavities} cavities</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block uppercase">Tool Weight</span>
                      <span className="font-bold text-slate-700">{mouldDetail.mould.weight_kg} Kg</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block uppercase">Material Grade</span>
                      <span className="font-bold text-slate-700">{mouldDetail.mould.mould_material}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 block uppercase">Platen Size (L×W×H)</span>
                      <span className="font-bold text-slate-700 block">
                        {mouldDetail.mould.platen_length} × {mouldDetail.mould.platen_width} × {mouldDetail.mould.platen_height || 150} mm
                      </span>
                    </div>
                  </div>
                </div>

                {/* Maintenance Log History */}
                <div className="space-y-3 border-t border-slate-200 pt-4 text-xs">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">Servicing Logs</h4>
                    <button
                      onClick={() => setShowMaintenanceModal(true)}
                      className="text-orange-500 hover:text-orange-600 font-bold text-[10.5px] flex items-center gap-0.5"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      Log Service
                    </button>
                  </div>

                  <div className="space-y-2">
                    {mouldDetail.maintenanceHistory.length === 0 ? (
                      <p className="text-slate-400 text-center py-2 italic">No maintenance history recorded.</p>
                    ) : (
                      mouldDetail.maintenanceHistory.map(h => (
                        <div key={h.log_id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
                          <div className="flex justify-between items-center font-bold">
                            <span className="text-slate-750">{h.maintenance_type}</span>
                            <span className="text-slate-450 text-[10px]">{new Date(h.maintenance_date).toLocaleDateString()}</span>
                          </div>
                          <p className="text-slate-600 text-[10.5px]">Remarks: {h.remarks || 'None'}</p>
                          <div className="flex justify-between text-[9px] text-slate-400 pt-1">
                            <span>Operator: {h.done_by}</span>
                            <span>Shots logged: {h.shots_at_maintenance.toLocaleString()}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-400 shadow-sm flex flex-col justify-center items-center py-20 space-y-2">
                <HelpCircle className="w-8 h-8 text-slate-300" />
                <p className="font-bold">No Mould Selected</p>
                <p>Click any mould row on the left to inspect platen bounds, specifications, and servicing logs.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Area 3: Purge Log Book */}
      {activeTab === 'purge' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <form onSubmit={handleSavePurgeLog} className="md:col-span-1 bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm text-xs font-medium">
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                <Ban className="w-4 h-4 text-orange-500" />
                Log Purge Run
              </h3>
              <p className="text-slate-400 text-xs">Record press purging details for OEE tracking.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-slate-450 uppercase text-[9.5px] font-bold mb-1">Select Machine</label>
                <select
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                  value={purgeEntry.machine_id}
                  required
                  onChange={e => setPurgeEntry(prev => ({ ...prev, machine_id: e.target.value }))}
                >
                  <option value="">-- Choose Machine --</option>
                  {machines.map(m => <option key={m.machine_id} value={m.machine_id}>{m.machine_name} ({m.machine_code})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-slate-450 uppercase text-[9.5px] font-bold mb-1">Select Operator</label>
                <select
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                  value={purgeEntry.operator_id}
                  required
                  onChange={e => setPurgeEntry(prev => ({ ...prev, operator_id: e.target.value }))}
                >
                  <option value="">-- Choose Operator --</option>
                  {operators.map(u => <option key={u.user_id} value={u.user_id}>{u.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-slate-450 uppercase text-[9.5px] font-bold mb-1">Purge Reason</label>
                <select
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                  value={purgeEntry.purge_reason}
                  onChange={e => setPurgeEntry(prev => ({ ...prev, purge_reason: e.target.value }))}
                >
                  <option value="End of Shift">End of Shift</option>
                  <option value="Compound Change">Compound Change</option>
                  <option value="Machine Restart">Machine Restart</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-450 uppercase text-[9.5px] font-bold mb-1">Compound Used</label>
                <input
                  type="text"
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2"
                  value={purgeEntry.compound_used}
                  onChange={e => setPurgeEntry(prev => ({ ...prev, compound_used: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-slate-450 uppercase text-[9.5px] font-bold mb-1">Quantity Purged (Kg)</label>
                <input
                  type="number"
                  step="0.001"
                  required
                  placeholder="e.g. 1.250"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2"
                  value={purgeEntry.quantity_kg}
                  onChange={e => setPurgeEntry(prev => ({ ...prev, quantity_kg: e.target.value }))}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shadow-md"
              >
                <Save className="w-4 h-4" />
                Record Purge
              </button>
            </div>
          </form>

          <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="font-extrabold text-slate-800 text-sm">Purging Waste & OEE History</h3>
            <p className="text-slate-400 text-xs">Purges deduct compound raw material and record required downtime logs.</p>
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="px-6 py-3">MACHINE</th>
                    <th className="px-6 py-3">DATE / TIME</th>
                    <th className="px-6 py-3">OPERATOR</th>
                    <th className="px-6 py-3">PURGE REASON</th>
                    <th className="px-6 py-3">COMPOUND</th>
                    <th className="px-6 py-3 text-right">QUANTITY (KG)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {purgeHistory.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-10 text-slate-400 font-semibold">
                        No purge records recorded yet.
                      </td>
                    </tr>
                  ) : (
                    purgeHistory.map(h => (
                      <tr 
                        key={h.purge_id} 
                        className="hover:bg-slate-50/50 cursor-pointer transition border-l-2 border-transparent hover:border-orange-500"
                        onClick={() => {
                          setSelectedPurgeDetail(h);
                          setShowPurgeDetailModal(true);
                        }}
                      >
                        <td className="px-6 py-3">
                          <span className="font-bold text-slate-800 block">{h.machine_code}</span>
                          <span className="text-[9.5px] text-slate-400 font-normal block">{h.machine_name}</span>
                        </td>
                        <td className="px-6 py-3 text-slate-500">
                          {new Date(h.purge_date).toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-slate-700">
                          {h.operator_name || 'System'}
                        </td>
                        <td className="px-6 py-3 font-bold text-orange-600">
                          {h.purge_reason}
                        </td>
                        <td className="px-6 py-3 text-slate-600">
                          {h.compound_used}
                        </td>
                        <td className="px-6 py-3 text-right font-extrabold text-slate-800">
                          {parseFloat(h.quantity_kg).toFixed(3)} Kg
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab Area 5: Trimming / QC Stage Entry */}
      {activeTab === 'nextstage' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Scan panel */}
          <div className="md:col-span-1 bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm text-xs font-medium">
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-orange-500 flex items-center justify-center text-[9px] text-white font-bold">1</span>
                Scan Moulded WIP Batch
              </h3>
              <p className="text-slate-400 text-xs mt-0.5">Scan the barcode label from the moulding output tray to log next stage entry.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-slate-455 uppercase text-[9.5px] font-bold mb-1">Moulded Batch Barcode</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Scan WIP Barcode (WIP-JC-xxxxx)..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold uppercase focus:outline-none focus:border-orange-500"
                    value={nextStageBarcode}
                    onChange={e => setNextStageBarcode(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleLookupWipForNextStage(nextStageBarcode);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleOpenCameraScanner('nextstage')}
                    className="px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition flex items-center justify-center shadow-md"
                    title="Open Camera Scanner"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleLookupWipForNextStage(nextStageBarcode)}
                disabled={!nextStageBarcode || loading}
                className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shadow-md"
              >
                <Search className="w-4 h-4" />
                {loading ? 'Searching...' : 'Lookup Batch'}
              </button>
            </div>
          </div>

          {/* Details & Inwarding panel */}
          <div className="md:col-span-2 space-y-6">
            {nextStageInwardInfo ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm animate-in fade-in duration-200">
                <div className="border-b border-slate-200 pb-4 flex justify-between items-start">
                  <div>
                    <span className="px-2 py-0.5 rounded bg-green-50 text-green-700 text-[10px] font-extrabold uppercase tracking-wide">
                      Moulding Completed
                    </span>
                    <h3 className="font-extrabold text-slate-800 text-sm mt-1.5">Batch details found in database</h3>
                    <p className="text-slate-455 text-xs font-bold">WIP Label: {nextStageInwardInfo.batch_number}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    qcSuccessReportNumber ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {qcSuccessReportNumber ? 'QC Inspection Passed' : 'Pending Trimming/QC Inward'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-700">
                  <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/50">
                    <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider mb-1">Target Product</span>
                    <span className="font-extrabold text-slate-800 block text-xs">{nextStageInwardInfo.item_name}</span>
                    <span className="text-[10px] text-slate-400 font-bold">Code: {nextStageInwardInfo.item_code}</span>
                  </div>

                  <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/50">
                    <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider mb-1">Moulded Quantity</span>
                    <span className="font-black text-orange-600 block text-sm">{nextStageInwardInfo.quantity} PCS</span>
                    <span className="text-[10px] text-slate-400 font-bold">Ready for Trimming</span>
                  </div>

                  <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/50">
                    <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider mb-1">Press Machine used</span>
                    <span className="font-extrabold text-slate-800 block text-xs">{nextStageInwardInfo.machine_name || 'Moulding Press'}</span>
                    <span className="text-[10px] text-slate-400 font-bold">ID: {nextStageInwardInfo.machine_code || '-'}</span>
                  </div>

                  <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/50">
                    <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider mb-1">Timestamp</span>
                    <span className="font-extrabold text-slate-800 block text-xs">{new Date(nextStageInwardInfo.created_at).toLocaleDateString()}</span>
                    <span className="text-[10px] text-slate-400">{new Date(nextStageInwardInfo.created_at).toLocaleTimeString()}</span>
                  </div>
                </div>

                {/* Workflow step flowchart */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-around text-center text-xs">
                  <div className="space-y-1">
                    <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold mx-auto">✓</div>
                    <span className="font-extrabold text-slate-700 block">1. Moulding Done</span>
                  </div>
                  <div className="flex-1 max-w-[80px] h-[2px] bg-green-500"></div>
                  
                  <div className="space-y-1">
                    {showQcReportForm || qcSuccessReportNumber ? (
                      <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold mx-auto">✓</div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold mx-auto animate-pulse">2</div>
                    )}
                    <span className={`font-extrabold block ${showQcReportForm || qcSuccessReportNumber ? 'text-slate-700' : 'text-orange-600 animate-pulse'}`}>
                      2. Trimming & QC Entry
                    </span>
                  </div>
                  <div className={`flex-1 max-w-[80px] h-[2px] ${showQcReportForm || qcSuccessReportNumber ? 'bg-orange-500 animate-pulse' : 'bg-slate-200'}`}></div>
                  
                  <div className="space-y-1">
                    {qcSuccessReportNumber ? (
                      <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold mx-auto">✓</div>
                    ) : showQcReportForm ? (
                      <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold mx-auto animate-pulse">3</div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-bold mx-auto">3</div>
                    )}
                    <span className={`font-bold block ${
                      qcSuccessReportNumber ? 'text-slate-700 font-extrabold' :
                      showQcReportForm ? 'text-orange-600 font-extrabold animate-pulse' : 'text-slate-400'
                    }`}>
                      3. In-Process QC Report
                    </span>
                  </div>
                </div>

                {/* Step 3: Inline In-Process QC Report Form */}
                {showQcReportForm && (
                  <form onSubmit={handleSubmitNextStageQcReport} className="border-t border-slate-200 pt-6 space-y-4 animate-in fade-in duration-200">
                    <div className="bg-orange-50/50 border border-orange-200/50 rounded-2xl p-4">
                      <h4 className="font-extrabold text-orange-700 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                        📝 Fill In-Process QC inspection report
                      </h4>
                      <p className="text-slate-500 text-[10.5px] mt-0.5 font-bold">Please test parts and record the accepted / rejected quantity below.</p>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-slate-450 uppercase text-[9.5px] font-bold mb-1">Total Inspected</label>
                        <input
                          type="number"
                          disabled
                          className="w-full bg-slate-100 border border-slate-250 rounded-xl p-2.5 font-extrabold text-slate-600"
                          value={nextStageInwardInfo.quantity}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-slate-450 uppercase text-[9.5px] font-bold mb-1">Accepted Qty</label>
                        <input
                          type="number"
                          required
                          min="0"
                          max={nextStageInwardInfo.quantity}
                          className="w-full bg-white border border-slate-350 focus:border-orange-500 rounded-xl p-2.5 font-extrabold text-slate-800"
                          value={qcAcceptedQty}
                          onChange={e => {
                            const val = parseFloat(e.target.value || 0);
                            setQcAcceptedQty(e.target.value);
                            setQcRejectedQty(Math.max(0, parseFloat(nextStageInwardInfo.quantity || 0) - val));
                          }}
                        />
                      </div>

                      <div>
                        <label className="block text-slate-455 uppercase text-[9.5px] font-bold mb-1">Rejected Qty</label>
                        <input
                          type="number"
                          required
                          min="0"
                          max={nextStageInwardInfo.quantity}
                          className="w-full bg-slate-50 border border-slate-350 rounded-xl p-2.5 font-extrabold text-red-600"
                          value={qcRejectedQty}
                          onChange={e => {
                            const val = parseFloat(e.target.value || 0);
                            setQcRejectedQty(e.target.value);
                            setQcAcceptedQty(Math.max(0, parseFloat(nextStageInwardInfo.quantity || 0) - val));
                          }}
                        />
                      </div>
                    </div>

                    {/* Defect details if rejected quantity is greater than 0 */}
                    {parseFloat(qcRejectedQty || 0) > 0 && (
                      <div className="grid grid-cols-2 gap-4 border border-red-100 bg-red-50/20 rounded-2xl p-4 animate-in fade-in duration-200">
                        <div>
                          <label className="block text-red-700 uppercase text-[9.5px] font-bold mb-1">Defect Category</label>
                          <select
                            required
                            className="w-full bg-white border border-red-300 rounded-xl p-2.5 font-bold text-slate-800 focus:outline-none"
                            value={qcDefectType}
                            onChange={e => setQcDefectType(e.target.value)}
                          >
                            <option value="">-- Choose Defect --</option>
                            <option value="Air Trap">Air Trap</option>
                            <option value="Slab Flashes">Slab Flashes</option>
                            <option value="Mould Sticky">Mould Sticky</option>
                            <option value="Under Cured">Under Cured</option>
                            <option value="Under Weight">Under Weight</option>
                            <option value="Mould Burn">Mould Burn</option>
                            <option value="Dimensional Mismatch">Dimensional Mismatch</option>
                            <option value="Other Defect">Other Defect</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-red-700 uppercase text-[9.5px] font-bold mb-1">Defect Severity</label>
                          <select
                            required
                            className="w-full bg-white border border-red-300 rounded-xl p-2.5 font-bold text-slate-800 focus:outline-none"
                            value={qcSeverity}
                            onChange={e => setQcSeverity(e.target.value)}
                          >
                            <option value="Minor">Minor</option>
                            <option value="Major">Major</option>
                            <option value="Critical">Critical</option>
                          </select>
                        </div>

                        <div className="col-span-2">
                          <label className="block text-red-700 uppercase text-[9.5px] font-bold mb-1">Defect description & Root Cause</label>
                          <textarea
                            rows="2"
                            placeholder="Enter notes on defect observations..."
                            className="w-full bg-white border border-red-300 rounded-xl p-2.5 focus:outline-none"
                            value={qcDefectDesc}
                            onChange={e => setQcDefectDesc(e.target.value)}
                          ></textarea>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-slate-455 uppercase text-[9.5px] font-bold mb-1">General QC Remarks</label>
                      <textarea
                        rows="2"
                        placeholder="Add inspection notes (curing check, visual check, hardness, etc.)..."
                        className="w-full bg-slate-50 border border-slate-350 rounded-xl p-2.5 focus:outline-none"
                        value={qcRemarks}
                        onChange={e => setQcRemarks(e.target.value)}
                      ></textarea>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => { setShowQcReportForm(false); }}
                        className="px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-xl font-bold transition text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition flex items-center gap-1.5 shadow-md text-xs"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Submit QC Report
                      </button>
                    </div>
                  </form>
                )}

                {/* QC success banner */}
                {qcSuccessReportNumber && (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center space-y-3 animate-in fade-in duration-200">
                    <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto" />
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-sm">QC Inspection Report Submitted!</h4>
                      <p className="text-[11px] text-slate-500 mt-1">Inspection report has been saved under code: <strong className="text-slate-800">{qcSuccessReportNumber}</strong>.</p>
                      <p className="text-[11px] text-slate-500">The batch status has been updated and released to downstream stages.</p>
                    </div>
                  </div>
                )}

                {/* Footer action buttons */}
                {!showQcReportForm && !qcSuccessReportNumber && (
                  <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                    <button
                      type="button"
                      onClick={() => { setNextStageBarcode(''); setNextStageInwardInfo(null); }}
                      className="px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-xl font-bold transition text-xs"
                    >
                      Clear Search
                    </button>
                    <button
                      type="button"
                      onClick={handleInwardToNextStage}
                      disabled={loading}
                      className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition flex items-center gap-1.5 shadow-md text-xs"
                    >
                      <Save className="w-4 h-4 text-orange-500" />
                      Inward to Trimming & QC
                    </button>
                  </div>
                )}

                {qcSuccessReportNumber && (
                  <div className="flex justify-end pt-4 border-t border-slate-250">
                    <button
                      type="button"
                      onClick={() => {
                        setNextStageBarcode('');
                        setNextStageInwardInfo(null);
                        setShowQcReportForm(false);
                        setQcSuccessReportNumber(null);
                      }}
                      className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition text-xs shadow-md"
                    >
                      Scan Next Batch
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white border border-slate-200 border-dashed rounded-2xl p-10 text-center text-slate-400 text-xs flex flex-col items-center justify-center h-64 shadow-sm animate-in fade-in duration-200">
                <Search className="w-12 h-12 text-slate-300 mb-2" />
                <p className="font-bold text-slate-700">Scan Moulded Batch Barcode to Begin</p>
                <p className="text-slate-400 text-[10.5px] mt-1.5 max-w-[280px]">When a job is completed, a WIP label (e.g. `WIP-JC-xxxxx`) is generated. Use your barcode scanner or camera to read it, then verify details and inward it to the Trimming & QC stage.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal 1: Register New Steel Mould */}
      {showNewMouldModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-extrabold text-slate-800 text-sm">Register Steel Mould Tooling</h3>
              <button onClick={() => setShowNewMouldModal(false)} className="text-slate-400 hover:text-slate-600 transition">✕</button>
            </div>
            <form onSubmit={handleCreateMould} className="p-6 space-y-4 text-xs font-medium">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Mould Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MLD/04"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                    value={newMould.mould_code}
                    onChange={e => setNewMould(prev => ({ ...prev, mould_code: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Mould Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Oil Seal Mould 45mm"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                    value={newMould.mould_name}
                    onChange={e => setNewMould(prev => ({ ...prev, mould_name: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Product Finished Good</label>
                  <select
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                    value={newMould.item_id}
                    onChange={e => setNewMould(prev => ({ ...prev, item_id: e.target.value }))}
                  >
                    <option value="">-- Choose FG Item --</option>
                    {finishedItems.map(i => <option key={i.item_id} value={i.item_id}>{i.item_name} ({i.item_code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Mould Type</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                    value={newMould.mould_type}
                    onChange={e => setNewMould(prev => ({ ...prev, mould_type: e.target.value }))}
                  >
                    <option value="Compression">Compression Mould</option>
                    <option value="Transfer">Transfer Mould</option>
                    <option value="Injection">Injection Mould</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Cavities count</label>
                  <input
                    type="number"
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2"
                    value={newMould.cavities}
                    onChange={e => setNewMould(prev => ({ ...prev, cavities: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Mould Steel Material</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2"
                    value={newMould.mould_material}
                    onChange={e => setNewMould(prev => ({ ...prev, mould_material: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Weight (Kg)</label>
                  <input
                    type="number"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2"
                    value={newMould.weight_kg}
                    onChange={e => setNewMould(prev => ({ ...prev, weight_kg: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Platen Length (mm)</label>
                  <input
                    type="number"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2"
                    value={newMould.platen_length}
                    onChange={e => setNewMould(prev => ({ ...prev, platen_length: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Platen Width (mm)</label>
                  <input
                    type="number"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2"
                    value={newMould.platen_width}
                    onChange={e => setNewMould(prev => ({ ...prev, platen_width: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Mould Height (mm)</label>
                  <input
                    type="number"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2"
                    value={newMould.platen_height}
                    onChange={e => setNewMould(prev => ({ ...prev, platen_height: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Max Shots Lifetime</label>
                  <input
                    type="number"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2"
                    value={newMould.total_shots_allowed}
                    onChange={e => setNewMould(prev => ({ ...prev, total_shots_allowed: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Maintenance Due Trigger (Shots)</label>
                  <input
                    type="number"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2"
                    value={newMould.maintenance_due_shots}
                    onChange={e => setNewMould(prev => ({ ...prev,  maintenance_due_shots: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewMouldModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-xl font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition"
                >
                  Save Tooling
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Create Moulding Job Card */}
      {showNewJobCardModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-extrabold text-slate-800 text-sm">Issue Moulding Job Card</h3>
              <button onClick={() => setShowNewJobCardModal(false)} className="text-slate-400 hover:text-slate-600 transition">✕</button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
              {/* Left Column: Form */}
              <form onSubmit={handleCreateJobCard} className="lg:col-span-2 p-6 space-y-4 text-xs font-medium max-h-[600px] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Select Active Work Order</label>
                    <select
                      required
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold"
                      value={newJobCard.wo_id}
                      onChange={e => handleWOChange(e.target.value)}
                    >
                      <option value="">-- Choose Work Order --</option>
                      {activeWorkOrders.map(w => (
                        <option key={w.wo_id} value={w.wo_id}>{w.wo_number} - {w.item_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Scanned final Batch barcode</label>
                    <select
                      required
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold mb-2"
                      value={newJobCard.fb_id}
                      onChange={e => setNewJobCard(prev => ({ ...prev, fb_id: e.target.value }))}
                    >
                      <option value="">-- Choose Approved Batch --</option>
                      {approvedBatches.map(b => (
                        <option key={b.fb_id} value={b.fb_id}>{b.fb_number} - {b.item_name}</option>
                      ))}
                    </select>
                    <div className="flex gap-1.5 items-center">
                      <input
                        type="text"
                        placeholder="Scan Compound Barcode..."
                        className="w-full bg-white border border-slate-300 rounded-xl px-2 py-1 text-[10px] font-bold focus:outline-none"
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleScanCompoundBarcode(e.target.value);
                            e.target.value = '';
                          }
                        }}
                        onBlur={e => {
                          if (e.target.value.trim()) {
                            handleScanCompoundBarcode(e.target.value.trim());
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleOpenCameraScanner('compound')}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-slate-655 transition flex-shrink-0"
                        title="Scan using Webcam Camera"
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {scannedBatchInfo && (
                      <div className="mt-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-[10px] font-bold text-slate-600 shadow-inner">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Batch Code:</span>
                          <span className="text-slate-800">{scannedBatchInfo.fb_number}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Recipe name:</span>
                          <span className="text-slate-800">{scannedBatchInfo.item_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Available Weight:</span>
                          <span className="text-slate-800">
                            {parseFloat(scannedBatchInfo.weight_kg || scannedBatchInfo.actual_weight_kg || 250).toFixed(2)} Kg
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Lab Status:</span>
                          <span className={`px-2 py-0.5 rounded text-[8.5px] font-extrabold uppercase ${
                            scannedBatchInfo.status === 'Approved' ? 'bg-green-150 text-green-700' : 'bg-red-150 text-red-700'
                          }`}>
                            {scannedBatchInfo.status}
                          </span>
                        </div>
                        <div className="flex justify-end pt-1.5 border-t border-slate-200 mt-1.5">
                          <button
                            type="button"
                            onClick={() => handlePrintCompoundBatchTag(scannedBatchInfo)}
                            className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[9px] font-extrabold flex items-center gap-1 transition"
                          >
                            <Printer className="w-3 h-3" />
                            Print Barcode Tag
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Select Mould Steel Tool</label>
                    <select
                      required
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold mb-2"
                      value={newJobCard.mould_id}
                      onChange={e => handleMouldChangeInJob(e.target.value)}
                    >
                      <option value="">-- Choose Mould --</option>
                      {moulds.map(m => (
                        <option key={m.mould_id} value={m.mould_id}>{m.mould_name} ({m.mould_code})</option>
                      ))}
                    </select>
                    <div className="flex gap-1.5 items-center">
                      <input
                        type="text"
                        placeholder="Scan Mould Barcode..."
                        className="w-full bg-white border border-slate-300 rounded-xl px-2 py-1 text-[10px] font-bold focus:outline-none"
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleScanMouldBarcode(e.target.value);
                            e.target.value = '';
                          }
                        }}
                        onBlur={e => {
                          if (e.target.value.trim()) {
                            handleScanMouldBarcode(e.target.value.trim());
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleOpenCameraScanner('mould')}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-slate-655 transition flex-shrink-0"
                        title="Scan using Webcam Camera"
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Select Press Machine</label>
                    <select
                      required
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                      value={newJobCard.machine_id}
                      onChange={e => setNewJobCard(prev => ({ ...prev, machine_id: e.target.value }))}
                    >
                      <option value="">-- Choose Press Machine --</option>
                      {machines
                        .filter(m => mouldCompatibleMachines.length === 0 || mouldCompatibleMachines.includes(m.machine_id))
                        .map(m => (
                          <option key={m.machine_id} value={m.machine_id}>{m.machine_name} ({m.machine_code})</option>
                        ))
                      }
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Planned Parts Qty (Pcs)</label>
                    <input
                      type="number"
                      required
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-bold text-slate-800"
                      value={newJobCard.planned_qty}
                      onChange={e => {
                        const qty = parseInt(e.target.value || 0);
                        setNewJobCard(prev => {
                          const mld = moulds.find(m => m.mould_id === parseInt(prev.mould_id));
                          const cavities = mld ? mld.cavities : 1;
                          return {
                            ...prev,
                            planned_qty: qty,
                            shots_required: Math.ceil(qty / cavities)
                          };
                        });
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Calculated Shots Required</label>
                    <input
                      type="number"
                      readOnly
                      className="w-full bg-slate-100 border border-slate-300 rounded-xl p-2 font-bold text-slate-500 cursor-not-allowed"
                      value={newJobCard.shots_required}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Compound slab weight req (Kg)</label>
                    <input
                      type="number"
                      step="0.001"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-bold"
                      value={newJobCard.compound_weight_required}
                      onChange={e => setNewJobCard(prev => ({ ...prev, compound_weight_required: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
                  <div>
                    <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Moulding Temperature (°C)</label>
                    <input
                      type="number"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2"
                      value={newJobCard.moulding_temp}
                      onChange={e => setNewJobCard(prev => ({ ...prev, moulding_temp: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Hydraulic Pressure (Bar)</label>
                    <input
                      type="number"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2"
                      value={newJobCard.moulding_pressure}
                      onChange={e => setNewJobCard(prev => ({ ...prev, moulding_pressure: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Curing Curing Time (Min)</label>
                    <input
                      type="number"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2"
                      value={newJobCard.curing_time}
                      onChange={e => setNewJobCard(prev => ({ ...prev, curing_time: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                  <div>
                    <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Preform Weight (grams per shot)</label>
                    <input
                      type="number"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2"
                      value={newJobCard.preform_weight_g}
                      onChange={e => setNewJobCard(prev => ({ ...prev, preform_weight_g: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Degassing Cycles (gas vents)</label>
                    <input
                      type="number"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2"
                      value={newJobCard.degassing_cycles}
                      onChange={e => setNewJobCard(prev => ({ ...prev, degassing_cycles: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Planned Start date</label>
                    <input
                      type="datetime-local"
                      required
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2"
                      value={newJobCard.planned_start}
                      onChange={e => setNewJobCard(prev => ({ ...prev, planned_start: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Planned End date</label>
                    <input
                      type="datetime-local"
                      required
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2"
                      value={newJobCard.planned_end}
                      onChange={e => setNewJobCard(prev => ({ ...prev, planned_end: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowNewJobCardModal(false)}
                    className="px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-xl font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition"
                  >
                    Issue Job Card
                  </button>
                </div>
              </form>

              {/* Right Column: Scannable Test References Panel */}
              <div className="lg:col-span-1 p-6 bg-slate-50/50 space-y-4 max-h-[600px] overflow-y-auto">
                <div className="border-b border-slate-200 pb-2.5">
                  <h4 className="font-extrabold text-[10px] uppercase text-slate-450 tracking-wider">📋 Scannable Reference tags</h4>
                  <p className="text-[9.5px] text-slate-500 font-semibold leading-relaxed mt-1">
                    In Jayashree Polymer's factory, these barcodes are attached physically. Point your camera at them (or click them) to simulate fitment checks:
                  </p>
                </div>
                
                <div className="space-y-5">
                  <div className="space-y-2">
                    <span className="font-bold text-[9px] text-slate-800 uppercase block tracking-wider">1. Mixing Compound Slab Barcodes</span>
                    {approvedBatches.length === 0 ? (
                      <p className="text-[9.5px] text-slate-450 italic">No approved mixing batches available. Create a recipe batch first.</p>
                    ) : (
                      approvedBatches.slice(0, 3).map(b => (
                        <div 
                          key={b.fb_id} 
                          className="bg-white border border-slate-200 rounded-xl p-3 text-center space-y-1.5 shadow-sm hover:border-orange-400 cursor-pointer transition"
                          onClick={() => handleScanCompoundBarcode(b.fb_number)}
                          title="Click to auto-simulate scan value"
                        >
                          <span className="text-[7.5px] bg-slate-100 text-slate-500 font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider">Mixing Slab Batch</span>
                          <img
                            src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(b.fb_number)}&scale=2&rotate=N&includetext=true`}
                            alt={b.fb_number}
                            className="h-9 object-contain mx-auto"
                          />
                          <span className="text-[9px] text-slate-700 font-extrabold block truncate">{b.item_name}</span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="space-y-2 border-t border-slate-200 pt-4">
                    <span className="font-bold text-[9px] text-slate-800 uppercase block tracking-wider">2. Steel Mould Master Barcodes</span>
                    {moulds.length === 0 ? (
                      <p className="text-[9.5px] text-slate-450 italic">No registered moulds. Add a mould tooling profile first.</p>
                    ) : (
                      moulds.slice(0, 3).map(m => (
                        <div 
                          key={m.mould_id} 
                          className="bg-white border border-slate-200 rounded-xl p-3 text-center space-y-1.5 shadow-sm hover:border-orange-400 cursor-pointer transition"
                          onClick={() => handleScanMouldBarcode(m.mould_code)}
                          title="Click to auto-simulate scan value"
                        >
                          <span className="text-[7.5px] bg-slate-100 text-slate-500 font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider">Steel Mould Plate</span>
                          <img
                            src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(m.mould_code)}&scale=2&rotate=N&includetext=true`}
                            alt={m.mould_code}
                            className="h-9 object-contain mx-auto"
                          />
                          <span className="text-[9px] text-slate-700 font-extrabold block truncate">{m.mould_name}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Modal 3: Log Mould Maintenance */}
      {showMaintenanceModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-extrabold text-slate-800 text-sm">Log Tool Maintenance</h3>
              <button onClick={() => setShowMaintenanceModal(false)} className="text-slate-400 hover:text-slate-600 transition">✕</button>
            </div>
            <form onSubmit={handleLogMaintenance} className="p-6 space-y-4 text-xs font-medium">
              <div>
                <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Maintenance Type</label>
                <select
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                  value={maintenanceForm.maintenance_type}
                  onChange={e => setMaintenanceForm(prev => ({ ...prev, maintenance_type: e.target.value }))}
                >
                  <option value="Scheduled Servicing">Scheduled Servicing</option>
                  <option value="Cavity Polishing">Cavity Polishing</option>
                  <option value="Guide Pin Replacement">Guide Pin Replacement</option>
                  <option value="Breakdown Repair">Breakdown Repair</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Technician / Done By</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2"
                  value={maintenanceForm.done_by}
                  onChange={e => setMaintenanceForm(prev => ({ ...prev, done_by: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Remarks & Details</label>
                <textarea
                  placeholder="e.g. Polished cavities 3 and 4, replaced bolts"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 h-20"
                  value={maintenanceForm.remarks}
                  onChange={e => setMaintenanceForm(prev => ({ ...prev, remarks: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Next Service Limit Target (Shots)</label>
                <input
                  type="number"
                  placeholder="e.g. 480000"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2"
                  value={maintenanceForm.next_due_shots}
                  onChange={e => setMaintenanceForm(prev => ({ ...prev, next_due_shots: e.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowMaintenanceModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-xl font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition"
                >
                  Reset & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 4: Register New Press Machine */}
      {showNewMachineModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-extrabold text-slate-800 text-sm">Register Moulding Press Machine</h3>
              <button onClick={() => setShowNewMachineModal(false)} className="text-slate-400 hover:text-slate-600 transition">✕</button>
            </div>
            <form onSubmit={handleCreateMachine} className="p-6 space-y-4 text-xs font-medium">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Machine Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. HMP-06"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                    value={newMachine.machine_code}
                    onChange={e => setNewMachine(prev => ({ ...prev, machine_code: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Machine Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Hydraulic Press 6"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                    value={newMachine.machine_name}
                    onChange={e => setNewMachine(prev => ({ ...prev, machine_name: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Moulding Type</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                    value={newMachine.moulding_type}
                    onChange={e => setNewMachine(prev => ({ ...prev, moulding_type: e.target.value }))}
                  >
                    <option value="Compression">Compression</option>
                    <option value="Transfer">Transfer</option>
                    <option value="Injection">Injection</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Capacity (Tonnage)</label>
                  <input
                    type="number"
                    placeholder="e.g. 150"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                    value={newMachine.capacity_tons}
                    onChange={e => setNewMachine(prev => ({ ...prev, capacity_tons: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Daylights (mould levels)</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                    value={newMachine.daylights}
                    onChange={e => setNewMachine(prev => ({ ...prev, daylights: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                <div>
                  <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Platen Length (L - mm)</label>
                  <input
                    type="number"
                    placeholder="e.g. 500"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                    value={newMachine.platen_length}
                    onChange={e => setNewMachine(prev => ({ ...prev, platen_length: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Platen Width (W - mm)</label>
                  <input
                    type="number"
                    placeholder="e.g. 500"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                    value={newMachine.platen_width}
                    onChange={e => setNewMachine(prev => ({ ...prev, platen_width: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-3">
                <div>
                  <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Heating Type</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                    value={newMachine.heating_type}
                    onChange={e => setNewMachine(prev => ({ ...prev, heating_type: e.target.value }))}
                  >
                    <option value="Electric">Electric</option>
                    <option value="Steam">Steam</option>
                    <option value="Oil">Oil</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Max Temp (°C)</label>
                  <input
                    type="number"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                    value={newMachine.max_temperature}
                    onChange={e => setNewMachine(prev => ({ ...prev, max_temperature: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Max Pressure (Bar)</label>
                  <input
                    type="number"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                    value={newMachine.max_pressure}
                    onChange={e => setNewMachine(prev => ({ ...prev, max_pressure: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                <div>
                  <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Ideal Cycle Time (min)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                    value={newMachine.ideal_cycle_time}
                    onChange={e => setNewMachine(prev => ({ ...prev, ideal_cycle_time: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Status</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5"
                    value={newMachine.status}
                    onChange={e => setNewMachine(prev => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="Active">Active / Running</option>
                    <option value="Idle">Idle</option>
                    <option value="Under Maintenance">Under Maintenance</option>
                    <option value="Breakdown">Breakdown</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewMachineModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-xl font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition"
                >
                  Register Machine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 5: WIP Batch Barcode Label */}
      {showWipModal && wipLabel && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-extrabold text-slate-800 text-sm">WIP Barcode Tag Generated</h3>
              <button onClick={() => { setShowWipModal(false); setSelectedJobCard(null); }} className="text-slate-400 hover:text-slate-600 transition">✕</button>
            </div>
            <div className="p-6 space-y-6">
              {/* Printed Tag Simulation */}
              <div id="wip-barcode-tag" className="border-2 border-dashed border-slate-400 rounded-xl p-4 bg-slate-50 text-center font-mono space-y-4">
                <div className="border-b border-slate-300 pb-2">
                  <h2 className="font-extrabold text-sm tracking-widest text-slate-850">JAYASHREE POLYMERS</h2>
                  <p className="text-[9px] text-slate-450 uppercase">Moulded Parts - WIP Tag</p>
                </div>
                
                {/* Real Scannable Barcode */}
                <div className="py-2 flex flex-col items-center justify-center bg-white border border-slate-200 rounded-lg p-2">
                  <img 
                    src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(wipLabel.wip_number)}&scale=2&rotate=N&includetext=false`}
                    alt="WIP Barcode"
                    className="h-10 object-contain"
                  />
                  <span className="text-[11px] font-extrabold tracking-widest text-slate-800 mt-1">{wipLabel.wip_number}</span>
                </div>

                <div className="text-left text-[10px] space-y-1.5 text-slate-700 font-bold border-t border-slate-200 pt-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">PRODUCT:</span>
                    <span>{wipLabel.item_name} ({wipLabel.item_code})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">SOURCE JOB:</span>
                    <span>{wipLabel.wip_number.replace('WIP-', '')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">QUANTITY:</span>
                    <span className="text-xs text-orange-600 font-extrabold">{wipLabel.good_qty} PCS</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">MACHINE USED:</span>
                    <span>{wipLabel.machine_name} ({wipLabel.machine_code})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">DATE:</span>
                    <span>{wipLabel.completed_date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">NEXT STAGE:</span>
                    <span className="text-slate-850 uppercase">QC & Trimming/Deflashing</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const printLabelWindow = window.open('', '_blank');
                    const wipQrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=' + encodeURIComponent(wipLabel.wip_number);
                    const wipBcUrl = 'https://bwipjs-api.metafloor.com/?bcid=code128&text=' + encodeURIComponent(wipLabel.wip_number) + '&scale=2&rotate=N&includetext=false';
                    
                    printLabelWindow.document.write(`
                      <html>
                      <head>
                        <title>Print WIP Label</title>
                        <style>
                          * { box-sizing: border-box; margin: 0; padding: 0; }
                          body { font-family: Arial, sans-serif; padding: 20px; text-align: center; }
                          .tag { border: 2px dashed #000; padding: 16px; border-radius: 8px; max-width: 320px; margin: auto; }
                          .title { font-weight: 900; font-size: 16px; margin: 0; letter-spacing: 1px; }
                          .subtitle { font-size: 9px; text-transform: uppercase; color: #555; margin: 2px 0 12px; letter-spacing: 1px; font-weight: bold; }
                          
                          .barcodes-row { display: flex; justify-content: center; gap: 16px; align-items: center; margin: 12px 0 16px; }
                          .bc-box { border: 1px solid #ccc; padding: 4px; border-radius: 4px; }
                          .bc-label { font-size: 8px; font-weight: bold; color: #444; margin-bottom: 4px; letter-spacing: 0.5px; }
                          
                          .info { text-align: left; font-size: 11px; border-top: 1px solid #ddd; padding-top: 12px; }
                          .row { display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding: 4px 0; }
                          .row:last-child { border-bottom: none; }
                          .row span { color: #666; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
                          .row strong { font-weight: bold; font-size: 12px; color: #000; }
                          .qty { font-size: 16px !important; color: #d35400 !important; }
                          
                          @media print { body { padding: 0; } }
                        </style>
                      </head>
                      <body>
                        <div class="tag">
                          <h2 class="title">JAYASHREE POLYMERS</h2>
                          <p class="subtitle">Moulded Parts - WIP Tag</p>
                          
                          <div class="barcodes-row">
                            <div>
                              <div class="bc-label">QR SCAN</div>
                              <div class="bc-box"><img src="${wipQrUrl}" style="width:70px;height:70px;display:block;" /></div>
                            </div>
                            <div>
                              <div class="bc-label">BARCODE SCAN</div>
                              <div class="bc-box" style="padding: 10px 4px;">
                                <img src="${wipBcUrl}" style="height:46px;display:block;" />
                                <div style="font-size:10px; font-weight:bold; letter-spacing:1.5px; margin-top:2px;">${wipLabel.wip_number}</div>
                              </div>
                            </div>
                          </div>
                          
                          <div class="info">
                            <div class="row"><span>Product:</span><strong>${wipLabel.item_name}</strong></div>
                            <div class="row"><span>Part Code:</span><strong>${wipLabel.item_code}</strong></div>
                            <div class="row"><span>Source Job:</span><strong>${wipLabel.wip_number.replace('WIP-', '')}</strong></div>
                            <div class="row"><span>Quantity:</span><strong class="qty">${wipLabel.good_qty} PCS</strong></div>
                            <div class="row"><span>Machine:</span><strong>${wipLabel.machine_name} (${wipLabel.machine_code})</strong></div>
                            <div class="row"><span>Date:</span><strong>${wipLabel.completed_date}</strong></div>
                            <div class="row"><span>Next Stage:</span><strong>QC / TRIMMING</strong></div>
                          </div>
                        </div>
                        <script>
                          window.onload = function() {
                            window.print();
                            setTimeout(function() { window.close(); }, 500);
                          };
                        </script>
                      </body>
                      </html>
                    `);
                  }}
                  className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shadow-md"
                >
                  Print WIP Tag
                </button>
                <button
                  onClick={() => { setShowWipModal(false); setSelectedJobCard(null); }}
                  className="flex-1 py-2.5 border border-slate-350 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  Done — Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 6: Standalone Scan Rejection / Defect Log */}
      {showRejectionScanModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-extrabold text-slate-800 text-sm">⚡ Scan Rejection Entry</h3>
              <button onClick={() => setShowRejectionScanModal(false)} className="text-slate-400 hover:text-slate-600 transition">✕</button>
            </div>
            <form onSubmit={handleSaveStandaloneRejection} className="p-6 space-y-4 text-xs font-medium">
              <div>
                <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Scan WIP Batch Barcode</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Scan Barcode (e.g. WIP-JC/2026/00002)..."
                    className="w-full bg-slate-50 border border-slate-355 rounded-xl p-2.5 font-bold focus:outline-none focus:ring-1 focus:ring-orange-500 text-slate-800"
                    value={rejectionScanForm.wip_barcode}
                    onChange={e => {
                      setRejectionScanForm(prev => ({ ...prev, wip_barcode: e.target.value }));
                      handleScanWipForRejection(e.target.value);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleScanWipForRejection(e.target.value);
                      }
                    }}
                    onBlur={e => {
                      if (e.target.value.trim()) {
                        handleScanWipForRejection(e.target.value.trim());
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleOpenCameraScanner('rejection')}
                    className="p-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl text-slate-650 transition flex items-center justify-center"
                    title="Scan using Camera"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {scannedRejectionJc && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-[10px] text-slate-600 font-semibold shadow-inner">
                  <div className="flex justify-between">
                    <span>Target Item:</span>
                    <span className="text-slate-850 font-bold">{scannedRejectionJc.item_name} ({scannedRejectionJc.item_code})</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Press Machine:</span>
                    <span className="text-slate-850 font-bold">{scannedRejectionJc.machine_name} ({scannedRejectionJc.machine_code})</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Compound Slab:</span>
                    <span className="text-slate-850 font-bold">{scannedRejectionJc.fb_number}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Select Shift</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-350 rounded-xl p-2.5 font-bold"
                    value={rejectionScanForm.shift}
                    onChange={e => setRejectionScanForm(prev => ({ ...prev, shift: e.target.value }))}
                  >
                    {shifts.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-455 uppercase text-[9px] font-bold mb-1">Machine Operator</label>
                  <select
                    required
                    className="w-full bg-slate-50 border border-slate-350 rounded-xl p-2.5 font-bold text-slate-800"
                    value={rejectionScanForm.operator_id}
                    onChange={e => setRejectionScanForm(prev => ({ ...prev, operator_id: e.target.value }))}
                  >
                    <option value="">-- Choose Operator --</option>
                    {operators.map(op => <option key={op.user_id} value={op.user_id}>{op.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Rejection Reason</label>
                <select
                  required
                  className="w-full bg-slate-50 border border-slate-350 rounded-xl p-2.5 font-bold text-slate-800"
                  value={rejectionScanForm.reason_code}
                  onChange={e => setRejectionScanForm(prev => ({ ...prev, reason_code: e.target.value }))}
                >
                  <option value="">-- Select Defect Code --</option>
                  {rejectionReasons.map(r => (
                    <option key={r.code} value={r.code}>[{r.code}] {r.name} - {r.desc}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Rejected Quantity (pieces)</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 5"
                  className="w-full bg-slate-50 border border-slate-355 rounded-xl p-2"
                  value={rejectionScanForm.rejected_qty}
                  onChange={e => setRejectionScanForm(prev => ({ ...prev, rejected_qty: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-slate-450 uppercase text-[9px] font-bold mb-1">Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Trapped air due to low temp"
                  className="w-full bg-slate-50 border border-slate-355 rounded-xl p-2"
                  value={rejectionScanForm.remarks}
                  onChange={e => setRejectionScanForm(prev => ({ ...prev, remarks: e.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowRejectionScanModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-xl font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition"
                >
                  Record Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal 7: Camera Scanner Modal using html5-qrcode */}
      {showCameraModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-orange-500" />
                Live Camera Scanner
              </h3>
              <button
                type="button"
                onClick={handleCloseCamera}
                className="text-slate-400 hover:text-slate-600 font-extrabold text-sm transition"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-[10px] text-slate-450 text-center font-bold uppercase">
                Align the barcode/QR code inside the viewfinder
              </p>
              
              {/* Webcam viewport box */}
              <div 
                id="camera-reader-viewport" 
                className="overflow-hidden rounded-2xl border-2 border-orange-500/30 bg-slate-900 aspect-square w-full relative flex items-center justify-center"
              >
                {/* Custom scanner crosshair design */}
                <div className="absolute inset-8 border border-white/20 pointer-events-none rounded-xl">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-orange-500"></div>
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-orange-500"></div>
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-orange-500"></div>
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-orange-500"></div>
                  
                  {/* Scanning animation red line */}
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-red-500/80 shadow-[0_0_8px_#ef4444] animate-bounce"></div>
                </div>
                
                {/* HTML5 QR Code canvas target */}
                <div id="camera-reader-element" className="w-full h-full"></div>
              </div>

              {/* Simulation fallback for development / local testing */}
              <div className="border border-slate-200 border-dashed rounded-xl p-3 bg-slate-50 text-center space-y-2">
                <p className="text-[9.5px] text-slate-455 font-bold uppercase">Webcam Simulation Tool</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="simulated-scanned-val"
                    placeholder="Enter manual mock scan code..."
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-[10px] font-bold focus:outline-none"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCameraScanSuccess(e.target.value);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById('simulated-scanned-val');
                      if (input && input.value) {
                        handleCameraScanSuccess(input.value);
                      } else {
                        // Intelligent fallbacks based on target
                        if (activeScannerTarget === 'compound' && approvedBatches[0]) {
                          handleCameraScanSuccess(approvedBatches[0].fb_number);
                        } else if (activeScannerTarget === 'mould' && moulds[0]) {
                          handleCameraScanSuccess(moulds[0].mould_code);
                        } else if (activeScannerTarget === 'jobcard' && jobCards[0]) {
                          handleCameraScanSuccess(`WIP-${jobCards[0].jc_number}`);
                        } else if (activeScannerTarget === 'rejection' && jobCards[0]) {
                          handleCameraScanSuccess(`WIP-${jobCards[0].jc_number}`);
                        } else if (activeScannerTarget === 'mould_verify' && selectedJobCard) {
                          handleCameraScanSuccess(selectedJobCard.mould_code);
                        } else if (activeScannerTarget === 'nextstage' && jobCards[0]) {
                          handleCameraScanSuccess(`WIP-${jobCards[0].jc_number}`);
                        }
                      }
                    }}
                    className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-[9.5px] font-extrabold transition shadow-sm whitespace-nowrap"
                  >
                    Simulate Scan
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseCamera}
                className="w-full py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition text-[11px]"
              >
                Cancel Scanning
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal 8: Purge Detail Modal */}
      {showPurgeDetailModal && selectedPurgeDetail && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></span>
                Purging Log Details
              </h3>
              <button 
                onClick={() => { setShowPurgeDetailModal(false); setSelectedPurgeDetail(null); }} 
                className="text-slate-400 hover:text-slate-600 font-extrabold text-sm transition"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-6 text-xs font-semibold text-slate-700">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center space-y-3">
                <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-600 font-extrabold text-[9px] uppercase tracking-wider">
                  {selectedPurgeDetail.purge_reason}
                </span>
                <h4 className="font-black text-slate-800 text-base">{selectedPurgeDetail.machine_name}</h4>
                <p className="text-slate-455 font-bold text-[10px] tracking-wide">Press ID: {selectedPurgeDetail.machine_code}</p>
                
                <div className="border-t border-slate-200/80 pt-3 flex justify-around text-center">
                  <div>
                    <span className="text-[8px] text-slate-400 uppercase font-bold block">Purged Qty</span>
                    <span className="text-sm font-black text-slate-800">{parseFloat(selectedPurgeDetail.quantity_kg).toFixed(3)} Kg</span>
                  </div>
                  <div className="border-l border-slate-200 h-8"></div>
                  <div>
                    <span className="text-[8px] text-slate-400 uppercase font-bold block">Material Cost Loss</span>
                    <span className="text-sm font-black text-red-650">₹{(selectedPurgeDetail.quantity_kg * 350).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-400 font-bold">OPERATOR IN CHARGE:</span>
                  <span className="text-slate-850">{selectedPurgeDetail.operator_name || 'System / Admin'}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-400 font-bold">LOG TIMESTAMP:</span>
                  <span className="text-slate-850">{new Date(selectedPurgeDetail.purge_date).toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-400 font-bold">COMPOUND RAW MATERIAL:</span>
                  <span className="text-slate-850">{selectedPurgeDetail.compound_used}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-400 font-bold">OEE LOSS CATEGORY:</span>
                  <span className="text-slate-850">Planned Setup / Cleaning</span>
                </div>
              </div>
              
              <div className="bg-orange-50/50 border border-orange-200/60 rounded-xl p-3 text-slate-600 font-normal leading-relaxed text-[11px]">
                <strong className="text-orange-700 block font-bold mb-1">OEE downtime impact:</strong>
                Purges are necessary compound raw material loss. For OEE calculations, this run represents a 15-20 min setup downtime during transition. Raw material stock ledger has been deducted by {parseFloat(selectedPurgeDetail.quantity_kg).toFixed(3)} Kg.
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => { setShowPurgeDetailModal(false); setSelectedPurgeDetail(null); }}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition shadow-md"
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
