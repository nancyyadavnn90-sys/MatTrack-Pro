const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// User Management Routes
router.get('/users', adminController.getUsers);
router.post('/users', adminController.createUser);
router.put('/users/:id', adminController.updateUser);
router.post('/users/:id/reset-password', adminController.resetPassword);
router.delete('/users/:id', adminController.deleteUser);

// Roles & Permissions Routes
router.get('/roles', adminController.getRoles);
router.post('/roles', adminController.createRole);
router.get('/permissions', adminController.getPermissions);
router.post('/permissions', adminController.savePermissions);

// Items Master Routes (Page 2)
router.get('/items', adminController.getItems);
router.post('/items', adminController.createItem);
router.put('/items/:id', adminController.updateItem);

// Suppliers Master Routes (Page 3)
router.get('/suppliers', adminController.getSuppliers);
router.post('/suppliers', adminController.createSupplier);
router.put('/suppliers/:id', adminController.updateSupplier);

// Customers Master Routes (Page 4)
router.get('/customers', adminController.getCustomers);
router.post('/customers', adminController.createCustomer);
router.put('/customers/:id', adminController.updateCustomer);

// Machines Master Routes (Page 5)
router.get('/machines', adminController.getMachines);
router.post('/machines', adminController.createMachine);
router.put('/machines/:id', adminController.updateMachine);

// Store Master Routes (Page 6)
router.get('/stores', adminController.getStores);
router.post('/stores', adminController.createStore);
router.put('/stores/:id', adminController.updateStore);

// Mould Master Routes (Page 7)
router.get('/moulds', adminController.getMoulds);
router.post('/moulds', adminController.createMould);
router.put('/moulds/:id', adminController.updateMould);

// Number Series Routes (Page 8)
router.get('/number-series', adminController.getNumberSeries);
router.put('/number-series/:id', adminController.updateNumberSeries);

// System Settings Routes (Page 9)
router.get('/company-settings', adminController.getCompanySettings);
router.put('/company-settings', adminController.updateCompanySettings);

module.exports = router;
