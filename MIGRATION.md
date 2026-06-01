# Migration Guide: From idb-keyval to Robust IndexedDB Layer

## Overview

This guide explains how to migrate from the fragile `idb-keyval` based system to the new robust IndexedDB layer.

## Phase 1: Data Migration (Automatic)

### Before Migration
```javascript
// Old system using idb-keyval
import { set, get, del, keys } from "idb-keyval";

const key = "rdobra-2026-06-01-1717248000000";
const obj = {
  date: "2026-06-01",
  project: "Obra XYZ",
  photos: [/* base64 images */]
};

await set(key, obj);
```

### Migration Script
```javascript
import { 
  getAllProjects,
  createReport,
  setProjectLogo,
  getDatabaseStats
} from './db/index.js';

async function migrateFromLegacy() {
  console.log('Starting migration from idb-keyval...');
  
  // 1. Get all old data
  const allKeys = await keys();
  const reportKeys = allKeys
    .filter(k => typeof k === 'string' && k.startsWith('rdobra-'))
    .filter(k => k !== 'rdobra-logo'); // Exclude logo key
  
  // 2. Create default project if none exists
  let defaultProject = (await getAllProjects())[0];
  if (!defaultProject) {
    defaultProject = await createProject({
      name: 'Obra Padrão',
      description: 'Projeto criado durante migração'
    });
  }
  
  // 3. Migrate reports
  let reportCount = 0;
  for (const key of reportKeys) {
    try {
      const oldData = await get(key);
      
      // Transform old format to new format
      const report = await createReport({
        projectId: defaultProject.id,
        date: oldData.date || new Date().toISOString().split('T')[0],
        weather: oldData.weather || '',
        progress: oldData.progress || '',
        issues: oldData.issues || '',
        crew: oldData.crew || '',
        equipment: oldData.equipment || '',
        photos: oldData.photos || [],
        status: 'completed'
      });
      
      reportCount++;
      console.log(`✅ Migrated report: ${key}`);
    } catch (error) {
      console.error(`❌ Failed to migrate report ${key}:`, error.message);
    }
  }
  
  // 4. Migrate logo if exists
  try {
    const oldLogo = await get('rdobra-logo');
    if (oldLogo && oldLogo.data) {
      await setProjectLogo(defaultProject.id, oldLogo);
      console.log('✅ Migrated logo');
    }
  } catch (error) {
    console.error('❌ Failed to migrate logo:', error.message);
  }
  
  console.log(`✅ Migration complete: ${reportCount} reports migrated`);
  
  // 5. Verify
  const stats = await getDatabaseStats();
  console.log('📊 New database stats:', stats);
}

// Run on app initialization
await migrateFromLegacy();
```

## Phase 2: Update Application Code

### Before (app.js)
```javascript
import { set, get, del, keys } from "idb-keyval";

// Line 107-145
saveBtn.addEventListener("click", async ()=>{
  const formData = new FormData(form);
  const obj = {
    date: formData.get("date"),
    weather: formData.get("weather"),
    project: formData.get("project"),
    progress: formData.get("progress"),
    issues: formData.get("issues"),
    crew: formData.get("crew"),
    equipment: formData.get("equipment"),
    createdAt: new Date().toISOString()
  };

  const files = photosInput.files;
  if(files && files.length>0){
    try{
      const imgs = await readFilesAsDataURL(files);
      obj.photos = imgs;
    }catch(err){
      console.error(err);
    }
  }else{
    obj.photos = [];
  }

  const key = ID_PREFIX + obj.date + "-" + Date.now();
  await set(key, obj);
  saveBtn.disabled = false;
  form.reset();
  listReports();
});
```

