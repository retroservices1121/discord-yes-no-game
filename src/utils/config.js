const config = require('../../config.json');
const fs = require('fs');
const path = require('path');

/**
 * Get a configuration value
 * @param {string} key The configuration key
 * @param {*} defaultValue Default value if key doesn't exist
 * @returns {*} The configuration value
 */
function get(key, defaultValue = null) {
  return config[key] !== undefined ? config[key] : defaultValue;
}

/**
 * Update a configuration value
 * @param {string} key The configuration key
 * @param {*} value The new value
 * @returns {boolean} Success status
 */
function update(key, value) {
  try {
    config[key] = value;
    
    fs.writeFileSync(
      path.join(__dirname, '../../config.json'),
      JSON.stringify(config, null, 2)
    );
    
    return true;
  } catch (error) {
    console.error('Error updating config:', error);
    return false;
  }
}

module.exports = {
  get,
  update,
  config
};