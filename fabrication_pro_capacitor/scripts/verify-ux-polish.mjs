import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root=process.cwd();
const html=readFileSync(join(root,'www','index.html'),'utf8');
const styles=readFileSync(join(root,'www','styles.css'),'utf8');
const app=readFileSync(join(root,'www','app.js'),'utf8');
function need(condition,message){if(!condition)throw new Error(message);}
need(!existsSync(join(root,'www','ux.js')) && !existsSync(join(root,'www','ux.css')),'Retired ux.js / ux.css files must be absent.');
need(!/ux\.js|ux\.css/.test(html),'index.html must not reference retired UX patch assets.');
need(html.includes('<summary class="management-summary"><span>Task Logging Management</span>'),'Task Logging Management summary is missing.');
need(html.includes('<summary class="management-summary"><span>Notes Management</span>'),'Notes Management summary is missing.');
need(/\.management-summary\s*>\s*span:first-child\s*\{[^}]*color:\s*var\(--accent\)/s.test(styles),'Collapsed management titles must use the established accent color.');
const jobs=html.match(/<details id="taskLogJobsDetails"[^>]*>[\s\S]*?<\/details>/)?.[0] || '';
need(jobs && !/^<details[^>]*\sopen(?:\s|>|=)/.test(jobs),'Task Logging Jobs must start collapsed by default.');
need(jobs.includes('id="taskLogJobCount"') && jobs.includes('id="taskLogJobList"'),'Task Logging Jobs panel structure changed.');
need(html.includes('<label for="taskLogJobTitle">Job # / Name</label>'),'Job # / Name label is missing.');
need(html.includes('<label for="fabricatorNotesTitle">Topic</label>'),'Topic label is missing.');
need(/label\[for="taskLogJobTitle"\][\s\S]*label\[for="fabricatorNotesTitle"\][^{]*\{[^}]*color:\s*var\(--accent\)/s.test(styles),'Job # / Name and Topic labels must use the established accent color.');
const notesManagement=html.match(/<details id="fabricatorNotesManagementDetails"[\s\S]*?<\/details>/)?.[0] || '';
need(notesManagement && !notesManagement.includes('id="fabricatorNotesTopicsBtn"'),'Topics launcher must not be relocated from Notes Management at runtime; it belongs in the editor source.');
const notesEditor=html.match(/<div id="fabricatorNotesEditor" class="notes-editor-fields">[\s\S]*?<div>/)?.[0] || '';
need(notesEditor.includes('id="fabricatorNotesTopicsBtn"') && notesEditor.includes('notes-topics-inline-btn'),'Topics button must be authored in its final editor position.');
need(/\.notes-topics-inline-btn\s*\{[^}]*width:\s*100%/s.test(styles),'Topics button must span the editor width.');
need(!/moveStatusOutsideManagement|insertBefore\(fabricatorNotesTopicsBtn|installSettingsPage/.test(app),'Runtime UI relocation/injection must be absent.');
need(!/new\s+MutationObserver/.test(app),'Task Logging must not rely on MutationObserver repair.');
need(app.includes('data-tasklog-remove-assigned') && app.includes('data-tasklog-delete-preset'),'Task Logging renderer must emit final assigned/remove and library/delete semantics directly.');
need(!/normalizeAssignedPresetActions|removeAssignedTaskLogPreset/.test(app),'Post-render Task Logging repair logic must be absent.');
console.log('Canonical management, Notes, and Task Logging UI ownership: OK');
