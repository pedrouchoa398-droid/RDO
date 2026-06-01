/**
 * Projects Data Layer
 * Manages project (obra) CRUD operations with full validation and error handling
 */

import { executeStoreOperation } from './db.js';

/**
 * Project schema validation
 */
function validateProject(project) {
  if (!project.id) throw new Error('Project ID is required');
  if (!project.name || typeof project.name !== 'string') {
    throw new Error('Project name is required and must be a string');
  }
  if (project.name.trim().length === 0) {
    throw new Error('Project name cannot be empty');
  }
  return {
    id: project.id,
    name: project.name.trim(),
    description: project.description || '',
    createdAt: project.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: project.isActive !== false,
    metadata: project.metadata || {}
  };
}

/**
 * Create a new project
 */
export async function createProject(projectData) {
  try {
    const project = validateProject({
      id: projectData.id || `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...projectData
    });

    return await executeStoreOperation('projects', 'readwrite', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.add(project);
        request.onsuccess = () => {
          console.log(`Project created: ${project.id}`);
          resolve(project);
        };
        request.onerror = () => reject(request.error);
      });
    });
  } catch (error) {
    console.error('Error creating project:', error.message);
    throw error;
  }
}

/**
 * Get project by ID
 */
export async function getProject(projectId) {
  if (!projectId) throw new Error('Project ID is required');

  return await executeStoreOperation('projects', 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.get(projectId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  });
}

/**
 * Get all projects
 */
export async function getAllProjects() {
  return await executeStoreOperation('projects', 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  });
}

/**
 * Get active projects only
 */
export async function getActiveProjects() {
  const projects = await getAllProjects();
  return projects.filter(p => p.isActive !== false);
}

/**
 * Search projects by name (case-insensitive)
 */
export async function searchProjects(query) {
  if (!query || typeof query !== 'string') {
    return [];
  }

  const projects = await getAllProjects();
  const lowerQuery = query.toLowerCase();
  return projects.filter(p => 
    p.name.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Update project
 */
export async function updateProject(projectId, updates) {
  if (!projectId) throw new Error('Project ID is required');

  try {
    const existing = await getProject(projectId);
    if (!existing) throw new Error(`Project ${projectId} not found`);

    const updated = validateProject({
      ...existing,
      ...updates,
      id: projectId, // Ensure ID doesn't change
      createdAt: existing.createdAt // Preserve creation date
    });

    return await executeStoreOperation('projects', 'readwrite', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.put(updated);
        request.onsuccess = () => {
          console.log(`Project updated: ${projectId}`);
          resolve(updated);
        };
        request.onerror = () => reject(request.error);
      });
    });
  } catch (error) {
    console.error('Error updating project:', error.message);
    throw error;
  }
}

/**
 * Delete project (soft delete by marking inactive)
 */
export async function deleteProject(projectId) {
  if (!projectId) throw new Error('Project ID is required');

  try {
    return await updateProject(projectId, { isActive: false });
  } catch (error) {
    console.error('Error deleting project:', error.message);
    throw error;
  }
}

/**
 * Permanently delete project (hard delete)
 */
export async function purgeProject(projectId) {
  if (!projectId) throw new Error('Project ID is required');

  try {
    return await executeStoreOperation('projects', 'readwrite', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.delete(projectId);
        request.onsuccess = () => {
          console.log(`Project permanently deleted: ${projectId}`);
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    });
  } catch (error) {
    console.error('Error purging project:', error.message);
    throw error;
  }
}

/**
 * Batch create projects
 */
export async function batchCreateProjects(projectsData) {
  if (!Array.isArray(projectsData)) {
    throw new Error('Projects data must be an array');
  }

  const results = [];
  const errors = [];

  for (const projectData of projectsData) {
    try {
      const project = await createProject(projectData);
      results.push({ success: true, project });
    } catch (error) {
      errors.push({ success: false, error: error.message, data: projectData });
    }
  }

  return { results, errors };
}

/**
 * Get project count
 */
export async function getProjectCount() {
  return await executeStoreOperation('projects', 'readonly', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
}

/**
 * Export projects to JSON
 */
export async function exportProjects() {
  const projects = await getAllProjects();
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    count: projects.length,
    data: projects
  };
}

/**
 * Import projects from JSON
 */
export async function importProjects(importData) {
  if (!Array.isArray(importData)) {
    throw new Error('Import data must be an array of projects');
  }

  return batchCreateProjects(importData);
}
