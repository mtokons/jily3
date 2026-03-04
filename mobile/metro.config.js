const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// Disable watchman to fix EMFILE: too many open files on macOS
config.watchFolders = [];
config.resolver.disableHierarchicalLookup = false;
module.exports = config;
