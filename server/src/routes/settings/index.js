const express = require('express');
const router = express.Router();

// Import sub-routers
const generalSettingsRouter = require('./generalSettings');
const llmSettingsRouter = require('./llmSettings');

// Mount sub-routers
router.use('/', generalSettingsRouter);
router.use('/llm', llmSettingsRouter);

module.exports = router;