import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const html = readFileSync(join(root, 'www', 'index.html'), 'utf8');
const uxStyles = readFileSync(join(root, 'www', 'ux.css'), 'utf8');
const ux = readFileSync(join(root, 'www', 'ux.js'), 'utf8');

function requireMatch(source, pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}

requireMatch(html, /<summary class="management-summary"><span>Task Logging Management<\/span>/, 'Task Logging Management summary is missing.');
requireMatch(html, /<summary class="management-summary"><span>Notes Management<\/span>/, 'Notes Management summary is missing.');
requireMatch(uxStyles, /\.management-summary\s*>\s*span:first-child\s*\{[^}]*color:\s*var\(--accent\)/s, 'Collapsed management titles must use the established Fabri-Cadabra accent color.');

const taskLogJobsDetails = html.match(/<details id="taskLogJobsDetails"[^>]*>[\s\S]*?<\/details>/)?.[0] || '';
if (!taskLogJobsDetails) throw new Error('Task Logging Jobs must use a collapsible details panel.');
if (/^<details[^>]*\sopen(?:\s|>|=)/.test(taskLogJobsDetails)) throw new Error('Task Logging Jobs must start collapsed by default.');
requireMatch(taskLogJobsDetails, /<summary class="management-summary"><span>Jobs<\/span>/, 'Task Logging Jobs summary is missing.');
if (!taskLogJobsDetails.includes('id="taskLogJobCount"')) throw new Error('Task Logging Jobs summary must retain the live job count.');
if (!taskLogJobsDetails.includes('id="taskLogJobList"')) throw new Error('Task Logging job list must remain inside the collapsible Jobs panel.');

requireMatch(html, /<label for="taskLogJobTitle">Job # \/ Name<\/label>/, 'Job # / Name label is missing.');
requireMatch(html, /<label for="fabricatorNotesTitle">Topic<\/label>/, 'Topic label is missing.');
requireMatch(uxStyles, /label\[for="taskLogJobTitle"\][\s\S]*label\[for="fabricatorNotesTitle"\][^{]*\{[^}]*color:\s*var\(--accent\)/s, 'Job # / Name and Topic labels must use the established accent color.');

const notesManagement = html.match(/<details id="fabricatorNotesManagementDetails"[\s\S]*?<\/details>/)?.[0] || '';
if (!notesManagement) throw new Error('Notes Management details block is missing.');
if (!notesManagement.includes('id="fabricatorNotesTopicsBtn"')) throw new Error('Topics launcher compatibility markup is missing from Notes Management source.');
requireMatch(ux, /const fabricatorNotesEditor=document\.getElementById\('fabricatorNotesEditor'\);/, 'Fabricator Notes editor must be resolved for Topics button placement.');
requireMatch(ux, /fabricatorNotesTopicsBtn\.classList\.add\('notes-topics-inline-btn'\);/, 'Topics button must receive the inline editor styling hook.');
requireMatch(ux, /fabricatorNotesEditor\.insertBefore\(fabricatorNotesTopicsBtn,fabricatorNotesEditor\.firstElementChild\);/, 'Topics button must move above the Topic input at runtime.');
requireMatch(uxStyles, /\.notes-topics-inline-btn\s*\{[^}]*width:\s*100%/s, 'Topics button inside the Topic panel must span the full available width.');
requireMatch(uxStyles, /\.notes-management-actions\s*\{[^}]*grid-template-columns:\s*repeat\(3,minmax\(0,1fr\)\)/s, 'Notes Management must reflow to three controls after Topics moves into the editor.');

console.log('Management accent colors, collapsible Task Logging Jobs, and inline Topics layout: OK');