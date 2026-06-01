/**
 * Database Index Entry Point
 * Aggregates all data layer modules for easy import
 */

export * from './db.js';
export * from './projects.js';
export * from './teams.js';
export * from './settings.js';
export * from './drafts.js';
export * from './reports.js';

/**
 * Database initialization and health check
 */
import { getDB, getDatabaseStats, STORES } from './db.js';

export async function initializeApp() {
  try {
    console.log('🔧 Initializing RDO Database Layer...');
    
    // Initialize database
    await getDB();
    console.log('✅ Database initialized');

    // Get stats
    const stats = await getDatabaseStats();
    console.log('📊 Database stats:', stats);

    return { success: true, stats };
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Health check for database
 */
export async function checkDatabaseHealth() {
  try {
    const stats = await getDatabaseStats();
    const allStores = Object.keys(STORES);
    const availableStores = Object.keys(stats);

    const isHealthy = allStores.every(store => availableStores.includes(store));

    return {
      healthy: isHealthy,
      stores: stats,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Database health check failed:', error.message);
    return {
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Comprehensive database backup
 */
export async function backupDatabase() {
  try {
    const {
      getAllProjects,
      getProjectTeams,
      getAllLogos,
      getAllSettings,
      getProjectDrafts,
      getProjectReports
    } = await import('./index.js');

    const projects = await getAllProjects();
    const backup = {
      version: 1,
      backupTime: new Date().toISOString(),
      projects: []
    };

    for (const project of projects) {
      const teams = await getProjectTeams(project.id);
      const drafts = await getProjectDrafts(project.id);
      const reports = await getProjectReports(project.id);
      const logo = await (async () => {
        try {
          const logos = await getAllLogos();
          return logos.find(l => l.projectId === project.id) || null;
        } catch {
          return null;
        }
      })();

      backup.projects.push({
        project,
        teams,
        drafts,
        reports,
        logo
      });
    }

    // Also backup settings and logos
    backup.settings = await getAllSettings();
    backup.logos = await getAllLogos();

    return backup;
  } catch (error) {
    console.error('❌ Database backup failed:', error.message);
    throw error;
  }
}

/**
 * Restore database from backup
 */
export async function restoreDatabase(backup) {
  try {
    if (!backup || !Array.isArray(backup.projects)) {
      throw new Error('Invalid backup format');
    }

    const {
      createProject,
      createTeam,
      createDraft,
      createReport,
      setProjectLogo,
      setSettings
    } = await import('./index.js');

    let projectCount = 0;
    let teamCount = 0;
    let draftCount = 0;
    let reportCount = 0;

    for (const { project, teams, drafts, reports, logo } of backup.projects) {
      // Restore project
      await createProject(project);
      projectCount++;

      // Restore teams
      for (const team of teams) {
        await createTeam(team);
        teamCount++;
      }

      // Restore drafts
      for (const draft of drafts) {
        await createDraft(draft);
        draftCount++;
      }

      // Restore reports
      for (const report of reports) {
        await createReport(report);
        reportCount++;
      }

      // Restore logo
      if (logo) {
        await setProjectLogo(project.id, logo);
      }
    }

    // Restore settings
    if (backup.settings) {
      await setSettings(backup.settings);
    }

    console.log(`✅ Database restored: ${projectCount} projects, ${teamCount} teams, ${draftCount} drafts, ${reportCount} reports`);

    return {
      success: true,
      projectCount,
      teamCount,
      draftCount,
      reportCount
    };
  } catch (error) {
    console.error('❌ Database restore failed:', error.message);
    throw error;
  }
}
