/**
 * Settings Data Layer
 * Manages application settings and persistent configuration
 */

import { executeStoreOperation } from './db.js';

/**
 * Default application settings
 */
const DEFAULT_SETTINGS = {
  'app.theme': 'light',
  'app.language': 'pt-BR',
  'app.notificationsEnabled': true,
  'app.autoSaveDrafts': true,
  'app.autoSaveInterval': 30000, // 30 seconds
  'logo.projectId': null, // Current project logo
  'logo.data': null,
  'ui.defaultView': 'list', // 'list' or 'grid'
  'ui.itemsPerPage': 20,
  'export.defaultFormat': 'json', // 'json' or 'pdf'
  'backup.autoBackupEnabled': false,
  'backup.lastBackupTime': null
};

/**
 * Validate setting key
 */
function validateSettingKey(key) {
  if (!key || typeof key !== 'string') {
    throw new Error('Setting key must be a non-empty string');
  }
  return key;
}

/**
 * Get setting value
 */
export async function getSetting(key, defaultValue = undefined) {
  try {
    key = validateSettingKey(key);

    return await executeStoreOperation('settings', 'readonly', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => {
          const result = request.result;
          resolve(result ? result.value : (defaultValue !== undefined ? defaultValue : DEFAULT_SETTINGS[key]));
        };
        request.onerror = () => reject(request.error);
      });
    });
  } catch (error) {
    console.error('Error getting setting:', error.message);
    return defaultValue !== undefined ? defaultValue : DEFAULT_SETTINGS[key];
  }
}

/**
 * Set setting value
 */
export async function setSetting(key, value) {
  try {
    key = validateSettingKey(key);

    const settingObj = {
      key,
      value,
      updatedAt: new Date().toISOString()
    };

    return await executeStoreOperation('settings', 'readwrite', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.put(settingObj);
        request.onsuccess = () => {
          console.log(`Setting updated: ${key}`);
          resolve(settingObj);
        };
        request.onerror = () => reject(request.error);
      });
    });
  } catch (error) {
    console.error('Error setting value:', error.message);
    throw error;
  }
}

/**
 * Get all settings
 */
export async function getAllSettings() {
  try {
    return await executeStoreOperation('settings', 'readonly', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          const settings = request.result || [];
          const result = { ...DEFAULT_SETTINGS };
          
          settings.forEach(setting => {
            result[setting.key] = setting.value;
          });

          resolve(result);
        };
        request.onerror = () => reject(request.error);
      });
    });
  } catch (error) {
    console.error('Error getting all settings:', error.message);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Batch set settings
 */
export async function setSettings(updates) {
  if (typeof updates !== 'object' || updates === null) {
    throw new Error('Settings must be an object');
  }

  const results = [];
  const errors = [];

  for (const [key, value] of Object.entries(updates)) {
    try {
      const setting = await setSetting(key, value);
      results.push({ success: true, key, value });
    } catch (error) {
      errors.push({ success: false, key, error: error.message });
    }
  }

  return { results, errors };
}

/**
 * Delete setting
 */
export async function deleteSetting(key) {
  try {
    key = validateSettingKey(key);

    return await executeStoreOperation('settings', 'readwrite', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.delete(key);
        request.onsuccess = () => {
          console.log(`Setting deleted: ${key}`);
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    });
  } catch (error) {
    console.error('Error deleting setting:', error.message);
    throw error;
  }
}

/**
 * Reset all settings to defaults
 */
export async function resetSettings() {
  try {
    const allSettings = await getAllSettings();
    const keysToDelete = Object.keys(allSettings).filter(k => !DEFAULT_SETTINGS.hasOwnProperty(k));

    for (const key of keysToDelete) {
      await deleteSetting(key);
    }

    console.log('Settings reset to defaults');
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Error resetting settings:', error.message);
    throw error;
  }
}

/**
 * Get theme setting
 */
export async function getTheme() {
  return getSetting('app.theme', 'light');
}

/**
 * Set theme
 */
export async function setTheme(theme) {
  if (!['light', 'dark', 'auto'].includes(theme)) {
    throw new Error('Invalid theme. Must be: light, dark, or auto');
  }
  return setSetting('app.theme', theme);
}

/**
 * Get language setting
 */
export async function getLanguage() {
  return getSetting('app.language', 'pt-BR');
}

/**
 * Set language
 */
export async function setLanguage(language) {
  const validLanguages = ['pt-BR', 'en-US', 'es-ES', 'fr-FR'];
  if (!validLanguages.includes(language)) {
    throw new Error(`Invalid language. Must be one of: ${validLanguages.join(', ')}`);
  }
  return setSetting('app.language', language);
}

/**
 * Get logo for current project
 */
export async function getProjectLogo(projectId) {
  try {
    return await executeStoreOperation('logos', 'readonly', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.get(projectId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    });
  } catch (error) {
    console.error('Error getting project logo:', error.message);
    return null;
  }
}

/**
 * Set logo for project
 */
export async function setProjectLogo(projectId, logoData) {
  try {
    if (!projectId) throw new Error('Project ID is required');

    const logo = {
      projectId,
      name: logoData.name || 'logo',
      type: logoData.type || 'image/png',
      data: logoData.data, // base64 data URL
      size: logoData.size || 0,
      uploadedAt: new Date().toISOString()
    };

    return await executeStoreOperation('logos', 'readwrite', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.put(logo);
        request.onsuccess = () => {
          console.log(`Logo set for project: ${projectId}`);
          resolve(logo);
        };
        request.onerror = () => reject(request.error);
      });
    });
  } catch (error) {
    console.error('Error setting project logo:', error.message);
    throw error;
  }
}

/**
 * Delete logo for project
 */
export async function deleteProjectLogo(projectId) {
  try {
    if (!projectId) throw new Error('Project ID is required');

    return await executeStoreOperation('logos', 'readwrite', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.delete(projectId);
        request.onsuccess = () => {
          console.log(`Logo deleted for project: ${projectId}`);
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    });
  } catch (error) {
    console.error('Error deleting project logo:', error.message);
    throw error;
  }
}

/**
 * Get all project logos
 */
export async function getAllLogos() {
  try {
    return await executeStoreOperation('logos', 'readonly', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    });
  } catch (error) {
    console.error('Error getting all logos:', error.message);
    return [];
  }
}

/**
 * Export settings
 */
export async function exportSettings() {
  const allSettings = await getAllSettings();
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: allSettings
  };
}

/**
 * Import settings
 */
export async function importSettings(settingsData) {
  if (typeof settingsData !== 'object' || settingsData === null) {
    throw new Error('Settings data must be an object');
  }

  return setSettings(settingsData);
}
