import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  CheckCircle2, RotateCw, Printer, X, Search, FileText, Plus, Trash2, ClipboardList, Check, Info, AlertTriangle, Camera
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Barcode from 'react-barcode';
import { Html5Qrcode } from 'html5-qrcode';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return {
    headers: { Authorization: `Bearer ${token}` }
  };
};

export default function Mixing() {
  const [activeTab, setActiveTab] = useState('recipes'); // 'recipes', 'master', 'final', 'lab_quality'
  const [viewState, setViewState] = useState('list'); // 'list', 'new', 'detail', 'execute', 'batch-card'
  const [loading, setLoading] = useState(false);
  
  // Lists
  const [recipes, setRecipes] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [masterBatches, setMasterBatches] = useState([]);
  const [finalBatches, setFinalBatches] = useState([]);
  const [labPendingQueue, setLabPendingQueue] = useState([]);
  const [compoundStoreList, setCompoundStoreList] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [showScanner, setShowScanner] = useState(false);
  const scannerRef = useRef(null);
  
  // Selection / Detail States
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [recipeVersions, setRecipeVersions] = useState([]);
  const [selectedMaster, setSelectedMaster] = useState(null);
  const [selectedFinal, setSelectedFinal] = useState(null);
  const [selectedLabBatch, setSelectedLabBatch] = useState(null);
  
  // Forms & Inputs
  const [recipeForm, setRecipeForm] = useState({
    recipe_name: '',
    rubber_type: 'EPDM',
    batch_size: 100,
    unit: 'Kg',
    ingredients: [{ raw_material_id: '', quantity: '', unit: 'Kg' }]
  });
  
  const [masterForm, setMasterForm] = useState({
    recipe_id: '',
    machine_id: '1', // IM-01
    operator_id: '1',
    planned_qty: 100,
    wo_id: ''
  });
  const [masterWeights, setMasterWeights] = useState({});
  const [masterParams, setMasterParams] = useState({
    mix_time: 8,
    drop_temp: 120,
    ram_pressure: 6,
    rotor_speed: 60,
    chamber_temp: 95,
    fill_factor: 65,
    power_consumption: 12.5,
    mixing_temp: 125,
    actual_qty: ''
  });

  const [finalForm, setFinalForm] = useState({
    mb_id: '',
    machine_id: '2', // IM-02
    operator_id: '1',
    planned_qty: 100
  });
  const [finalWeights, setFinalWeights] = useState({});
  const [finalParams, setFinalParams] = useState({
    mix_time: 5,
    drop_temp: 110,
    mooney_viscosity: 55,
    fill_factor: 65,
    power_consumption: 8.5,
    mixing_temp: 115,
    actual_qty: ''
  });

  const [labForm, setLabForm] = useState({
    rheo_ml: 1.2,
    rheo_mh: 18.5,
    rheo_ts2: 2.2,
    rheo_tc90: 10.5,
    mooney_viscosity: 55,
    hardness: 70,
    tensile_strength: 12.5,
    elongation: 320,
    tear_strength: 18,
    compression_set: 20,
    remarks: ''
  });

  const [searchBarcode, setSearchBarcode] = useState('');
  const [batchCardData, setBatchCardData] = useState(null);
  const [issueBarcode, setIssueBarcode] = useState('');
  const [reviewBatch, setReviewBatch] = useState(null);
  const [reviewAction, setReviewAction] = useState('Rework');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [labSearchText, setLabSearchText] = useState('');

  // Dropdown Master Data
  const machines = [
    { id: 1, code: 'IM-01', name: 'Banbury Internal Mixer 1 (75L)', type: 'Mixing' },
    { id: 2, code: 'IM-02', name: 'Banbury Internal Mixer 2 (75L)', type: 'Mixing' },
    { id: 3, code: 'OM-01', name: 'Two Roll Open Mill 1 (14-inch)', type: 'Mixing' },
    { id: 4, code: 'OM-02', name: 'Two Roll Open Mill 2 (16-inch)', type: 'Mixing' },
    { id: 5, code: 'KN-01', name: 'Dispersion Kneader 1 (55L)', type: 'Mixing' },
    { id: 6, code: 'IM-03', name: 'Banbury Internal Mixer 3 (110L)', type: 'Mixing' }
  ];

  const rubberTypes = ['EPDM', 'NBR', 'NR', 'SBR', 'CR'];

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadTabInitData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);


  const loadTabInitData = () => {
    setViewState('list');
    setSelectedRecipe(null);
    setSelectedMaster(null);
    setSelectedFinal(null);
    setSelectedLabBatch(null);
    setBatchCardData(null);
    
    if (activeTab === 'recipes') {
      fetchRecipes();
      fetchRawMaterials();
    } else if (activeTab === 'master') {
      fetchMasterBatches();
      fetchRecipes();
      fetchWorkOrders();
    } else if (activeTab === 'final') {
      fetchFinalBatches();
      // Load completed master batches for selector dropdown
      axios.get(`${API}/mixing/master-batches/pending`, getAuthHeader())
        .then(res => setMasterBatches(res.data))
        .catch(err => console.error(err));
    } else if (activeTab === 'lab_quality') {
      fetchLabPendingQueue();
      fetchCompoundStore();
    }
  };

  const printStickerPDF = async (divId, batchNo) => {
    const element = document.getElementById(divId);
    if (!element) return;
    try {
      const canvas = await html2canvas(element, { 
        scale: 3, 
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [50, 25]
      });
      pdf.addImage(imgData, 'PNG', 2, 2, 46, 21);
      pdf.save(`Sticker_${batchNo.split('/').join('_')}.pdf`);
    } catch (err) {
      alert('Failed to generate sticker PDF.');
    }
  };

  const loadBatchCard = async (codeToSearch) => {
    const targetCode = codeToSearch || searchBarcode;
    if (!targetCode) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/mixing/batch-card?barcode=${encodeURIComponent(targetCode)}`, getAuthHeader());
      setBatchCardData(res.data);
    } catch (err) {
      alert('Batch card not found: ' + (err.response?.data?.message || err.message));
      setBatchCardData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleViewBatchCard = (barcode) => {
    setActiveTab('traceability');
    setSearchBarcode(barcode);
    loadBatchCard(barcode);
  };

  const startScanner = (customScanSuccess = null) => {
    setShowScanner(true);
    setTimeout(() => {
      const html5QrCode = new Html5Qrcode('qr-reader');
      scannerRef.current = html5QrCode;
      html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          let scannedValue = decodedText;
          try {
            const parsed = JSON.parse(decodedText);
            if (parsed.batch_number) scannedValue = parsed.batch_number;
            else if (parsed.fb_number) scannedValue = parsed.fb_number;
            else if (parsed.mb_number) scannedValue = parsed.mb_number;
          } catch (e) {
            // treat as plain text barcode
          }
          if (customScanSuccess) {
            customScanSuccess(scannedValue);
          } else {
            setSearchBarcode(scannedValue);
            loadBatchCard(scannedValue);
          }
          stopScanner();
        },
        (errorMessage) => {}
      ).catch(err => {
        console.error('Camera start error:', err);
        alert('Could not access camera. Please check browser permissions.');
        setShowScanner(false);
      });
    }, 300);
  };

  const handleLabBarcodeSubmit = async (code) => {
    if (!code) return;
    const found = labPendingQueue.find(b => b.fb_number.toLowerCase() === code.toLowerCase());
    if (found) {
      openLabTestForm(found);
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get(`${API}/mixing/batch-card?barcode=${encodeURIComponent(code)}`, getAuthHeader());
      if (res.data && res.data.type === 'Final') {
        openLabTestForm(res.data.batch);
      } else {
        alert('Invalid batch: the scanned barcode is a Master Batch, but a Final Batch is required for lab tests.');
      }
    } catch (err) {
      alert('Batch details not found on server: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const submitQAReview = async () => {
    if (!reviewBatch) return;
    setLoading(true);
    try {
      await axios.put(`${API}/mixing/final-batches/${reviewBatch.fb_id}/review`, {
        action: reviewAction,
        remarks: reviewRemarks
      }, getAuthHeader());
      alert(`Batch ${reviewBatch.fb_number} successfully marked as ${reviewAction === 'Rework' ? 'Rework Pending' : 'Scrapped'}!`);
      setReviewBatch(null);
      setReviewRemarks('');
      fetchLabPendingQueue();
      fetchCompoundStore();
    } catch (err) {
      alert('QA Review submission failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().then(() => {
        scannerRef.current = null;
        setShowScanner(false);
      }).catch(err => console.error(err));
    } else {
      setShowScanner(false);
    }
  };

  // ─── API FETCHERS ───────────────────────────────────────────
  const fetchRecipes = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/mixing/recipes`, getAuthHeader());
      setRecipes(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRawMaterials = async () => {
    try {
      const res = await axios.get(`${API}/mixing/raw-materials`, getAuthHeader());
      setRawMaterials(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchWorkOrders = async () => {
    try {
      const res = await axios.get(`${API}/production/work-orders/mixing`, getAuthHeader());
      setWorkOrders(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMasterBatches = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/mixing/master-batches`, getAuthHeader());
      setMasterBatches(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFinalBatches = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/mixing/final-batches`, getAuthHeader());
      setFinalBatches(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLabPendingQueue = async () => {
    try {
      const res = await axios.get(`${API}/mixing/lab-tests`, getAuthHeader());
      setLabPendingQueue(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCompoundStore = async () => {
    try {
      const res = await axios.get(`${API}/mixing/compound-store`, getAuthHeader());
      setCompoundStoreList(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // ─── RECIPE HANDLERS ─────────────────────────────────────────
  const handleAddIngredientRow = () => {
    setRecipeForm(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { raw_material_id: '', quantity: '', unit: 'Kg' }]
    }));
  };

  const handleRemoveIngredientRow = (idx) => {
    setRecipeForm(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== idx)
    }));
  };

  const handleIngredientChange = (idx, field, val) => {
    setRecipeForm(prev => {
      const copy = [...prev.ingredients];
      copy[idx][field] = val;
      return { ...prev, ingredients: copy };
    });
  };

  const submitNewRecipe = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/mixing/recipes`, recipeForm, getAuthHeader());
      alert('New recipe created successfully!');
      setViewState('list');
      fetchRecipes();
    } catch (err) {
      alert('Failed to save recipe: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const viewRecipeDetail = async (recipe) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/mixing/recipes/${recipe.recipe_id}`, getAuthHeader());
      setSelectedRecipe(res.data);
      setViewState('detail');
      
      // Load version history
      const versionsRes = await axios.get(`${API}/mixing/recipes/versions/${recipe.recipe_code}`, getAuthHeader());
      setRecipeVersions(versionsRes.data);
    } catch (err) {
      alert('Failed to load recipe details');
    } finally {
      setLoading(false);
    }
  };

  // ─── MASTER BATCH HANDLERS ───────────────────────────────────
  const handleSelectMasterRecipe = async (recipeId) => {
    if (!recipeId) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/mixing/recipes/${recipeId}`, getAuthHeader());
      setSelectedRecipe(res.data);
      
      // Scale ingredients
      const scaledWeights = {};
      res.data.ingredients.forEach(ing => {
        const required = (parseFloat(ing.quantity) / 100) * masterForm.planned_qty;
        scaledWeights[ing.raw_material_id] = {
          name: ing.material_name,
          code: ing.material_code,
          unit: ing.material_unit,
          required_qty: required,
          stock_qty: ing.stock_qty,
          actual_qty: ''
        };
      });
      setMasterWeights(scaledWeights);
    } catch (err) {
      alert('Failed to fetch recipe materials availability.');
    } finally {
      setLoading(false);
    }
  };

  const handleMasterWeightInput = (rawMatId, val) => {
    setMasterWeights(prev => {
      const copy = { ...prev };
      if (copy[rawMatId]) {
        copy[rawMatId].actual_qty = val;
      }
      return copy;
    });
  };

  const simulateMasterScale = (rawMatId, target) => {
    const variation = (Math.random() - 0.5) * 0.008; // +/- 0.4%
    const weight = target * (1 + variation);
    handleMasterWeightInput(rawMatId, weight.toFixed(3));
  };

  const submitNewMasterBatch = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        recipe_id: parseInt(masterForm.recipe_id),
        machine_id: parseInt(masterForm.machine_id),
        operator_id: parseInt(masterForm.operator_id),
        planned_qty: parseFloat(masterForm.planned_qty),
        wo_id: masterForm.wo_id || null
      };

      await axios.post(`${API}/mixing/master-batches`, payload, getAuthHeader());
      alert('Master Batch registered! Complete stock and parameter checks in the execution list.');
      setViewState('list');
      fetchMasterBatches();
    } catch (err) {
      alert('Failed to create Master Batch: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const viewMasterExecution = async (batchId) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/mixing/master-batches/${batchId}`, getAuthHeader());
      setSelectedMaster(res.data);
      setViewState('execute');
      
      // Initialize inputs from data
      const weightsInit = {};
      res.data.materials.forEach(m => {
        weightsInit[m.item_id] = {
          name: m.material_name,
          code: m.material_code,
          unit: m.material_unit,
          required_qty: m.required_qty,
          actual_qty: m.issued_qty || ''
        };
      });
      setMasterWeights(weightsInit);
      setMasterParams({
        mix_time: res.data.batch.mix_time || 8,
        drop_temp: res.data.batch.drop_temp || 120,
        ram_pressure: res.data.batch.ram_pressure || 6,
        rotor_speed: res.data.batch.rotor_speed || 60,
        chamber_temp: res.data.batch.chamber_temp || 95,
        actual_qty: res.data.batch.actual_qty || ''
      });
    } catch (err) {
      alert('Failed to load batch execution panel');
    } finally {
      setLoading(false);
    }
  };

  const startMasterBatchMixing = async () => {
    setLoading(true);
    try {
      await axios.put(`${API}/mixing/master-batches/${selectedMaster.batch.mb_id}/start`, {}, getAuthHeader());
      alert('Materials successfully issued. Stock deducted. Mixing started!');
      viewMasterExecution(selectedMaster.batch.mb_id);
    } catch (err) {
      alert('Material issuance failed: ' + err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const completeMasterBatchMixing = async () => {
    if (!masterParams.actual_qty) {
      alert('Please enter actual compounding slab output weight.');
      return;
    }
    setLoading(true);
    try {
      await axios.put(`${API}/mixing/master-batches/${selectedMaster.batch.mb_id}/complete`, masterParams, getAuthHeader());
      alert('Master Batch compound completed! Barcode sticker is generated.');
      viewMasterExecution(selectedMaster.batch.mb_id);
    } catch (err) {
      alert('Completion failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkMasterScaleWeighed = () => {
    if (Object.keys(masterWeights).length === 0) return false;
    return Object.values(masterWeights).every(w => {
      const act = parseFloat(w.actual_qty || 0);
      const req = parseFloat(w.required_qty);
      const tol = req * 0.01;
      return act >= (req - tol) && act <= (req + tol);
    });
  };

  // ─── FINAL BATCH HANDLERS ───────────────────────────────────
  const handleSelectParentMaster = async (mbId) => {
    if (!mbId) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/mixing/master-batches/${mbId}`, getAuthHeader());
      setSelectedMaster(res.data);

      // Scale curatives based on parent Master batch actual output weight
      const mbQty = parseFloat(res.data.batch.actual_qty || res.data.batch.planned_qty);
      
      const resRecipe = await axios.get(`${API}/mixing/recipes/${res.data.batch.recipe_id}`, getAuthHeader());
      
      // Filter curatives
      const curativeKeywords = ['sulfur', 'cbs', 'tmtd', 'mbts', 'peroxide', 'dcp', 'accelerator'];
      const curativeIngredients = resRecipe.data.ingredients.filter(ing => {
        return curativeKeywords.some(keyword => ing.material_name.toLowerCase().includes(keyword));
      });

      const scaledWeights = {};
      curativeIngredients.forEach(ing => {
        const req = (parseFloat(ing.quantity) / 100) * mbQty;
        scaledWeights[ing.raw_material_id] = {
          name: ing.material_name,
          code: ing.material_code,
          unit: ing.material_unit,
          required_qty: req,
          stock_qty: ing.stock_qty,
          actual_qty: ''
        };
      });
      setFinalWeights(scaledWeights);
      
      // Planned final weight = master batch weight + curatives weight
      const totalCuratives = curativeIngredients.reduce((sum, ing) => sum + ((parseFloat(ing.quantity) / 100) * mbQty), 0);
      setFinalForm(prev => ({
        ...prev,
        mb_id: mbId,
        planned_qty: mbQty + totalCuratives
      }));

    } catch (err) {
      alert('Failed to load parent Master Batch details.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalWeightInput = (rawMatId, val) => {
    setFinalWeights(prev => {
      const copy = { ...prev };
      if (copy[rawMatId]) {
        copy[rawMatId].actual_qty = val;
      }
      return copy;
    });
  };

  const simulateFinalScale = (rawMatId, target) => {
    const variation = (Math.random() - 0.5) * 0.008;
    const weight = target * (1 + variation);
    handleFinalWeightInput(rawMatId, weight.toFixed(3));
  };

  const simulateAllMasterScales = () => {
    setMasterWeights(prev => {
      const copy = { ...prev };
      Object.keys(copy).forEach(id => {
        const target = parseFloat(copy[id].required_qty);
        const variation = (Math.random() - 0.5) * 0.008;
        copy[id].actual_qty = (target * (1 + variation)).toFixed(3);
      });
      return copy;
    });
  };

  const simulateBanburyRun = () => {
    if (!selectedMaster) return;
    const plannedWeight = parseFloat(selectedMaster.batch.planned_qty);
    const variance = (Math.random() - 0.5) * 0.01;
    const simulatedDischarge = (plannedWeight * (1 + variance)).toFixed(2);
    setMasterParams({
      mix_time: 8 + Math.floor(Math.random() * 3),
      drop_temp: 118 + Math.floor(Math.random() * 8),
      ram_pressure: 6.0,
      rotor_speed: 60,
      chamber_temp: 95,
      fill_factor: 65,
      power_consumption: 12.5,
      mixing_temp: 125,
      actual_qty: simulatedDischarge
    });
  };

  const simulateAllFinalScales = () => {
    setFinalWeights(prev => {
      const copy = { ...prev };
      Object.keys(copy).forEach(id => {
        const target = parseFloat(copy[id].required_qty);
        const variation = (Math.random() - 0.5) * 0.008;
        copy[id].actual_qty = (target * (1 + variation)).toFixed(3);
      });
      return copy;
    });
  };

  const simulateFinalBanburyRun = () => {
    if (!selectedFinal) return;
    const plannedWeight = parseFloat(selectedFinal.batch.planned_qty);
    const variance = (Math.random() - 0.5) * 0.01;
    const simulatedDischarge = (plannedWeight * (1 + variance)).toFixed(2);
    setFinalParams({
      mix_time: 6 + Math.floor(Math.random() * 3),
      drop_temp: 105 + Math.floor(Math.random() * 8),
      mooney_viscosity: (50 + Math.floor(Math.random() * 10)).toFixed(1),
      mixing_temp: 110,
      fill_factor: 70,
      power_consumption: 8.5,
      actual_qty: simulatedDischarge
    });
  };

  const submitNewFinalBatch = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        mb_id: parseInt(finalForm.mb_id),
        machine_id: parseInt(finalForm.machine_id),
        operator_id: parseInt(finalForm.operator_id),
        planned_qty: parseFloat(finalForm.planned_qty)
      };

      await axios.post(`${API}/mixing/final-batches`, payload, getAuthHeader());
      alert('Final Batch registered! Complete Stage 2 mixing run to issue barcode.');
      setViewState('list');
      fetchFinalBatches();
    } catch (err) {
      alert('Failed to create Final Batch: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const viewFinalExecution = async (batchId) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/mixing/final-batches/${batchId}`, getAuthHeader());
      setSelectedFinal(res.data);
      setViewState('execute');

      // Initialize inputs
      const weightsInit = {};
      res.data.materials.forEach(m => {
        weightsInit[m.item_id] = {
          name: m.material_name,
          code: m.material_code,
          unit: m.material_unit,
          required_qty: m.required_qty,
          actual_qty: m.issued_qty || ''
        };
      });
      setFinalWeights(weightsInit);
      setFinalParams({
        mix_time: res.data.batch.mix_time || 5,
        drop_temp: res.data.batch.drop_temp || 110,
        mooney_viscosity: res.data.batch.mooney_viscosity || 55,
        fill_factor: res.data.batch.fill_factor || 65,
        power_consumption: res.data.batch.power_consumption || 8.5,
        mixing_temp: res.data.batch.mixing_temp || 115,
        actual_qty: res.data.batch.actual_qty || ''
      });
    } catch (err) {
      alert('Failed to load Final Batch execution details');
    } finally {
      setLoading(false);
    }
  };

  const startFinalBatchMixing = async () => {
    setLoading(true);
    try {
      await axios.put(`${API}/mixing/final-batches/${selectedFinal.batch.fb_id}/start`, {}, getAuthHeader());
      alert('Curatives successfully issued from stock. Mixing run started!');
      viewFinalExecution(selectedFinal.batch.fb_id);
    } catch (err) {
      alert('Issue failed: ' + err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const completeFinalBatchMixing = async () => {
    if (!finalParams.actual_qty) {
      alert('Please enter actual Final rubber compound slab output weight.');
      return;
    }
    setLoading(true);
    try {
      await axios.put(`${API}/mixing/final-batches/${selectedFinal.batch.fb_id}/complete`, finalParams, getAuthHeader());
      alert('Final Batch compound mixed successfully! Sent to QC Lab queue.');
      viewFinalExecution(selectedFinal.batch.fb_id);
    } catch (err) {
      alert('Failed to complete final batch: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkFinalScaleWeighed = () => {
    if (Object.keys(finalWeights).length === 0) return false;
    return Object.values(finalWeights).every(w => {
      const act = parseFloat(w.actual_qty || 0);
      const req = parseFloat(w.required_qty);
      const tol = req * 0.01;
      return act >= (req - tol) && act <= (req + tol);
    });
  };

  // ─── LAB QUALITY & STORE HANDLERS ────────────────────────────
  const openLabTestForm = (batch) => {
    setSelectedLabBatch(batch);
    setViewState('lab-entry');
    setLabForm({
      rheo_ml: 1.2,
      rheo_mh: 18.5,
      rheo_ts2: 2.2,
      rheo_tc90: 10.5,
      mooney_viscosity: batch.mooney_viscosity || 55,
      hardness: 70,
      tensile_strength: 12.5,
      elongation: 320,
      tear_strength: 18,
      compression_set: 20,
      remarks: ''
    });
  };

  const handleLabResultCheck = () => {
    const ml = parseFloat(labForm.rheo_ml || 0);
    const mh = parseFloat(labForm.rheo_mh || 0);
    const ts2 = parseFloat(labForm.rheo_ts2 || 0);
    const tc90 = parseFloat(labForm.rheo_tc90 || 0);
    const mooney = parseFloat(labForm.mooney_viscosity || 0);
    const hardness = parseFloat(labForm.hardness || 0);
    const tensile = parseFloat(labForm.tensile_strength || 0);
    const elongation = parseFloat(labForm.elongation || 0);
    const tear = parseFloat(labForm.tear_strength || 0);
    const compression = parseFloat(labForm.compression_set || 0);

    const mlPass = ml >= 1.0 && ml <= 2.5;
    const mhPass = mh >= 15.0 && mh <= 25.0;
    const ts2Pass = ts2 >= 1.5 && ts2 <= 3.5;
    const tc90Pass = tc90 >= 8.0 && tc90 <= 15.0;
    const mooneyPass = mooney >= 45.0 && mooney <= 70.0;
    const hardPass = hardness >= 65.0 && hardness <= 75.0;
    const tensilePass = tensile >= 10.0;
    const elongPass = elongation >= 200.0;
    const tearPass = tear >= 15.0;
    const compPass = compression <= 25.0;

    return mlPass && mhPass && ts2Pass && tc90Pass && mooneyPass && hardPass && tensilePass && elongPass && tearPass && compPass
      ? 'Pass' : 'Fail';
  };

  const submitLabQualityRecord = async () => {
    setLoading(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const passResult = handleLabResultCheck();
      
      const payload = {
        fb_id: selectedLabBatch.fb_id,
        overall_result: passResult === 'Pass' ? 'Approved' : 'Rejected',
        tested_by: user.user_id || 1,
        remarks: labForm.remarks,
        tests: [
          { test_name: 'Rheometer ML (dNm)', specification_min: 1.0, specification_max: 2.5, actual_value: parseFloat(labForm.rheo_ml), result: parseFloat(labForm.rheo_ml) >= 1.0 && parseFloat(labForm.rheo_ml) <= 2.5 ? 'Pass' : 'Fail' },
          { test_name: 'Rheometer MH (dNm)', specification_min: 15.0, specification_max: 25.0, actual_value: parseFloat(labForm.rheo_mh), result: parseFloat(labForm.rheo_mh) >= 15.0 && parseFloat(labForm.rheo_mh) <= 25.0 ? 'Pass' : 'Fail' },
          { test_name: 'Rheometer ts2 (min)', specification_min: 1.5, specification_max: 3.5, actual_value: parseFloat(labForm.rheo_ts2), result: parseFloat(labForm.rheo_ts2) >= 1.5 && parseFloat(labForm.rheo_ts2) <= 3.5 ? 'Pass' : 'Fail' },
          { test_name: 'Rheometer tc90 at 160°C', specification_min: 8.0, specification_max: 15.0, actual_value: parseFloat(labForm.rheo_tc90), result: parseFloat(labForm.rheo_tc90) >= 8.0 && parseFloat(labForm.rheo_tc90) <= 15.0 ? 'Pass' : 'Fail' },
          { test_name: 'Mooney Viscosity ML(1+4) 100°C', specification_min: 45.0, specification_max: 70.0, actual_value: parseFloat(labForm.mooney_viscosity), result: parseFloat(labForm.mooney_viscosity) >= 45.0 && parseFloat(labForm.mooney_viscosity) <= 70.0 ? 'Pass' : 'Fail' },
          { test_name: 'Shore A Hardness', specification_min: 65.0, specification_max: 75.0, actual_value: parseFloat(labForm.hardness), result: parseFloat(labForm.hardness) >= 65.0 && parseFloat(labForm.hardness) <= 75.0 ? 'Pass' : 'Fail' },
          { test_name: 'Tensile Strength (MPa)', specification_min: 10.0, specification_max: null, actual_value: parseFloat(labForm.tensile_strength), result: parseFloat(labForm.tensile_strength) >= 10.0 ? 'Pass' : 'Fail' },
          { test_name: 'Elongation at Break (%)', specification_min: 200.0, specification_max: null, actual_value: parseFloat(labForm.elongation), result: parseFloat(labForm.elongation) >= 200.0 ? 'Pass' : 'Fail' },
          { test_name: 'Tear Strength (N/mm)', specification_min: 15.0, specification_max: null, actual_value: parseFloat(labForm.tear_strength), result: parseFloat(labForm.tear_strength) >= 15.0 ? 'Pass' : 'Fail' },
          { test_name: 'Compression Set (%)', specification_min: null, specification_max: 25.0, actual_value: parseFloat(labForm.compression_set), result: parseFloat(labForm.compression_set) <= 25.0 ? 'Pass' : 'Fail' }
        ]
      };

      await axios.post(`${API}/mixing/lab-tests`, payload, getAuthHeader());
      alert(`Quality test saved! Overall Batch Result: ${payload.overall_result}`);
      setViewState('list');
      fetchLabPendingQueue();
      fetchCompoundStore();
    } catch (err) {
      alert('QC Submit failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleIssueStoreBatch = async (e) => {
    e.preventDefault();
    if (!issueBarcode) return;
    setLoading(true);
    try {
      const res = await axios.put(`${API}/mixing/compound-store/issue`, { barcode: issueBarcode }, getAuthHeader());
      alert(res.data.message);
      setIssueBarcode('');
      fetchCompoundStore();
    } catch (err) {
      alert(err.response?.data?.message || 'Issue failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-700">
      {/* ─── TITLE SECTION ────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Compounding & Mixing - Module 5</h1>
        <p className="text-slate-500 text-xs mt-1">Track Stage 1 Master compounding, Stage 2 final mixing, Mooney Viscosity, and Rheometer tests</p>
      </div>

      {/* ─── TAB NAVIGATION ────────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 gap-4">
        {[
          { id: 'recipes', label: 'Recipes & Formulas' },
          { id: 'master', label: 'Master Batch (Stage 1)' },
          { id: 'final', label: 'Final Batch (Stage 2)' },
          { id: 'lab_quality', label: 'Lab Quality & Compound Store' },
          { id: 'traceability', label: 'Batch Card Traceability' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setViewState('list'); }}
            className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition ${
              activeTab === tab.id
                ? 'border-orange-500 text-orange-500'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── TAB 1: RECIPES & FORMULAS ────────────────────────────── */}
      {activeTab === 'recipes' && (
        <>
          {viewState === 'list' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div className="relative w-72">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center">
                    <Search className="w-4 h-4 text-slate-400" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search recipes..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => {
                    setRecipeForm({
                      recipe_name: '',
                      rubber_type: 'EPDM',
                      batch_size: 100,
                      unit: 'Kg',
                      ingredients: [{ raw_material_id: '', quantity: '', unit: 'Kg' }]
                    });
                    setViewState('new');
                  }}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  New Recipe
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <th className="px-6 py-4">RECIPE CODE</th>
                      <th className="px-6 py-4">RECIPE NAME</th>
                      <th className="px-6 py-4">RUBBER TYPE</th>
                      <th className="px-6 py-4 text-right">BATCH SIZE</th>
                      <th className="px-6 py-4">VERSION</th>
                      <th className="px-6 py-4">STATUS</th>
                      <th className="px-6 py-4 text-center">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {recipes.map(r => (
                      <tr key={r.recipe_id} className="hover:bg-slate-50/50 cursor-pointer" onClick={() => viewRecipeDetail(r)}>
                        <td className="px-6 py-4 font-bold text-orange-500">{r.recipe_code}</td>
                        <td className="px-6 py-4 font-bold text-slate-900">{r.recipe_name}</td>
                        <td className="px-6 py-4 font-semibold text-slate-505">{r.rubber_type}</td>
                        <td className="px-6 py-4 text-right font-bold">{parseFloat(r.batch_size).toFixed(2)} {r.unit}</td>
                        <td className="px-6 py-4 font-bold text-slate-400">{r.version}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold ${
                            r.status === 'Active' ? 'bg-green-105 text-green-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => viewRecipeDetail(r)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-250 text-slate-750 border border-slate-200 rounded text-[11px] font-bold transition shadow-sm"
                          >
                            View Specs
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {viewState === 'new' && (
            <div className="bg-white border border-slate-200 rounded-3xl shadow-xl p-6 max-w-3xl mx-auto">
              <div className="border-b border-slate-150 pb-4 mb-6 flex justify-between items-center">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg">Define Rubber Compounding Recipe</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Build recipe formulary proportions scaled to standard batch output</p>
                </div>
                <button onClick={() => setViewState('list')} className="text-slate-400 hover:text-slate-650 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={submitNewRecipe} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Recipe Name</label>
                    <input
                      type="text"
                      placeholder="e.g. EPDM-70 Base Compound"
                      required
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                      value={recipeForm.recipe_name}
                      onChange={e => setRecipeForm(prev => ({ ...prev, recipe_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Base Rubber Polymer</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none font-semibold text-slate-750"
                      value={recipeForm.rubber_type}
                      onChange={e => setRecipeForm(prev => ({ ...prev, rubber_type: e.target.value }))}
                    >
                      {rubberTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Standard Batch Size (Kg)</label>
                    <input
                      type="number"
                      required
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none font-bold"
                      value={recipeForm.batch_size}
                      onChange={e => setRecipeForm(prev => ({ ...prev, batch_size: parseFloat(e.target.value || 0) }))}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-805">Ingredient List & Mixing Proportions</span>
                    <button
                      type="button"
                      onClick={handleAddIngredientRow}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-[10px] font-bold transition flex items-center gap-1 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Ingredient
                    </button>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {recipeForm.ingredients.map((ing, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <div className="flex-1">
                          <select
                            required
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                            value={ing.raw_material_id}
                            onChange={e => handleIngredientChange(idx, 'raw_material_id', e.target.value)}
                          >
                            <option value="">-- Select Material --</option>
                            {rawMaterials.map(m => (
                              <option key={m.item_id} value={m.item_id}>{m.item_name} ({m.item_code})</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-28">
                          <input
                            type="number"
                            step="0.001"
                            placeholder="Qty (Kg)"
                            required
                            className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-right focus:ring-1 focus:ring-orange-500 focus:outline-none font-semibold text-slate-800"
                            value={ing.quantity}
                            onChange={e => handleIngredientChange(idx, 'quantity', e.target.value)}
                          />
                        </div>
                        <div className="w-20">
                          <select
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                            value={ing.unit}
                            onChange={e => handleIngredientChange(idx, 'unit', e.target.value)}
                          >
                            <option value="Kg">Kg</option>
                            <option value="gm">gm</option>
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveIngredientRow(idx)}
                          className="p-2 text-slate-400 hover:text-red-500 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setViewState('list')}
                    className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition shadow"
                  >
                    {loading ? 'Saving...' : 'Save Recipe'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {viewState === 'detail' && selectedRecipe && (
            <div className="bg-white border border-slate-200 rounded-3xl shadow-xl p-6 max-w-4xl mx-auto space-y-6">
              <div className="border-b border-slate-150 pb-4 flex justify-between items-center">
                <div>
                  <span className="px-2 py-0.5 bg-violet-100 text-violet-750 border border-violet-200 rounded text-[9px] font-bold uppercase tracking-wider">
                    Recipe Specifications
                  </span>
                  <h3 className="font-extrabold text-slate-900 text-lg mt-1">{selectedRecipe.recipe.recipe_name}</h3>
                  <p className="text-slate-405 text-xs">Code: {selectedRecipe.recipe.recipe_code} | Base: {selectedRecipe.recipe.rubber_type}</p>
                </div>
                <button onClick={() => setViewState('list')} className="text-slate-400 hover:text-slate-650 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Specs */}
                <div className="md:col-span-2 space-y-4">
                  <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wide">Chemical Recipe Matrix</h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                          <th className="px-6 py-3">CHEMICAL INGREDIENT</th>
                          <th className="px-6 py-3 text-right">QUANTITY (KG)</th>
                          <th className="px-6 py-3 text-right">AVAILABLE STOCK</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {selectedRecipe.ingredients.map(ing => (
                          <tr key={ing.item_id}>
                            <td className="px-6 py-3">
                              <span className="font-bold text-slate-800 block">{ing.material_name}</span>
                              <span className="text-[9px] text-slate-450">{ing.material_code}</span>
                            </td>
                            <td className="px-6 py-3 text-right font-extrabold text-slate-850">{parseFloat(ing.quantity).toFixed(3)} {ing.unit}</td>
                            <td className={`px-6 py-3 text-right font-bold ${
                              parseFloat(ing.stock_qty) < parseFloat(ing.quantity) ? 'text-red-500 animate-pulse' : 'text-slate-500'
                            }`}>
                              {parseFloat(ing.stock_qty).toFixed(2)} Kg
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* History */}
                <div className="md:col-span-1 border border-slate-150 rounded-2xl p-4 bg-slate-50/40 space-y-3">
                  <h4 className="font-extrabold text-xs text-slate-850 border-b border-slate-250 pb-1">Version History</h4>
                  <div className="space-y-2.5 max-h-60 overflow-y-auto">
                    {recipeVersions.map(v => (
                      <div key={v.recipe_id} className="text-xs p-2.5 border border-slate-200 bg-white rounded-xl flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-800 block">{v.version}</span>
                          <span className="text-[10px] text-slate-400">{new Date(v.created_at).toLocaleDateString()}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          v.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {v.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── TAB 2: MASTER BATCH (STAGE 1) ───────────────────────── */}
      {activeTab === 'master' && (
        <>
          {viewState === 'list' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <span className="text-xs font-bold text-slate-700">Stage 1 Mixing - Master Batches</span>
                <button
                  onClick={() => {
                    setMasterForm({
                      recipe_id: '',
                      machine_id: '1',
                      operator_id: '1',
                      planned_qty: 100,
                      wo_id: ''
                    });
                    setSelectedRecipe(null);
                    setMasterWeights({});
                    setViewState('new');
                  }}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  New Master Batch
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <th className="px-6 py-4">BATCH NO</th>
                      <th className="px-6 py-4">RECIPE</th>
                      <th className="px-6 py-4">MACHINE</th>
                      <th className="px-6 py-4">OPERATOR</th>
                      <th className="px-6 py-4 text-right">PLANNED KG</th>
                      <th className="px-6 py-4 text-right">ACTUAL KG</th>
                      <th className="px-6 py-4">STATUS</th>
                      <th className="px-6 py-4">MIX DATE</th>
                      <th className="px-6 py-4 text-center">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {masterBatches.map(m => (
                      <tr key={m.mb_id} className="hover:bg-slate-50 cursor-pointer transition" onClick={() => viewMasterExecution(m.mb_id)}>
                        <td 
                          className="px-6 py-4 font-bold text-orange-550 hover:underline cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); handleViewBatchCard(m.mb_number); }}
                        >
                          {m.mb_number}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-bold text-slate-800 block">{m.recipe_name}</span>
                          <span className="text-[10px] text-slate-400">{m.recipe_code}</span>
                        </td>
                        <td className="px-6 py-4">{m.machine_code || 'Unassigned'}</td>
                        <td className="px-6 py-4">{m.operator_name || 'System'}</td>
                        <td className="px-6 py-4 text-right font-bold">{parseFloat(m.planned_qty).toFixed(2)} Kg</td>
                        <td className="px-6 py-4 text-right font-extrabold text-green-600">
                          {m.actual_qty ? `${parseFloat(m.actual_qty).toFixed(2)} Kg` : '—'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.status === 'Completed' ? 'bg-green-105 text-green-700' :
                            m.status === 'In Progress' ? 'bg-blue-105 text-blue-700' :
                            'bg-slate-100 text-slate-500'
                          }`}>
                            {m.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-400">
                          {new Date(m.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => viewMasterExecution(m.mb_id)}
                            className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-bold transition shadow-sm"
                          >
                            Execution Panel
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {viewState === 'new' && (
            <div className="bg-white border border-slate-200 rounded-3xl shadow-xl p-6 max-w-4xl mx-auto space-y-6">
              <div className="border-b border-slate-150 pb-4 mb-4 flex justify-between items-center">
                <h3 className="font-extrabold text-slate-900 text-lg">Create New Master Batch</h3>
                <button onClick={() => setViewState('list')} className="text-slate-400 hover:text-slate-650 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={submitNewMasterBatch} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Form fields */}
                <div className="md:col-span-1 space-y-4 border-r border-slate-150 pr-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Select Compound recipe</label>
                    <select
                      required
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                      value={masterForm.recipe_id}
                      onChange={e => {
                        setMasterForm(prev => ({ ...prev, recipe_id: e.target.value }));
                        handleSelectMasterRecipe(e.target.value);
                      }}
                    >
                      <option value="">-- Choose Recipe --</option>
                      {recipes.map(r => (
                        <option key={r.recipe_id} value={r.recipe_id}>{r.recipe_name} ({r.recipe_code})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Batch Output weight (Kg)</label>
                    <input
                      type="number"
                      required
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold focus:ring-1 focus:ring-orange-500 focus:outline-none"
                      value={masterForm.planned_qty}
                      onChange={e => setMasterForm(prev => ({ ...prev, planned_qty: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Internal Mixer</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                      value={masterForm.machine_id}
                      onChange={e => setMasterForm(prev => ({ ...prev, machine_id: e.target.value }))}
                    >
                      {machines.filter(m => m.type === 'Mixing').map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.code})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Weigh Operator</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                      value={masterForm.operator_id}
                      onChange={e => setMasterForm(prev => ({ ...prev, operator_id: e.target.value }))}
                    >
                      <option value="1">Operator 01 (Compounding Hall)</option>
                      <option value="2">Operator 02 (Mill Section)</option>
                      <option value="3">Operator 03 (Weigh Room)</option>
                      <option value="4">Operator 04 (Shift B Lead)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Link to active Work Order</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                      value={masterForm.wo_id}
                      onChange={e => setMasterForm(prev => ({ ...prev, wo_id: e.target.value }))}
                    >
                      <option value="">-- Choose Work Order --</option>
                      {workOrders.map(wo => (
                        <option key={wo.wo_id} value={wo.wo_number}>{wo.wo_number} ({wo.item_name})</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || Object.keys(masterWeights).length === 0}
                    className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition shadow mt-4"
                  >
                    Initiate Batch
                  </button>
                </div>

                {/* Stock availability checklist */}
                <div className="md:col-span-2 space-y-4">
                  <h4 className="font-extrabold text-xs text-slate-805 uppercase tracking-wide">
                    Master Ingredient Stocks & Scaled Requirements
                  </h4>
                  {selectedRecipe ? (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                            <th className="px-6 py-2.5">MATERIAL</th>
                            <th className="px-6 py-2.5 text-right">REQUIRED WT</th>
                            <th className="px-6 py-2.5 text-right">CURRENT STOCK</th>
                            <th className="px-6 py-2.5 text-center">AVAILABILITY</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {Object.entries(masterWeights).map(([id, w]) => {
                            const isAvailable = parseFloat(w.stock_qty) >= parseFloat(w.required_qty);
                            return (
                              <tr key={id}>
                                <td className="px-6 py-2.5">
                                  <span className="font-bold text-slate-800 block">{w.name}</span>
                                  <span className="text-[9px] text-slate-450">{w.code}</span>
                                </td>
                                <td className="px-6 py-2.5 text-right font-extrabold text-slate-850">{parseFloat(w.required_qty).toFixed(3)} Kg</td>
                                <td className="px-6 py-2.5 text-right text-slate-500">{parseFloat(w.stock_qty).toFixed(2)} Kg</td>
                                <td className="px-6 py-2.5 text-center">
                                  {isAvailable ? (
                                    <span className="inline-flex items-center gap-1 text-green-600 font-bold">
                                      <Check className="w-3.5 h-3.5" /> OK
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-red-500 font-bold">
                                      <X className="w-3.5 h-3.5" /> Shortage
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                      <Info className="w-10 h-10 stroke-1 mb-2 text-slate-350" />
                      <p className="text-xs">Choose recipe formula to compute ingredient weights and check live stocks.</p>
                    </div>
                  )}
                </div>
              </form>
            </div>
          )}

          {viewState === 'execute' && selectedMaster && (
            <div className="bg-white border border-slate-200 rounded-3xl shadow-xl p-6 max-w-4xl mx-auto space-y-6">
              <div className="border-b border-slate-150 pb-4 flex justify-between items-center">
                <div>
                  <span className="px-2 py-0.5 bg-orange-100 text-orange-755 border border-orange-200 rounded text-[9px] font-bold uppercase tracking-wider">
                    Compounding Station
                  </span>
                  <h3 className="font-extrabold text-slate-900 text-lg mt-1">Master Batch: {selectedMaster.batch.mb_number}</h3>
                  <p className="text-slate-450 text-xs">Recipe: {selectedMaster.batch.recipe_name} | Machine: {selectedMaster.batch.machine_name}</p>
                </div>
                <button onClick={() => setViewState('list')} className="text-slate-400 hover:text-slate-650 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {selectedMaster.batch.status === 'Pending' && (
                <div className="text-center py-10 space-y-4">
                  <ClipboardList className="w-12 h-12 text-slate-350 mx-auto" />
                  <h4 className="font-extrabold text-slate-800">Compounding Materials Awaiting Issuance</h4>
                  <p className="text-slate-450 text-xs max-w-md mx-auto">
                    Clicking "Start Batch" will automatically issue the chemical raw materials from the store ledger and initiate the Banbury mixing cycle.
                  </p>
                  <button
                    onClick={startMasterBatchMixing}
                    className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition shadow-md"
                  >
                    Start Batch & Issue Stock
                  </button>
                </div>
              )}

              {selectedMaster.batch.status === 'In Progress' && (
                <div className="space-y-6">
                  {/* Step-by-step workflow guide banner */}
                  <div className="bg-orange-50/70 border border-orange-200 rounded-2xl p-4 flex gap-3 text-xs text-orange-950 font-medium">
                    <span className="text-base">💡</span>
                    <div className="space-y-1">
                      <p className="font-extrabold text-orange-900 text-xs uppercase tracking-wider">How to Complete Master Compounding:</p>
                      <ul className="list-decimal list-inside space-y-0.5 text-slate-700 font-medium">
                        <li>Weigh each material by clicking <strong className="text-orange-600">Scale</strong> or click <strong className="text-orange-600 font-extrabold">Auto-Weigh All Materials</strong> below.</li>
                        <li>Verify that all materials are marked as <span className="px-1.5 py-0.2 bg-green-100 text-green-700 font-bold rounded">In Tolerance</span>.</li>
                        <li>Log Banbury machine parameters and fill in the <strong className="text-orange-600">Discharge Weight (Kg)</strong> (or click <strong className="text-orange-600 font-extrabold">Simulate Mixer Sensors</strong>).</li>
                        <li>Click the green <strong className="text-green-700 font-extrabold">Complete Master Batch</strong> button to finalize.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Weighing Inputs */}
                    <div className="md:col-span-2 space-y-4">
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wide">Stage 1: Floor Scale Weighing Checklist</h4>
                        <button
                          type="button"
                          onClick={simulateAllMasterScales}
                          className="px-2.5 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-[10px] font-bold transition shadow-sm"
                        >
                          ⚖️ Auto-Weigh All Materials
                        </button>
                      </div>
                      <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                              <th className="px-6 py-3">MATERIAL</th>
                              <th className="px-6 py-3 text-right">TARGET (KG)</th>
                              <th className="px-6 py-3 text-right">ACTUAL WEIGHED</th>
                              <th className="px-6 py-3 text-center">TOLERANCE STATUS</th>
                              <th className="px-6 py-3 text-center">INTERFACE</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium">
                            {Object.entries(masterWeights).map(([id, w]) => {
                              const req = parseFloat(w.required_qty);
                              const act = parseFloat(w.actual_qty || 0);
                              const tol = req * 0.01;
                              const ok = act >= (req - tol) && act <= (req + tol) && w.actual_qty !== '';
                              
                              return (
                                <tr key={id} className="hover:bg-slate-50/50">
                                  <td className="px-6 py-3">
                                    <span className="font-bold text-slate-800 block">{w.name}</span>
                                    <span className="text-[9.5px] text-slate-400">{w.code}</span>
                                  </td>
                                  <td className="px-6 py-3 text-right font-bold text-slate-800">{req.toFixed(3)} Kg</td>
                                  <td className="px-6 py-3 text-right">
                                    <input
                                      type="number"
                                      placeholder="0.000"
                                      className="w-24 text-right bg-slate-50 border border-slate-300 rounded px-2 py-1 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                                      value={w.actual_qty}
                                      onChange={e => handleMasterWeightInput(id, e.target.value)}
                                    />
                                  </td>
                                  <td className="px-6 py-3 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      w.actual_qty === '' ? 'bg-slate-100 text-slate-500' :
                                      ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                    }`}>
                                      {w.actual_qty === '' ? 'Pending' : ok ? 'In Tolerance' : 'Out of Spec'}
                                    </span>
                                  </td>
                                  <td className="px-6 py-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => simulateMasterScale(id, req)}
                                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-[10px] font-bold transition shadow-sm mx-auto"
                                    >
                                      Scale
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Execution Params */}
                    <div className="md:col-span-1 border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-1.5 mb-2">
                        <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1">
                          <RotateCw className="w-4 h-4 text-orange-500 animate-[spin_6s_linear_infinite]" />
                          Mixer Parameters
                        </h4>
                        <button
                          type="button"
                          onClick={simulateBanburyRun}
                          className="px-2 py-0.5 bg-orange-100 hover:bg-orange-200 text-orange-700 border border-orange-200 rounded text-[9px] font-bold transition"
                        >
                          ⚡ Simulate Mixer Sensors
                        </button>
                      </div>

                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-450 uppercase mb-0.5">Discharge Weight (Kg)</label>
                        <input
                          type="number"
                          placeholder="e.g. 98.40"
                          className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs font-bold focus:ring-1 focus:ring-orange-500 focus:outline-none"
                          value={masterParams.actual_qty}
                          onChange={e => setMasterParams(prev => ({ ...prev, actual_qty: e.target.value }))}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-450 uppercase mb-0.5">Mixing Time (min)</label>
                          <input
                            type="number"
                            className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                            value={masterParams.mix_time}
                            onChange={e => setMasterParams(prev => ({ ...prev, mix_time: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-450 uppercase mb-0.5">Drop Temp (°C)</label>
                          <input
                            type="number"
                            className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                            value={masterParams.drop_temp}
                            onChange={e => setMasterParams(prev => ({ ...prev, drop_temp: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-450 uppercase mb-0.5">Ram (Psi)</label>
                          <input
                            type="number"
                            className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                            value={masterParams.ram_pressure}
                            onChange={e => setMasterParams(prev => ({ ...prev, ram_pressure: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-450 uppercase mb-0.5">RPM</label>
                          <input
                            type="number"
                            className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                            value={masterParams.rotor_speed}
                            onChange={e => setMasterParams(prev => ({ ...prev, rotor_speed: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-450 uppercase mb-0.5">Chamber (°C)</label>
                          <input
                            type="number"
                            className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                            value={masterParams.chamber_temp}
                            onChange={e => setMasterParams(prev => ({ ...prev, chamber_temp: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-450 uppercase mb-0.5">Mixing Temp (°C)</label>
                          <input
                            type="number"
                            className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                            value={masterParams.mixing_temp}
                            onChange={e => setMasterParams(prev => ({ ...prev, mixing_temp: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-450 uppercase mb-0.5">Fill Factor (%)</label>
                          <input
                            type="number"
                            className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                            value={masterParams.fill_factor}
                            onChange={e => setMasterParams(prev => ({ ...prev, fill_factor: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-450 uppercase mb-0.5">Power (kWh)</label>
                          <input
                            type="number"
                            className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                            value={masterParams.power_consumption}
                            onChange={e => setMasterParams(prev => ({ ...prev, power_consumption: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={completeMasterBatchMixing}
                      disabled={loading || !checkMasterScaleWeighed() || !masterParams.actual_qty}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold text-white transition shadow flex items-center justify-center gap-1.5 ${
                        checkMasterScaleWeighed() && masterParams.actual_qty
                          ? 'bg-green-650 hover:bg-green-700 cursor-pointer'
                          : 'bg-slate-250 cursor-not-allowed text-slate-400'
                      }`}
                    >
                      Complete Master Batch
                    </button>
                  </div>
                </div>
              </div>
              )}

              {selectedMaster.batch.status === 'Completed' && (
                <div className="flex flex-col items-center justify-center py-6 space-y-6">
                  <div className="text-center space-y-1">
                    <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
                    <h3 className="font-extrabold text-slate-900">Master Batch Compounding Finished!</h3>
                    <p className="text-slate-450 text-xs">Compound sheets are labeled under number: {selectedMaster.batch.mb_number}</p>
                  </div>

                  {/* Print preview */}
                  <div className="border border-slate-300 rounded-xl p-4 bg-slate-50 shadow-md">
                    <div 
                      id="master-batch-print-stamp"
                      className="bg-white text-black p-3.5 border border-slate-200 shadow mx-auto"
                      style={{
                        width: '380px',
                        height: '190px',
                        boxSizing: 'border-box',
                        fontFamily: "monospace",
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ display: 'block', borderBottom: '1px solid #000000', paddingBottom: '2px', height: '18px' }}>
                        <span style={{ float: 'left', fontSize: '11px', fontWeight: 'bold' }}>JAYASHREE POLYMERS</span>
                        <span style={{ float: 'right', fontSize: '10px', fontWeight: 'bold' }}>MASTER BATCH</span>
                      </div>

                      <table style={{ width: '100%', margin: '4px 0', fontSize: '8.5px', color: '#000000' }}>
                        <tbody>
                          <tr style={{ height: '14px' }}>
                            <td style={{ width: '50%' }}><b>Batch:</b> {selectedMaster.batch.mb_number}</td>
                            <td style={{ width: '50%' }}><b>Date:</b> {new Date(selectedMaster.batch.created_at).toLocaleDateString()}</td>
                          </tr>
                          <tr style={{ height: '14px' }}>
                            <td colSpan="2"><b>Recipe Name:</b> {selectedMaster.batch.recipe_name}</td>
                          </tr>
                          <tr style={{ height: '14px' }}>
                            <td><b>Weight:</b> {parseFloat(selectedMaster.batch.actual_qty || selectedMaster.batch.planned_qty).toFixed(2)} Kg</td>
                            <td><b>Machine:</b> {selectedMaster.batch.machine_code}</td>
                          </tr>
                        </tbody>
                      </table>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                        <Barcode value={selectedMaster.batch.mb_number} width={1.5} height={40} fontSize={0} margin={0} />
                        <span style={{ fontSize: '8.5px', fontWeight: 'bold', marginTop: '2px' }}>{selectedMaster.batch.mb_number}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => printStickerPDF('master-batch-print-stamp', selectedMaster.batch.mb_number)}
                      className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition shadow flex items-center gap-1.5"
                    >
                      <Printer className="w-4 h-4" />
                      Print Barcode Label
                    </button>
                    <button
                      onClick={() => setViewState('list')}
                      className="px-6 py-2.5 bg-slate-950 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition"
                    >
                      Close Panel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ─── TAB 3: FINAL BATCH (STAGE 2) ────────────────────────── */}
      {activeTab === 'final' && (
        <>
          {viewState === 'list' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <span className="text-xs font-bold text-slate-700">Stage 2 Final Compound batches</span>
                <button
                  onClick={() => {
                    setFinalForm({
                      mb_id: '',
                      machine_id: '2',
                      operator_id: '1',
                      planned_qty: 100
                    });
                    setSelectedMaster(null);
                    setFinalWeights({});
                    setViewState('new');
                  }}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  New Final Batch
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                      <th className="px-6 py-4">FINAL BATCH</th>
                      <th className="px-6 py-4">LINKED MASTER</th>
                      <th className="px-6 py-4">RECIPE</th>
                      <th className="px-6 py-4">MACHINE</th>
                      <th className="px-6 py-4 text-right">WEIGHT</th>
                      <th className="px-6 py-4">MOONEY</th>
                      <th className="px-6 py-4">STATUS</th>
                      <th className="px-6 py-4 text-center">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {finalBatches.map(fb => (
                      <tr key={fb.fb_id} className="hover:bg-slate-50 cursor-pointer transition" onClick={() => viewFinalExecution(fb.fb_id)}>
                        <td 
                          className="px-6 py-4 font-bold text-orange-550 hover:underline cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); handleViewBatchCard(fb.fb_number); }}
                        >
                          {fb.fb_number}
                        </td>
                        <td 
                          className="px-6 py-4 font-bold text-slate-505 hover:underline cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); handleViewBatchCard(fb.mb_number); }}
                        >
                          {fb.mb_number}
                        </td>
                        <td className="px-6 py-4 font-bold">{fb.recipe_name}</td>
                        <td className="px-6 py-4">{fb.machine_code || 'Unassigned'}</td>
                        <td className="px-6 py-4 text-right font-bold">
                          {fb.actual_qty ? `${parseFloat(fb.actual_qty).toFixed(2)} Kg` : `${parseFloat(fb.planned_qty).toFixed(2)} Kg (Planned)`}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold">{fb.mooney_viscosity ? `${fb.mooney_viscosity} ML` : '—'}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                            fb.status === 'Approved' ? 'bg-green-105 text-green-700 border border-green-200' :
                            fb.status === 'Rejected' ? 'bg-red-105 text-red-700 border border-red-200' :
                            fb.status === 'Lab Testing' || fb.status === 'Completed' ? 'bg-amber-105 text-amber-705 border border-amber-200' :
                            'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}>
                            {fb.status === 'Completed' ? 'Awaiting Lab Test' : fb.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => viewFinalExecution(fb.fb_id)}
                            className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-bold transition shadow-sm"
                          >
                            Execution Panel
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {viewState === 'new' && (
            <div className="bg-white border border-slate-200 rounded-3xl shadow-xl p-6 max-w-4xl mx-auto space-y-6">
              <div className="border-b border-slate-150 pb-4 mb-4 flex justify-between items-center">
                <h3 className="font-extrabold text-slate-900 text-lg">Create New Final Batch</h3>
                <button onClick={() => setViewState('list')} className="text-slate-400 hover:text-slate-650 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={submitNewFinalBatch} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Inputs */}
                <div className="md:col-span-1 pr-4 border-r border-slate-150 space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Scan Master Batch Barcode</label>
                    <div className="flex gap-1.5 mb-2">
                      <input
                        type="text"
                        placeholder="Scan or enter MB-... barcode"
                        className="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = e.target.value.trim();
                            const matched = masterBatches.find(m => m.mb_number.toLowerCase() === val.toLowerCase());
                            if (matched) {
                              setFinalForm(prev => ({ ...prev, mb_id: matched.mb_id }));
                              handleSelectParentMaster(matched.mb_id);
                              e.target.value = '';
                            } else {
                              alert(`Master Batch ${val} not found or not in Completed state.`);
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => startScanner((code) => {
                          const matched = masterBatches.find(m => m.mb_number.toLowerCase() === code.toLowerCase());
                          if (matched) {
                            setFinalForm(prev => ({ ...prev, mb_id: matched.mb_id }));
                            handleSelectParentMaster(matched.mb_id);
                          } else {
                            alert(`Scanned Master Batch ${code} not found or not in Completed state.`);
                          }
                        })}
                        className="px-2 py-1.5 bg-orange-105 hover:bg-orange-200 text-orange-700 border border-orange-200 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                        title="Scan using Camera"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Select completed Master Batch</label>
                    <select
                      required
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                      value={finalForm.mb_id}
                      onChange={e => {
                        setFinalForm(prev => ({ ...prev, mb_id: e.target.value }));
                        handleSelectParentMaster(e.target.value);
                      }}
                    >
                      <option value="">-- Choose Master Batch --</option>
                      {masterBatches.map(m => (
                        <option key={m.mb_id} value={m.mb_id}>{m.mb_number} ({m.recipe_name} | {parseFloat(m.actual_qty || m.planned_qty).toFixed(2)} Kg)</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Final Batch Output weight (Kg)</label>
                    <input
                      type="number"
                      required
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold focus:ring-1 focus:ring-orange-500 focus:outline-none"
                      value={finalForm.planned_qty}
                      onChange={e => setFinalForm(prev => ({ ...prev, planned_qty: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mixing Machine</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                      value={finalForm.machine_id}
                      onChange={e => setFinalForm(prev => ({ ...prev, machine_id: e.target.value }))}
                    >
                      {machines.filter(m => m.type === 'Mixing').map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.code})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mixing Operator</label>
                    <select
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                      value={finalForm.operator_id}
                      onChange={e => setFinalForm(prev => ({ ...prev, operator_id: e.target.value }))}
                    >
                      <option value="1">Operator 01 (Compounding Hall)</option>
                      <option value="2">Operator 02 (Mill Section)</option>
                      <option value="3">Operator 03 (Weigh Room)</option>
                      <option value="4">Operator 04 (Shift B Lead)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || Object.keys(finalWeights).length === 0}
                    className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition shadow mt-4"
                  >
                    Initiate Final Batch
                  </button>
                </div>

                {/* Curative checker */}
                <div className="md:col-span-2 space-y-4">
                  <h4 className="font-extrabold text-xs text-slate-805 uppercase tracking-wide">
                    Curatives & Accelerators Required for Finalization
                  </h4>
                  {selectedMaster ? (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                            <th className="px-6 py-2.5">CURATIVE / ACCELERATOR</th>
                            <th className="px-6 py-2.5 text-right">REQUIRED WT</th>
                            <th className="px-6 py-2.5 text-right">CURRENT STOCK</th>
                            <th className="px-6 py-2.5 text-center">AVAILABILITY</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {Object.entries(finalWeights).map(([id, w]) => {
                            const isAvailable = parseFloat(w.stock_qty) >= parseFloat(w.required_qty);
                            return (
                              <tr key={id}>
                                <td className="px-6 py-2.5">
                                  <span className="font-bold text-slate-800 block">{w.name}</span>
                                  <span className="text-[9px] text-slate-450">{w.code}</span>
                                </td>
                                <td className="px-6 py-2.5 text-right font-extrabold text-slate-850">{parseFloat(w.required_qty).toFixed(3)} Kg</td>
                                <td className="px-6 py-2.5 text-right text-slate-500">{parseFloat(w.stock_qty).toFixed(2)} Kg</td>
                                <td className="px-6 py-2.5 text-center">
                                  {isAvailable ? (
                                    <span className="inline-flex items-center gap-1 text-green-600 font-bold">
                                      <Check className="w-3.5 h-3.5" /> OK
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-red-500 font-bold">
                                      <X className="w-3.5 h-3.5" /> Shortage
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                      <AlertTriangle className="w-10 h-10 stroke-1 mb-2 text-slate-350" />
                      <p className="text-xs">Scan or select a completed Master Batch to calculate curative proportions.</p>
                    </div>
                  )}
                </div>
              </form>
            </div>
          )}

          {viewState === 'execute' && selectedFinal && (
            <div className="bg-white border border-slate-200 rounded-3xl shadow-xl p-6 max-w-4xl mx-auto space-y-6">
              <div className="border-b border-slate-150 pb-4 flex justify-between items-center">
                <div>
                  <span className="px-2 py-0.5 bg-violet-105 text-violet-755 border border-violet-200 rounded text-[9px] font-bold uppercase tracking-wider">
                    Stage 2 Acceleration Mixing Run
                  </span>
                  <h3 className="font-extrabold text-slate-900 text-lg mt-1">Final Batch: {selectedFinal.batch.fb_number}</h3>
                  <p className="text-slate-450 text-xs">Linked Master Batch: {selectedFinal.batch.mb_number}</p>
                </div>
                <button onClick={() => setViewState('list')} className="text-slate-400 hover:text-slate-650 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {selectedFinal.batch.status === 'Pending' && (
                <div className="text-center py-10 space-y-4">
                  <ClipboardList className="w-12 h-12 text-slate-350 mx-auto animate-bounce" />
                  <h4 className="font-extrabold text-slate-800">Curing Agents & Accelerators Awaiting Issuance</h4>
                  <p className="text-slate-450 text-xs max-w-md mx-auto">
                    Clicking "Start Mixing" will deduct curatives from stock and start the secondary accelerator mixing cycle.
                  </p>
                  <button
                    onClick={startFinalBatchMixing}
                    className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition shadow-md"
                  >
                    Start Mixing & Deduct stock
                  </button>
                </div>
              )}

              {selectedFinal.batch.status === 'In Progress' && (
                <div className="space-y-6">
                  {/* Step-by-step workflow guide banner */}
                  <div className="bg-orange-50/70 border border-orange-200 rounded-2xl p-4 flex gap-3 text-xs text-orange-950 font-medium">
                    <span className="text-base">💡</span>
                    <div className="space-y-1">
                      <p className="font-extrabold text-orange-900 text-xs uppercase tracking-wider">How to Complete Final Compounding:</p>
                      <ul className="list-decimal list-inside space-y-0.5 text-slate-700 font-medium">
                        <li>Weigh each curative chemical by clicking <strong className="text-orange-600">Scale</strong> or click <strong className="text-orange-600 font-extrabold">Auto-Weigh All Curatives</strong> below.</li>
                        <li>Verify that all curatives are marked as <span className="px-1.5 py-0.2 bg-green-100 text-green-700 font-bold rounded">In Tolerance</span>.</li>
                        <li>Log finalizing parameters and enter the <strong className="text-orange-600">Final Slab Output Weight (Kg)</strong> (or click <strong className="text-orange-600 font-extrabold">Simulate Finalizing Sensors</strong>).</li>
                        <li>Click the green <strong className="text-green-700 font-extrabold">Complete Final Compound</strong> button to finalize.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Curative weighing */}
                    <div className="md:col-span-2 space-y-4">
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wide">Stage 2: Curative Scale Weighing</h4>
                        <button
                          type="button"
                          onClick={simulateAllFinalScales}
                          className="px-2.5 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-[10px] font-bold transition shadow-sm"
                        >
                          ⚖️ Auto-Weigh All Curatives
                        </button>
                      </div>
                      <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                              <th className="px-6 py-3">CURATIVE CHEMICAL</th>
                              <th className="px-6 py-3 text-right">TARGET WT</th>
                              <th className="px-6 py-3 text-right">ACTUAL WEIGHT (KG)</th>
                              <th className="px-6 py-3 text-center">TOLERANCE STATUS</th>
                              <th className="px-6 py-3 text-center">INTERFACE</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium">
                            {Object.entries(finalWeights).map(([id, w]) => {
                              const req = parseFloat(w.required_qty);
                              const act = parseFloat(w.actual_qty || 0);
                              const tol = req * 0.01;
                              const ok = act >= (req - tol) && act <= (req + tol) && w.actual_qty !== '';
                              return (
                                <tr key={id} className="hover:bg-slate-50/50">
                                  <td className="px-6 py-3">
                                    <span className="font-bold text-slate-800 block">{w.name}</span>
                                    <span className="text-[9.5px] text-slate-400">{w.code}</span>
                                  </td>
                                  <td className="px-6 py-3 text-right font-bold text-slate-800">{req.toFixed(3)} Kg</td>
                                  <td className="px-6 py-3 text-right">
                                    <input
                                      type="number"
                                      placeholder="0.000"
                                      className="w-24 text-right bg-slate-50 border border-slate-300 rounded px-2 py-1 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                                      value={w.actual_qty}
                                      onChange={e => handleFinalWeightInput(id, e.target.value)}
                                    />
                                  </td>
                                  <td className="px-6 py-3 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      w.actual_qty === '' ? 'bg-slate-100 text-slate-500' :
                                      ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                    }`}>
                                      {w.actual_qty === '' ? 'Pending' : ok ? 'In Tolerance' : 'Out of Spec'}
                                    </span>
                                  </td>
                                  <td className="px-6 py-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => simulateFinalScale(id, req)}
                                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-[10px] font-bold transition shadow-sm mx-auto"
                                    >
                                      Scale
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Final Parameters */}
                    <div className="md:col-span-1 border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-1.5 mb-2">
                        <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1">
                          <RotateCw className="w-4 h-4 text-orange-500 animate-[spin_4s_linear_infinite]" />
                          Finalizing Params
                        </h4>
                        <button
                          type="button"
                          onClick={simulateFinalBanburyRun}
                          className="px-2 py-0.5 bg-orange-100 hover:bg-orange-200 text-orange-700 border border-orange-200 rounded text-[9px] font-bold transition"
                        >
                          ⚡ Simulate Finalizing Sensors
                        </button>
                      </div>

                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-450 uppercase mb-0.5">Final Slab Output Weight (Kg)</label>
                        <input
                          type="number"
                          placeholder="e.g. 102.50"
                          className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs font-bold focus:ring-1 focus:ring-orange-500 focus:outline-none"
                          value={finalParams.actual_qty}
                          onChange={e => setFinalParams(prev => ({ ...prev, actual_qty: e.target.value }))}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-450 uppercase mb-0.5">Mix Time (min)</label>
                          <input
                            type="number"
                            className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                            value={finalParams.mix_time}
                            onChange={e => setFinalParams(prev => ({ ...prev, mix_time: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-450 uppercase mb-0.5">Drop Temp (°C)</label>
                          <input
                            type="number"
                            className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                            value={finalParams.drop_temp}
                            onChange={e => setFinalParams(prev => ({ ...prev, drop_temp: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-450 uppercase mb-0.5">Mooney Viscosity ML(1+4)</label>
                        <input
                          type="number"
                          placeholder="e.g. 52.4"
                          className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                          value={finalParams.mooney_viscosity}
                          onChange={e => setFinalParams(prev => ({ ...prev, mooney_viscosity: e.target.value }))}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-450 uppercase mb-0.5">Mixing Temp (°C)</label>
                          <input
                            type="number"
                            className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                            value={finalParams.mixing_temp}
                            onChange={e => setFinalParams(prev => ({ ...prev, mixing_temp: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-450 uppercase mb-0.5">Fill Factor (%)</label>
                          <input
                            type="number"
                            className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                            value={finalParams.fill_factor}
                            onChange={e => setFinalParams(prev => ({ ...prev, fill_factor: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-450 uppercase mb-0.5">Power (kWh)</label>
                          <input
                            type="number"
                            className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                            value={finalParams.power_consumption}
                            onChange={e => setFinalParams(prev => ({ ...prev, power_consumption: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={completeFinalBatchMixing}
                      disabled={loading || !checkFinalScaleWeighed() || !finalParams.actual_qty}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold text-white transition shadow flex items-center justify-center gap-1.5 ${
                        checkFinalScaleWeighed() && finalParams.actual_qty
                          ? 'bg-green-650 hover:bg-green-700 cursor-pointer'
                          : 'bg-slate-250 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      Complete Final Compound
                    </button>
                  </div>
                </div>
              </div>
              )}

              {(selectedFinal.batch.status === 'Completed' || selectedFinal.batch.status === 'Lab Testing' || selectedFinal.batch.status === 'Approved' || selectedFinal.batch.status === 'Rejected') && (
                <div className="flex flex-col items-center justify-center py-6 space-y-6">
                  <div className="text-center space-y-1">
                    <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
                    <h3 className="font-extrabold text-slate-900">Final rubber compound slab completed!</h3>
                    <p className="text-slate-450 text-xs">Final Batch Code: {selectedFinal.batch.fb_number} (Awaiting Lab QA Release)</p>
                  </div>

                  {/* Print preview */}
                  <div className="border border-slate-300 rounded-xl p-4 bg-slate-50 shadow-md">
                    <div 
                      id="final-batch-print-stamp"
                      className="bg-white text-black p-3.5 border border-slate-200 shadow mx-auto"
                      style={{
                        width: '380px',
                        height: '190px',
                        boxSizing: 'border-box',
                        fontFamily: "monospace",
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ display: 'block', borderBottom: '1px solid #000000', paddingBottom: '2px', height: '18px' }}>
                        <span style={{ float: 'left', fontSize: '11px', fontWeight: 'bold' }}>JAYASHREE POLYMERS</span>
                        <span style={{ float: 'right', fontSize: '9px', fontWeight: 'bold', border: '1px solid #000000', padding: '0 4px' }}>QC HOLD</span>
                      </div>

                      <table style={{ width: '100%', margin: '4px 0', fontSize: '8.5px', color: '#000000' }}>
                        <tbody>
                          <tr style={{ height: '14px' }}>
                            <td style={{ width: '50%' }}><b>Final Batch:</b> {selectedFinal.batch.fb_number}</td>
                            <td style={{ width: '50%' }}><b>Date:</b> {new Date(selectedFinal.batch.created_at).toLocaleDateString()}</td>
                          </tr>
                          <tr style={{ height: '14px' }}>
                            <td colSpan="2"><b>Linked Master Batch:</b> {selectedFinal.batch.mb_number}</td>
                          </tr>
                          <tr style={{ height: '14px' }}>
                            <td><b>Weight:</b> {parseFloat(selectedFinal.batch.actual_qty || selectedFinal.batch.planned_qty).toFixed(2)} Kg</td>
                            <td><b>Mooney:</b> {selectedFinal.batch.mooney_viscosity || '—'} ML</td>
                          </tr>
                        </tbody>
                      </table>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyItems: 'center', flex: 1 }}>
                        <Barcode value={selectedFinal.batch.fb_number} width={1.5} height={40} fontSize={0} margin={0} />
                        <span style={{ fontSize: '8.5px', fontWeight: 'bold', marginTop: '2px' }}>{selectedFinal.batch.fb_number}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => printStickerPDF('final-batch-print-stamp', selectedFinal.batch.fb_number)}
                      className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition shadow flex items-center gap-1.5"
                    >
                      <Printer className="w-4 h-4" />
                      Print Barcode Label
                    </button>
                    <button
                      onClick={() => setViewState('list')}
                      className="px-6 py-2.5 bg-slate-955 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition"
                    >
                      Close Panel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ─── TAB 4: LAB QUALITY & STORE ──────────────────────────── */}
      {activeTab === 'lab_quality' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Lab test entry panel */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
            <h3 className="font-extrabold text-slate-850 text-sm tracking-tight border-b border-slate-100 pb-2">QC Laboratory Queue</h3>
            
            {viewState === 'list' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Scan or enter FB-... barcode to test"
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                    value={labSearchText}
                    onChange={e => setLabSearchText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleLabBarcodeSubmit(labSearchText);
                        setLabSearchText('');
                      }
                    }}
                  />
                  <button
                    onClick={() => startScanner((code) => {
                      setLabSearchText(code);
                      handleLabBarcodeSubmit(code);
                    })}
                    className="px-3 py-2 bg-orange-105 hover:bg-orange-200 text-orange-700 border border-orange-200 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                    title="Scan Batch with Camera"
                  >
                    <Camera className="w-4 h-4" />
                    Scan
                  </button>
                  <button
                    onClick={() => {
                      handleLabBarcodeSubmit(labSearchText);
                      setLabSearchText('');
                    }}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition"
                  >
                    Search
                  </button>
                </div>

                {reviewBatch && (
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl space-y-3">
                    <h4 className="font-extrabold text-xs text-orange-850 uppercase">QA Review: {reviewBatch.fb_number}</h4>
                    <p className="text-[10px] text-slate-500">Select disposition action for rejected compound batch.</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-505 uppercase mb-1">QA Disposition</label>
                        <select
                          className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs focus:outline-none"
                          value={reviewAction}
                          onChange={e => setReviewAction(e.target.value)}
                        >
                          <option value="Rework">Send for Rework (Re-Mixing)</option>
                          <option value="Scrap">Scrap the Batch</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-505 uppercase mb-1">Review Remarks</label>
                        <input
                          type="text"
                          placeholder="QA notes / authorization details..."
                          className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs focus:outline-none"
                          value={reviewRemarks}
                          onChange={e => setReviewRemarks(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setReviewBatch(null)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[11px] font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={submitQAReview}
                        disabled={loading}
                        className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded text-[11px] font-bold shadow-sm"
                      >
                        Submit QA Decision
                      </button>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border border-slate-100 rounded-xl overflow-hidden">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                        <th className="py-2.5 px-3">Batch Number</th>
                        <th className="py-2.5 px-3">Recipe</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {labPendingQueue.map(b => (
                        <tr key={b.fb_id} className="hover:bg-slate-50/50 font-medium">
                          <td className="py-2.5 px-3 font-bold text-orange-550">{b.fb_number}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-700">{b.recipe_name} ({parseFloat(b.actual_qty || 0).toFixed(1)} Kg)</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                              b.status === 'Completed' ? 'bg-amber-105 text-amber-705 border border-amber-200' :
                              b.status === 'Approved' ? 'bg-green-105 text-green-700 border border-green-200' :
                              b.status === 'Rejected' ? 'bg-red-105 text-red-700 border border-red-200' :
                              b.status === 'Rework Pending' ? 'bg-orange-105 text-orange-700 border border-orange-200' :
                              'bg-slate-100 text-slate-500'
                            }`}>
                              {b.status === 'Completed' ? 'Awaiting Lab' : b.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center flex gap-1 justify-center">
                            {b.status === 'Completed' && (
                              <button
                                onClick={() => openLabTestForm(b)}
                                className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[10px] font-bold transition"
                              >
                                Enter Test
                              </button>
                            )}
                            {b.status === 'Rejected' && (
                              <button
                                onClick={() => { setReviewBatch(b); setReviewAction('Rework'); }}
                                className="px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-[10px] font-bold transition"
                              >
                                QA Review
                              </button>
                            )}
                            <button
                              onClick={() => handleViewBatchCard(b.fb_number)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded text-[10px] font-bold transition"
                            >
                              Card
                            </button>
                          </td>
                        </tr>
                      ))}
                      {labPendingQueue.length === 0 && (
                        <tr>
                          <td colSpan="4" className="text-slate-400 text-xs text-center py-10">No final compound batches currently in testing queue.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {viewState === 'lab-entry' && selectedLabBatch && (
              <div className="space-y-5">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wide">Enter Results for {selectedLabBatch.fb_number}</h4>
                  <button onClick={() => setViewState('list')} className="text-slate-400 hover:text-slate-650 transition">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-150 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                        <th className="py-2 px-3">Test Name</th>
                        <th className="py-2 px-3">Specification</th>
                        <th className="py-2 px-3">Actual Value</th>
                        <th className="py-2 px-3 text-center">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-2 px-3 font-semibold">Rheometer ML (dNm)</td>
                        <td className="py-2 px-3 text-slate-500">1.00 - 2.50</td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="0.01"
                            className="w-24 bg-white border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                            value={labForm.rheo_ml}
                            onChange={e => setLabForm(prev => ({ ...prev, rheo_ml: e.target.value }))}
                          />
                        </td>
                        <td className="py-2 px-3 text-center font-bold">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            parseFloat(labForm.rheo_ml) >= 1.0 && parseFloat(labForm.rheo_ml) <= 2.5 ? 'bg-green-105 text-green-700' : 'bg-red-105 text-red-700'
                          }`}>
                            {parseFloat(labForm.rheo_ml) >= 1.0 && parseFloat(labForm.rheo_ml) <= 2.5 ? 'Pass' : 'Fail'}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-semibold">Rheometer MH (dNm)</td>
                        <td className="py-2 px-3 text-slate-500">15.00 - 25.00</td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="0.01"
                            className="w-24 bg-white border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                            value={labForm.rheo_mh}
                            onChange={e => setLabForm(prev => ({ ...prev, rheo_mh: e.target.value }))}
                          />
                        </td>
                        <td className="py-2 px-3 text-center font-bold">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            parseFloat(labForm.rheo_mh) >= 15.0 && parseFloat(labForm.rheo_mh) <= 25.0 ? 'bg-green-105 text-green-700' : 'bg-red-105 text-red-700'
                          }`}>
                            {parseFloat(labForm.rheo_mh) >= 15.0 && parseFloat(labForm.rheo_mh) <= 25.0 ? 'Pass' : 'Fail'}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-semibold">Rheometer ts2 (min)</td>
                        <td className="py-2 px-3 text-slate-500">1.50 - 3.50</td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="0.01"
                            className="w-24 bg-white border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                            value={labForm.rheo_ts2}
                            onChange={e => setLabForm(prev => ({ ...prev, rheo_ts2: e.target.value }))}
                          />
                        </td>
                        <td className="py-2 px-3 text-center font-bold">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            parseFloat(labForm.rheo_ts2) >= 1.5 && parseFloat(labForm.rheo_ts2) <= 3.5 ? 'bg-green-105 text-green-700' : 'bg-red-105 text-red-700'
                          }`}>
                            {parseFloat(labForm.rheo_ts2) >= 1.5 && parseFloat(labForm.rheo_ts2) <= 3.5 ? 'Pass' : 'Fail'}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-semibold">Rheometer tc90 (min)</td>
                        <td className="py-2 px-3 text-slate-500">8.00 - 15.00</td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="0.01"
                            className="w-24 bg-white border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                            value={labForm.rheo_tc90}
                            onChange={e => setLabForm(prev => ({ ...prev, rheo_tc90: e.target.value }))}
                          />
                        </td>
                        <td className="py-2 px-3 text-center font-bold">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            parseFloat(labForm.rheo_tc90) >= 8.0 && parseFloat(labForm.rheo_tc90) <= 15.0 ? 'bg-green-105 text-green-700' : 'bg-red-105 text-red-700'
                          }`}>
                            {parseFloat(labForm.rheo_tc90) >= 8.0 && parseFloat(labForm.rheo_tc90) <= 15.0 ? 'Pass' : 'Fail'}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-semibold">Mooney Viscosity ML(1+4)</td>
                        <td className="py-2 px-3 text-slate-500">45.00 - 70.00</td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            className="w-24 bg-white border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                            value={labForm.mooney_viscosity}
                            onChange={e => setLabForm(prev => ({ ...prev, mooney_viscosity: e.target.value }))}
                          />
                        </td>
                        <td className="py-2 px-3 text-center font-bold">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            parseFloat(labForm.mooney_viscosity) >= 45.0 && parseFloat(labForm.mooney_viscosity) <= 70.0 ? 'bg-green-105 text-green-700' : 'bg-red-105 text-red-700'
                          }`}>
                            {parseFloat(labForm.mooney_viscosity) >= 45.0 && parseFloat(labForm.mooney_viscosity) <= 70.0 ? 'Pass' : 'Fail'}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-semibold">Shore A Hardness</td>
                        <td className="py-2 px-3 text-slate-500">65.00 - 75.00</td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            className="w-24 bg-white border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                            value={labForm.hardness}
                            onChange={e => setLabForm(prev => ({ ...prev, hardness: e.target.value }))}
                          />
                        </td>
                        <td className="py-2 px-3 text-center font-bold">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            parseFloat(labForm.hardness) >= 65.0 && parseFloat(labForm.hardness) <= 75.0 ? 'bg-green-105 text-green-700' : 'bg-red-105 text-red-700'
                          }`}>
                            {parseFloat(labForm.hardness) >= 65.0 && parseFloat(labForm.hardness) <= 75.0 ? 'Pass' : 'Fail'}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-semibold">Tensile Strength (MPa)</td>
                        <td className="py-2 px-3 text-slate-500">Min 10.00</td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="0.1"
                            className="w-24 bg-white border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                            value={labForm.tensile_strength}
                            onChange={e => setLabForm(prev => ({ ...prev, tensile_strength: e.target.value }))}
                          />
                        </td>
                        <td className="py-2 px-3 text-center font-bold">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            parseFloat(labForm.tensile_strength) >= 10.0 ? 'bg-green-105 text-green-700' : 'bg-red-105 text-red-700'
                          }`}>
                            {parseFloat(labForm.tensile_strength) >= 10.0 ? 'Pass' : 'Fail'}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-semibold">Elongation at Break (%)</td>
                        <td className="py-2 px-3 text-slate-500">Min 200.00</td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            className="w-24 bg-white border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                            value={labForm.elongation}
                            onChange={e => setLabForm(prev => ({ ...prev, elongation: e.target.value }))}
                          />
                        </td>
                        <td className="py-2 px-3 text-center font-bold">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            parseFloat(labForm.elongation) >= 200.0 ? 'bg-green-105 text-green-700' : 'bg-red-105 text-red-700'
                          }`}>
                            {parseFloat(labForm.elongation) >= 200.0 ? 'Pass' : 'Fail'}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-semibold">Tear Strength (N/mm)</td>
                        <td className="py-2 px-3 text-slate-500">Min 15.00</td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            className="w-24 bg-white border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                            value={labForm.tear_strength}
                            onChange={e => setLabForm(prev => ({ ...prev, tear_strength: e.target.value }))}
                          />
                        </td>
                        <td className="py-2 px-3 text-center font-bold">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            parseFloat(labForm.tear_strength) >= 15.0 ? 'bg-green-105 text-green-700' : 'bg-red-105 text-red-700'
                          }`}>
                            {parseFloat(labForm.tear_strength) >= 15.0 ? 'Pass' : 'Fail'}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-semibold">Compression Set (%)</td>
                        <td className="py-2 px-3 text-slate-500">Max 25.00</td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            className="w-24 bg-white border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                            value={labForm.compression_set}
                            onChange={e => setLabForm(prev => ({ ...prev, compression_set: e.target.value }))}
                          />
                        </td>
                        <td className="py-2 px-3 text-center font-bold">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            parseFloat(labForm.compression_set) <= 25.0 ? 'bg-green-105 text-green-700' : 'bg-red-105 text-red-700'
                          }`}>
                            {parseFloat(labForm.compression_set) <= 25.0 ? 'Pass' : 'Fail'}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Auto Judgement result:</span>
                  <span className={`px-2.5 py-0.5 rounded text-xs font-extrabold border ${
                    handleLabResultCheck() === 'Pass'
                      ? 'bg-green-100 text-green-700 border-green-200'
                      : 'bg-red-100 text-red-700 border-red-200'
                  }`}>
                    {handleLabResultCheck() === 'Pass' ? 'APPROVED' : 'REJECTED'}
                  </span>
                </div>

                <div>
                  <label className="block text-[9.5px] font-bold text-slate-455 uppercase mb-1">Remarks / Defect Details</label>
                  <input
                    type="text"
                    placeholder="e.g. MDR curves look consistent"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                    value={labForm.remarks}
                    onChange={e => setLabForm(prev => ({ ...prev, remarks: e.target.value }))}
                  />
                </div>

                <button
                  onClick={submitLabQualityRecord}
                  disabled={loading}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-md"
                >
                  {loading ? 'Submitting...' : 'Publish QC & Update Store'}
                </button>
              </div>
            )}
          </div>

          {/* Compound Store Stock */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
            <h3 className="font-extrabold text-slate-850 text-sm tracking-tight border-b border-slate-100 pb-2">Compound Store area (Approved Batches)</h3>
            
            {/* Issue scanner input */}
            <form onSubmit={handleIssueStoreBatch} className="flex gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
              <input
                type="text"
                placeholder="Scan batch barcode to issue to moulding..."
                className="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                value={issueBarcode}
                onChange={e => setIssueBarcode(e.target.value)}
              />
              <button
                type="submit"
                disabled={loading || !issueBarcode}
                className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition shadow-sm"
              >
                Issue
              </button>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border border-slate-100 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <th className="py-2.5 px-3">Batch Number</th>
                    <th className="py-2.5 px-3">Recipe</th>
                    <th className="py-2.5 px-3 text-right">Weight Available</th>
                    <th className="py-2.5 px-3">Date Made</th>
                    <th className="py-2.5 px-3">Lab Result</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {compoundStoreList.map(stock => (
                    <tr 
                      key={stock.fb_id} 
                      className="hover:bg-slate-50/80 cursor-pointer font-medium"
                      onClick={() => handleViewBatchCard(stock.fb_number)}
                      title="Click to view full batch history card"
                    >
                      <td className="py-3 px-3 font-bold text-orange-550 hover:underline">{stock.fb_number}</td>
                      <td className="py-3 px-3 font-semibold text-slate-700">{stock.recipe_name}</td>
                      <td className="py-3 px-3 text-right font-extrabold text-slate-900">{parseFloat(stock.weight_available).toFixed(2)} Kg</td>
                      <td className="py-3 px-3 text-slate-400">{new Date(stock.created_at).toLocaleDateString()}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-green-105 text-green-700 border border-green-200">
                          Approved
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-105 text-blue-700">
                          Store
                        </span>
                      </td>
                    </tr>
                  ))}
                  {compoundStoreList.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-slate-400 text-xs text-center py-10">No approved Ready-to-Use rubber slab compound batches in store.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 5: BATCH CARD TRACEABILITY ──────────────────────── */}
      {activeTab === 'traceability' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 max-w-md mx-auto space-y-4">
            <h3 className="font-extrabold text-slate-800 text-sm tracking-tight border-b border-slate-100 pb-2">Batch card with Complete history</h3>
            
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Scan or enter MB-... / FB-... code"
                className="flex-1 bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none"
                value={searchBarcode}
                onChange={e => setSearchBarcode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadBatchCard()}
              />
              <button
                onClick={() => startScanner()}
                className="px-3 py-2 bg-orange-105 hover:bg-orange-200 text-orange-700 border border-orange-200 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                title="Scan Barcode using Camera"
              >
                <Camera className="w-4 h-4" />
                Scan
              </button>
              <button
                onClick={() => loadBatchCard()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition"
              >
                Search
              </button>
            </div>

            {showScanner && (
              <div className="border border-slate-200 p-4 rounded-xl space-y-2 bg-slate-50 relative">
                <button 
                  onClick={stopScanner}
                  className="absolute top-2 right-2 text-slate-400 hover:text-slate-605 z-10 p-1 rounded-full bg-white shadow"
                >
                  <X className="w-4 h-4" />
                </button>
                <div id="qr-reader" className="w-full max-w-sm mx-auto overflow-hidden rounded-xl border border-slate-300"></div>
                <div className="text-[10px] text-slate-500 text-center font-semibold">Align the Barcode/QR within the camera scanner area</div>
              </div>
            )}
          </div>

          {batchCardData && (
            <div className="bg-white border border-slate-200 rounded-3xl shadow-xl p-6 max-w-4xl mx-auto space-y-6 text-xs">
              <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
                <div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                    batchCardData.type === 'Final' ? 'bg-violet-100 text-violet-750 border-violet-200' : 'bg-orange-105 text-orange-705 border-orange-200'
                  }`}>
                    {batchCardData.type} Batch
                  </span>
                  <h3 className="text-xl font-black mt-2 text-slate-900">{batchCardData.batch.mb_number || batchCardData.batch.fb_number}</h3>
                  <p className="text-slate-400 text-xs">Compound Formula: {batchCardData.batch.recipe_name}</p>
                </div>
                <span className={`px-3 py-1 rounded-xl text-xs font-extrabold border ${
                  batchCardData.batch.status === 'Approved' ? 'bg-green-100 text-green-700 border-green-200' :
                  batchCardData.batch.status === 'Rejected' ? 'bg-red-100 text-red-700 border-red-200' :
                  'bg-amber-100 text-amber-700 border-amber-200'
                }`}>
                  {batchCardData.batch.status}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Parameters */}
                <div className="border border-slate-150 rounded-2xl p-4 bg-slate-50/40 space-y-2">
                  <h4 className="font-extrabold text-xs text-slate-800 border-b border-slate-250 pb-1">Compounding Mixing parameters</h4>
                  <table className="w-full text-xs">
                    <tbody>
                      <tr className="height-7">
                        <td className="py-1 font-semibold text-slate-500">Mixing Machine:</td>
                        <td className="py-1 font-bold text-slate-850">{batchCardData.batch.machine_name} ({batchCardData.batch.machine_code})</td>
                      </tr>
                      <tr className="height-7">
                        <td className="py-1 font-semibold text-slate-500">Operator:</td>
                        <td className="py-1 font-bold text-slate-850">{batchCardData.batch.operator_name}</td>
                      </tr>
                      <tr className="height-7">
                        <td className="py-1 font-semibold text-slate-500">Compounding Time:</td>
                        <td className="py-1 font-bold text-slate-850">{batchCardData.batch.mix_time} minutes</td>
                      </tr>
                      <tr className="height-7">
                        <td className="py-1 font-semibold text-slate-500">Discharge weight:</td>
                        <td className="py-1 font-bold text-green-600">{parseFloat(batchCardData.batch.actual_qty || batchCardData.batch.planned_qty).toFixed(2)} Kg</td>
                      </tr>
                      <tr className="height-7">
                        <td className="py-1 font-semibold text-slate-500">Drop Temperature:</td>
                        <td className="py-1 font-bold text-orange-500">{batchCardData.batch.drop_temp}°C</td>
                      </tr>
                      <tr className="height-7">
                        <td className="py-1 font-semibold text-slate-500">Mixing Temperature:</td>
                        <td className="py-1 font-bold text-slate-850">{batchCardData.batch.mixing_temp || 120}°C</td>
                      </tr>
                      <tr className="height-7">
                        <td className="py-1 font-semibold text-slate-500">Chamber Temperature:</td>
                        <td className="py-1 font-bold text-slate-850">{batchCardData.batch.chamber_temp || 95}°C</td>
                      </tr>
                      <tr className="height-7">
                        <td className="py-1 font-semibold text-slate-500">Fill Factor:</td>
                        <td className="py-1 font-bold text-slate-850">{batchCardData.batch.fill_factor || 65}%</td>
                      </tr>
                      <tr className="height-7">
                        <td className="py-1 font-semibold text-slate-500">Power Consumption:</td>
                        <td className="py-1 font-bold text-slate-850">{batchCardData.batch.power_consumption || 12.5} kWh</td>
                      </tr>
                      <tr className="height-7">
                        <td className="py-1 font-semibold text-slate-500">Rotor Speed (RPM):</td>
                        <td className="py-1 font-bold text-slate-850">{batchCardData.batch.rotor_speed || 60} RPM</td>
                      </tr>
                      {batchCardData.type === 'Master' && (
                        <tr className="height-7">
                          <td className="py-1 font-semibold text-slate-500">Ram Pressure:</td>
                          <td className="py-1 font-bold text-slate-850">{batchCardData.batch.ram_pressure || 6.0} bar</td>
                        </tr>
                      )}
                      {batchCardData.type === 'Final' && (
                        <tr className="height-7">
                          <td className="py-1 font-semibold text-slate-500">Mooney Viscosity:</td>
                          <td className="py-1 font-bold text-slate-850">{batchCardData.batch.mooney_viscosity || '—'} ML</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Genealogy linkages */}
                <div className="border border-slate-150 rounded-2xl p-4 bg-slate-50/40 space-y-3">
                  <h4 className="font-extrabold text-xs text-slate-800 border-b border-slate-250 pb-1">Compound Genealogy</h4>
                  {batchCardData.type === 'Final' && (
                    <div className="space-y-2">
                      <p className="text-slate-500">This Final compound slab was mixed using Master Batch:</p>
                      <button
                        onClick={() => loadBatchCard(batchCardData.batch.mb_number)}
                        className="px-3.5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-sm transition"
                      >
                        <FileText className="w-4 h-4" />
                        View Master Batch: {batchCardData.batch.mb_number}
                      </button>
                    </div>
                  )}

                  {batchCardData.type === 'Master' && batchCardData.childFinals && (
                    <div className="space-y-2">
                      <p className="text-slate-500">Child Final Batches ready for moulding:</p>
                      <div className="flex flex-wrap gap-2">
                        {batchCardData.childFinals.map(c => (
                          <button
                            key={c.fb_id}
                            onClick={() => loadBatchCard(c.fb_number)}
                            className="px-2.5 py-1.5 bg-violet-100 hover:bg-violet-200 text-violet-750 border border-violet-200 rounded-lg font-bold transition"
                          >
                            {c.fb_number} ({parseFloat(c.actual_qty).toFixed(2)} Kg)
                          </button>
                        ))}
                        {batchCardData.childFinals.length === 0 && (
                          <p className="text-slate-450 italic">No final compounding accelerators added to this Master Batch yet.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Material log */}
              <div className="space-y-2">
                <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wide">Chemical Material audit Log</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                        <th className="px-6 py-2.5">INGREDIENT</th>
                        <th className="px-6 py-2.5 text-right">REQUIRED</th>
                        <th className="px-6 py-2.5 text-right">ACTUAL ISSUED</th>
                        <th className="px-6 py-2.5 text-center">STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {batchCardData.materials.map(m => (
                        <tr key={m.id}>
                          <td className="px-6 py-2.5">
                            <span className="font-bold text-slate-800 block">{m.item_name}</span>
                            <span className="text-[9px] text-slate-450">{m.item_code}</span>
                          </td>
                          <td className="px-6 py-2.5 text-right font-bold">{parseFloat(m.required_qty).toFixed(2)} {m.unit || 'Kg'}</td>
                          <td className="px-6 py-2.5 text-right font-extrabold text-slate-900">{parseFloat(m.issued_qty || m.required_qty).toFixed(2)} {m.unit || 'Kg'}</td>
                          <td className="px-6 py-2.5 text-center">
                            <span className="inline-flex items-center gap-1 text-green-600 font-bold">
                              <Check className="w-3.5 h-3.5" /> Issued
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Lab test details if final batch */}
              {batchCardData.type === 'Final' && batchCardData.labTest && (
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                  <h4 className="font-extrabold text-xs text-slate-805 border-b border-slate-250 pb-1">QC Lab Quality test results</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {batchCardData.labTestItems?.map((t, i) => (
                      <div key={i} className="bg-white p-2.5 border border-slate-200 rounded-xl text-xs">
                        <span className="text-[10px] text-slate-450 block font-bold">{t.test_name}</span>
                        <div className="flex justify-between items-center mt-1">
                          <span className="font-extrabold text-slate-800">{parseFloat(t.actual_value).toFixed(2)}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            t.result === 'Pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {t.result}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
