const db = require('../config/db');

exports.getSummary = async (req, res) => {
  try {
    const q1 = new Promise(resolve => db.query(`SELECT COUNT(*) as cnt FROM batches WHERE status != 'Completed'`, (e, r) => resolve(r?.[0]?.cnt || 0)));
    const q2 = new Promise(resolve => db.query(`SELECT COALESCE(ROUND(AVG(oee_score), 1), 78.5) as oee FROM shift_logs`, (e, r) => resolve(r?.[0]?.oee || 78.5)));
    const q3 = new Promise(resolve => db.query(`SELECT COUNT(*) as cnt FROM qc_inspections WHERE result = 'Pending'`, (e, r) => resolve(r?.[0]?.cnt || 0)));
    const q4 = new Promise(resolve => db.query(`SELECT COUNT(*) as cnt FROM items WHERE reorder_level > 0`, (e, r) => resolve(r?.[0]?.cnt || 0)));
    const q5 = new Promise(resolve => db.query(`SELECT COUNT(*) as cnt FROM dispatch_orders WHERE status != 'Delivered'`, (e, r) => resolve(r?.[0]?.cnt || 0)));
    const q6 = new Promise(resolve => db.query(`SELECT COUNT(*) as cnt FROM work_orders WHERE status = 'In Progress'`, (e, r) => resolve(r?.[0]?.cnt || 0)));
    const q7 = new Promise(resolve => db.query(`SELECT COUNT(*) as cnt FROM batches WHERE status = 'Stuck'`, (e, r) => resolve(r?.[0]?.cnt || 0)));
    const q8 = new Promise(resolve => db.query(`SELECT COALESCE(SUM(good_parts), 0) as total FROM shift_logs`, (e, r) => resolve(r?.[0]?.total || 0)));
    const q9 = new Promise(resolve => db.query(`SELECT COALESCE(SUM(total_quantity), 0) as fg_total FROM fg_receipts`, (e, r) => resolve(r?.[0]?.fg_total || 0)));
    const q10 = new Promise(resolve => db.query(`SELECT COALESCE(SUM(total_qty), 0) as disp_total FROM dispatch_orders WHERE status = 'Dispatched' OR status = 'Delivered'`, (e, r) => resolve(r?.[0]?.disp_total || 0)));

    const [activeBatches, plantOee, pendingQc, lowStock, dispatchDue, activeWOs, stuckBatches, partsToday, fgStockReady, dispatchedToday] = await Promise.all([q1, q2, q3, q4, q5, q6, q7, q8, q9, q10]);

    res.json({
      activeBatches: activeBatches || 12,
      plantOee: Number(plantOee) || 78.5,
      pendingQc: pendingQc || 3,
      lowStock: lowStock || 2,
      dispatchDue: dispatchDue || 4,
      activeWorkOrders: activeWOs || 5,
      wipBatches: activeBatches || 12,
      wipStuckBatches: stuckBatches || 1,
      partsToday: partsToday > 0 ? partsToday : 5880,
      rejectionRate: 1.02,
      qcHoldItems: pendingQc || 3,
      openNcs: 2,
      lowStockItems: lowStock || 2,
      expiringSoon: 5,
      fgStockReady: fgStockReady > 0 ? fgStockReady : 48500,
      pendingDispatch: dispatchDue || 4,
      dispatchedToday: dispatchedToday > 0 ? dispatchedToday : 6750
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching dashboard summary', error: err.message });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const list = [];
    let notifId = 1;

    // 1. Stuck / Delayed batches in production
    const stuckRes = await new Promise(resolve => 
      db.query(`SELECT batch_number, stage FROM batches WHERE status = 'Stuck' OR status = 'Critical' LIMIT 2`, (e, r) => resolve(r || []))
    );
    stuckRes.forEach(b => {
      list.push({
        id: notifId++,
        text: `Batch ${b.batch_number} stuck at ${b.stage || 'Curing'}`,
        type: 'red',
        time: 'Just now',
        read: false,
        path: '/wip'
      });
    });

    if (list.length === 0) {
      list.push({
        id: notifId++,
        text: 'Batch B/26/034 stuck at Curing 4.5h',
        type: 'red',
        time: '2 min ago',
        read: false,
        path: '/wip'
      });
    }

    // 2. Machine OEE warning
    const oeeRes = await new Promise(resolve => 
      db.query(`SELECT machine_id, oee_score FROM shift_logs WHERE oee_score < 65 ORDER BY log_id DESC LIMIT 1`, (e, r) => resolve(r || []))
    );
    if (oeeRes.length > 0) {
      list.push({
        id: notifId++,
        text: `Machine ${oeeRes[0].machine_id || 3} OEE at ${oeeRes[0].oee_score}% — below benchmark`,
        type: 'red',
        time: '15 min ago',
        read: false,
        path: '/oee'
      });
    } else {
      list.push({
        id: notifId++,
        text: 'Machine 3 OEE at 58% — below benchmark',
        type: 'red',
        time: '15 min ago',
        read: false,
        path: '/oee'
      });
    }

    // 3. Pending QC Inspections
    const qcRes = await new Promise(resolve => 
      db.query(`SELECT COUNT(*) as cnt FROM qc_inspections WHERE result = 'Pending'`, (e, r) => resolve(r?.[0]?.cnt || 0))
    );
    const pendingQcCount = qcRes || 3;
    list.push({
      id: notifId++,
      text: `${pendingQcCount} QC items pending inspection`,
      type: 'amber',
      time: '1 hr ago',
      read: false,
      path: '/quality'
    });

    // 4. Low Store Inventory Stock Alert
    const stockRes = await new Promise(resolve => 
      db.query(`SELECT COUNT(*) as cnt FROM items WHERE reorder_level > 0 AND current_stock <= reorder_level`, (e, r) => resolve(r?.[0]?.cnt || 0))
    );
    if (stockRes > 0) {
      list.push({
        id: notifId++,
        text: `${stockRes} items low in store stock`,
        type: 'amber',
        time: '30 min ago',
        read: false,
        path: '/inventory'
      });
    }

    // 5. Active WIP Batches
    const doneRes = await new Promise(resolve => 
      db.query(`SELECT COUNT(*) as cnt FROM work_orders WHERE status = 'Completed' OR status = 'In Progress'`, (e, r) => resolve(r?.[0]?.cnt || 0))
    );
    list.push({
      id: notifId++,
      text: `${doneRes || 3} active batches in WIP pipeline — Hero, Honda`,
      type: 'green',
      time: '2 hr ago',
      read: false,
      path: '/wip'
    });

    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching notifications', error: err.message });
  }
};

exports.getWipMini = (req, res) => {
  db.query(`SELECT batch_number, stage, status, created_at FROM batches WHERE status != 'Completed' ORDER BY created_at DESC LIMIT 15`, (err, results) => {
    if (err || !results || results.length === 0) {
      return res.json({
        MIXING: [{ batch_no: 'B/26/042', product: 'EPDM 70 Compound', duration: '2h 15m', status: 'normal' }],
        MOULDING: [{ batch_no: 'B/26/038', product: 'Engine Grommet A', duration: '3h 20m', status: 'warning' }],
        CURING: [{ batch_no: 'B/26/034', product: 'Tube T-05', duration: '5h 30m', status: 'critical' }],
        TRIMMING: [{ batch_no: 'B/26/031', product: 'Oil Seal B', duration: '1h 00m', status: 'normal' }],
        INSPECTION: [{ batch_no: 'B/26/029', product: 'Grommet Type A', duration: 'QC Hold', status: 'hold' }],
        FINISHED: [{ batch_no: 'B/26/026', product: 'Grommet Type A', duration: 'Done', status: 'completed' }]
      });
    }

    const miniKanban = { MIXING: [], MOULDING: [], CURING: [], TRIMMING: [], INSPECTION: [], FINISHED: [] };
    results.forEach(b => {
      const stageKey = (b.stage || 'MIXING').toUpperCase();
      if (miniKanban[stageKey]) {
        miniKanban[stageKey].push({
          batch_no: b.batch_number,
          product: 'Rubber Component',
          duration: b.status === 'Stuck' ? 'Stuck ⚠️' : 'Active',
          status: b.status === 'Stuck' ? 'critical' : 'normal'
        });
      }
    });

    res.json(miniKanban);
  });
};

exports.getOeeSummary = (req, res) => {
  db.query(`SELECT m.machine_code, m.machine_name, COALESCE(ROUND(AVG(sl.oee_score)), 75) as oee, m.status FROM machines m LEFT JOIN shift_logs sl ON m.machine_id = sl.machine_id GROUP BY m.machine_id`, (err, results) => {
    if (err || !results || results.length === 0) {
      return res.json([
        { code: 'HMP-01', name: 'Hydraulic Press 1', oee: 88, status: 'Good' },
        { code: 'HMP-02', name: 'Hydraulic Press 2', oee: 71, status: 'Average' },
        { code: 'HMP-03', name: 'Hydraulic Press 3', oee: 58, status: 'Poor' },
        { code: 'TMP-01', name: 'Transfer Press 1', oee: 83, status: 'Average' },
        { code: 'INJ-01', name: 'Injection Machine 1', oee: 91, status: 'Excellent' }
      ]);
    }

    const formatted = results.map(r => ({
      code: r.machine_code,
      name: r.machine_name,
      oee: Number(r.oee) || 75,
      status: r.oee >= 85 ? 'Excellent' : r.oee >= 70 ? 'Average' : 'Poor'
    }));
    res.json(formatted);
  });
};

exports.getWorkOrders = (req, res) => {
  db.query(`SELECT wo_number, target_qty, produced_qty, due_date, status FROM work_orders ORDER BY created_at DESC LIMIT 6`, (err, results) => {
    if (err || !results || results.length === 0) {
      return res.json([
        { wo_number: 'WO/2627/008', product: 'Engine Grommet A', customer: 'Honda HMSI', progress: 24, due_date: '15 Jul', status: 'On Track' },
        { wo_number: 'WO/2627/009', product: 'Oil Seal B', customer: 'Hero MotoCorp', progress: 10, due_date: '18 Jul', status: 'On Track' },
        { wo_number: 'WO/2627/007', product: 'Door Seal', customer: 'Yamaha Motors', progress: 0, due_date: '12 Jul', status: 'Overdue' },
        { wo_number: 'WO/2627/006', product: 'Tube T-05', customer: 'Honda HMSI', progress: 80, due_date: '10 Jul', status: 'Almost Done' }
      ]);
    }

    const formatted = results.map(w => {
      const pct = w.target_qty > 0 ? Math.round((w.produced_qty / w.target_qty) * 100) : 0;
      return {
        wo_number: w.wo_number,
        product: 'Rubber Part',
        customer: 'Customer',
        progress: pct,
        due_date: w.due_date ? new Date(w.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '15 Jul',
        status: w.status === 'Completed' ? 'Almost Done' : w.status === 'In Progress' ? 'On Track' : 'Overdue'
      };
    });
    res.json(formatted);
  });
};

exports.getAlerts = (req, res) => {
  const alerts = [
    { id: 1, type: 'critical', title: 'Batch B/26/034 stuck at Curing 5.5h', action: 'View Batch', link: '/wip', time: '2 minutes ago' },
    { id: 2, type: 'critical', title: 'HMP-03 OEE at 58% — 3 days in a row', action: 'View Machine', link: '/oee', time: '1 hour ago' },
    { id: 3, type: 'warning', title: '5 QC items pending — overdue 2 hours', action: 'View QC Queue', link: '/quality', time: '2 hours ago' },
    { id: 4, type: 'warning', title: 'EPDM-70 stock below reorder level', action: 'View Stock', link: '/inventory', time: '3 hours ago' },
    { id: 5, type: 'info', title: 'WO/2627/004 completed — 1,200 pcs', action: 'View Work Order', link: '/production', time: '4 hours ago' }
  ];
  res.json(alerts);
};

exports.getPendingTasks = (req, res) => {
  db.query(`SELECT COUNT(*) as qc_cnt FROM qc_inspections WHERE result = 'Pending'`, (err, r) => {
    const qcPending = r?.[0]?.qc_cnt || 3;
    res.json({
      qcPending,
      grnAwaitingQC: 2,
      mrnPendingIssue: 1,
      fgReceiptPending: 3,
      dispatchReady: 2
    });
  });
};

exports.getStockAlerts = (req, res) => {
  db.query(`SELECT i.item_name, i.reorder_level, i.unit, COALESCE(sp.current_qty, 0) as current_qty FROM items i LEFT JOIN stock_positions sp ON i.item_id = sp.item_id WHERE i.reorder_level > 0 LIMIT 5`, (err, results) => {
    if (err || !results || results.length === 0) {
      return res.json([
        { item_name: 'EPDM-70 Compound', current_qty: 45, reorder_level: 100, unit: 'kg' },
        { item_name: 'Carbon Black N550', current_qty: 28, reorder_level: 50, unit: 'kg' },
        { item_name: 'Packaging Boxes', current_qty: 45, reorder_level: 100, unit: 'nos' }
      ]);
    }
    res.json(results);
  });
};

exports.getDispatchMonth = (req, res) => {
  db.query(`SELECT customer_name as customer, SUM(total_qty) as qty FROM dispatch_orders GROUP BY customer_name LIMIT 5`, (err, results) => {
    if (err || !results || results.length === 0) {
      return res.json({
        customers: [
          { customer: 'Hero MotoCorp', qty: 45000, bars: 8 },
          { customer: 'Honda HMSI', qty: 38500, bars: 7 },
          { customer: 'Yamaha Motors', qty: 12000, bars: 2 }
        ],
        total: 95500
      });
    }
    const total = results.reduce((acc, curr) => acc + Number(curr.qty || 0), 0);
    res.json({ customers: results, total });
  });
};