### After (refactored)
```javascript
import { 
  createProject,
  getActiveProjects,
  createReport,
  addReportPhotos,
  getProjectReports,
  setProjectLogo,
  getProjectLogo
} from './db/index.js';

let currentProjectId = null;

// Initialize
async function initializeApp() {
  const projects = await getActiveProjects();
  if (projects.length === 0) {
    // Create default project
    const project = await createProject({
      name: 'Projeto Padrão'
    });
    currentProjectId = project.id;
  } else {
    currentProjectId = projects[0].id;
  }
  
  await loadLogo();
  await listReports();
}

// Save report
saveBtn.addEventListener("click", async ()=>{
  try {
    saveBtn.disabled = true;
    
    // Validate
    const date = document.getElementById("date").value;
    const crew = document.getElementById("crew").value.trim();
    
    if (!date) {
      alert("Please fill in the date");
      saveBtn.disabled = false;
      return;
    }
    
    // Create report
    const report = await createReport({
      projectId: currentProjectId,
      date: date,
      weather: document.getElementById("weather").value,
      progress: document.getElementById("progress").value,
      issues: document.getElementById("issues").value,
      crew: crew,
      equipment: document.getElementById("equipment").value
    });
    
    // Add photos if any
    const files = photosInput.files;
    if (files && files.length > 0) {
      try {
        const photos = await readFilesAsDataURL(files);
        await addReportPhotos(report.id, photos);
      } catch (error) {
        console.error("Error adding photos:", error.message);
        alert("Some photos failed to upload");
      }
    }
    
    // Clear form
    form.reset();
    document.getElementById("date").value = new Date().toISOString().slice(0,10);
    
    // Refresh list
    await listReports();
    
    alert("Report saved successfully!");
  } catch (error) {
    console.error("Error saving report:", error.message);
    alert("Error saving report: " + error.message);
  } finally {
    saveBtn.disabled = false;
  }
});

// List reports
async function listReports() {
  reportsList.innerHTML = "";
  
  try {
    const reports = await getProjectReports(currentProjectId);
    
    if (reports.length === 0) {
      reportsList.innerHTML = "<div style='color:#666;padding:8px'>No saved reports</div>";
      return;
    }
    
    for (const report of reports) {
      const item = tpl.content.cloneNode(true);
      item.querySelector(".proj").textContent = report.date;
      item.querySelector(".date").textContent = report.weather || "";
      item.querySelector(".crew").textContent = (report.crew || "");
      
      const li = item.querySelector("li");
      li.dataset.reportId = report.id;
      
      li.querySelector("button.view").addEventListener("click", ()=> openModal(report));
      li.querySelector("button.share").addEventListener("click", ()=> doShare(report));
      li.querySelector("button.delete").addEventListener("click", async ()=>{
        if (confirm("Delete report?")) {
          await deleteReport(report.id);
          await listReports();
        }
      });
      
      reportsList.appendChild(li);
    }
  } catch (error) {
    console.error("Error listing reports:", error.message);
    reportsList.innerHTML = "<div style='color:red;padding:8px'>Error loading reports</div>";
  }
}

// Load logo
async function loadLogo() {
  try {
    const logo = await getProjectLogo(currentProjectId);
    if (logo && logo.data) {
      siteLogo.src = logo.data;
      siteLogo.classList.remove("hidden");
    } else {
      siteLogo.src = "";
      siteLogo.classList.add("hidden");
    }
  } catch (error) {
    console.error("Error loading logo:", error.message);
  }
}

// Save logo with project association
logoInput.addEventListener("change", async (e)=>{
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  
  const reader = new FileReader();
  reader.onload = async ()=> {
    try {
      const data = reader.result;
      await setProjectLogo(currentProjectId, {
        name: f.name,
        type: f.type,
        data: data,
        size: f.size
      });
      siteLogo.src = data;
      siteLogo.classList.remove("hidden");
      
      // Update all reports with this logo
      const reports = await getProjectReports(currentProjectId);
      for (const report of reports) {
        await setReportLogo(report.id, { data: data });
      }
    } catch (error) {
      console.error("Error saving logo:", error.message);
      alert("Error saving logo: " + error.message);
    }
  };
  reader.readAsDataURL(f);
});

// Initialize on load
initializeApp();
```

## Phase 3: Update Service Worker

### Before (sw.js)
```javascript
const CACHE = 'rdobra-v1';
const FILES = [
  './',
  './index.html',
  './style.css',
  './app.js'
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));
  self.skipWaiting();
});
```

### After (sw.js)
```javascript
const CACHE_NAME = 'rdobra-v2';
const RUNTIME_CACHE = 'rdobra-runtime-v2';
const FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './db/db.js',
  './db/projects.js',
  './db/teams.js',
  './db/settings.js',
  './db/drafts.js',
  './db/reports.js',
  './db/index.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e=>{
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e=>{
  // Cache-first for app files
  if (e.request.url.includes('.js') || e.request.url.includes('.css')) {
    e.respondWith(
      caches.match(e.request)
        .then(response => response || fetch(e.request))
        .catch(() => new Response('Offline'))
    );
  }
  // Network-first for data
  else {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          caches.open(RUNTIME_CACHE).then(c => c.put(e.request, response.clone()));
          return response;
        })
        .catch(() => caches.match(e.request))
    );
  }
});
```

## Phase 4: Rollback Plan

If issues arise:

```javascript
async function rollback() {
  console.warn('⚠️ Rolling back to previous version...');
  
  // Delete new database
  await deleteDatabase();
  
  // Clear new caches
  const cacheNames = await caches.keys();
  for (const name of cacheNames) {
    if (name.includes('rdobra-v2')) {
      await caches.delete(name);
    }
  }
  
  // Unregister new service worker
  const registration = await navigator.serviceWorker.getRegistration();
  if (registration) {
    await registration.unregister();
  }
  
  console.log('✅ Rollback complete. Please refresh the page.');
}
```

## Checklist

- [ ] Test migration script locally
- [ ] Backup existing data
- [ ] Run migration on staging environment
- [ ] Verify all reports migrated
- [ ] Verify all photos intact
- [ ] Verify logo migrated
- [ ] Test offline functionality
- [ ] Update documentation
- [ ] Deploy to production
- [ ] Monitor for issues
- [ ] Archive old database after 30 days

## Support

If issues occur:
1. Check browser console for errors
2. Run `await checkDatabaseHealth()`
3. Inspect IndexedDB in DevTools
4. Check Service Worker status
5. Clear cache: `await clearDatabase()`
6. Run rollback if needed

## Verification Commands

```javascript
// In browser console:
import { getDatabaseStats, checkDatabaseHealth, getProjectCount } from './db/index.js';

// Check stats
await getDatabaseStats();

// Check health
await checkDatabaseHealth();

// Count projects
await getProjectCount();

// Backup before cleanup
const backup = await backupDatabase();
console.log(backup);
```
