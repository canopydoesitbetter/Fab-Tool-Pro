import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const html = readFileSync(join(root, 'www', 'index.html'), 'utf8');
const uxStyles = readFileSync(join(root, 'www', 'ux.css'), 'utf8');

function requireMatch(source, pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}

requireMatch(html, /<summary class="management-summary"><span class="management-summary-title">Task Logging Management<\/span>/, 'Task Logging Management must use the shared accent-title class.');
requireMatch(html, /<summary class="management-summary"><span class="management-summary-title">Notes Management<\/span>/, 'Notes Management must use the shared accent-title class.');
requireMatch(uxStyles, /\.management-summary-title\s*\{[^}]*color:\s*var\(--accent\)/s, 'Collapsed management titles must use the established accent color.');
requireMatch(html, /<label class="field-label-accent" for="taskLogJobTitle">Job # \/ Name<\/label>/, 'Job # / Name must use the shared accent field-label class.');
requireMatch(html, /<label class="field-label-accent" for="fabricatorNotesTitle">Topic<\/label>/, 'Topic must use the shared accent field-label class.');
requireMatch(uxStyles, /\.field-label-accent\s*\{[^}]*color:\s*var\(--accent\)/s, 'Requested field labels must use the established accent color.');

const notesManagement = html.match(/<details id="fabricatorNotesManagementDetails"[\s\S]*?<\/details>/)?.[0] || '';
if (!notesManagement) throw new Error('Notes Management details block is missing.');
if (notesManagement.includes('id="fabricatorNotesTopicsBtn"')) throw new Error('Topics button must not remain inside Notes Management.');

const notesEditor = html.match(/<div id="fabricatorNotesEditor" class="notes-editor-fields">[\s\S]*?<div class="notes-editor-footer">/)?.[0] || '';
if (!notesEditor) throw new Error('Fabricator Notes editor block is missing.');
requireMatch(notesEditor, /<button id="fabricatorNotesTopicsBtn" class="cut-list-menu-btn notes-topics-inline-btn"[\s\S]*?<label class="field-label-accent" for="fabricatorNotesTitle">Topic<\/label>/, 'Topics button must span the note editor directly above the Topic input.');
requireMatch(uxStyles, /\.notes-topics-inline-btn\s*\{[^}]*width:\s*100%/s, 'Topics button inside the Topic panel must span the full available width.');

console.log('Management accent colors and inline Topics layout: OK');
