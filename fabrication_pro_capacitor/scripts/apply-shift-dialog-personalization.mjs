import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();

function replaceOnce(relativePath,from,to) {
  const filePath=path.join(root,relativePath);
  const source=fs.readFileSync(filePath,'utf8');
  const count=source.split(from).length-1;
  if (count!==1) throw new Error(`${relativePath}: expected exactly one replacement target, found ${count}`);
  fs.writeFileSync(filePath,source.replace(from,to));
  console.log(`Updated ${relativePath}`);
}

replaceOnce(
  'www/app/settings.js',
  `      const warning='Enable Shift Schedule? Manual Clock In becomes required. Active timers stop now. Enabled Break, Lunch, and scheduled Clock Out boundaries will control Task Logging.';\n      if (!await confirmAppAction(warning)) {`,
  `      const enableConfirmed=await confirmAppAction({\n        title:'Enable Shift Schedule?',\n        message:'Enable Shift Schedule to require Manual Clock In. Active timers stop now. Enabled Break, Lunch, and scheduled Clock Out boundaries will control Task Logging.',\n        confirmLabel:'Enable Shift Schedule',\n        cancelLabel:'Cancel'\n      });\n      if (!enableConfirmed) {`
);

replaceOnce(
  'www/app/settings.js',
  `      const warning='Disable Shift Schedule? Task Logging returns to unrestricted behavior. Automatic Break, Lunch, Clock Out, and clock-in protection are turned off.';\n      if (!await confirmAppAction(warning)) {`,
  `      const disableConfirmed=await confirmAppAction({\n        title:'Disable Shift Schedule?',\n        message:'Disable Shift Schedule to return Task Logging to unrestricted behavior. Automatic Break, Lunch, Clock Out, and clock-in protection are turned off.',\n        confirmLabel:'Disable Shift Schedule',\n        cancelLabel:'Cancel',\n        danger:true\n      });\n      if (!disableConfirmed) {`
);

replaceOnce(
  'www/index.html',
  `          <li><b>Fabri-Cadabra Confirmation Dialogs:</b> Replaced browser-native confirmation popups across Clock Out, Shift Schedule controls, destructive deletes and clears, overwrite/import/restore actions, and optimizer cut-status changes with one reusable app-styled modal featuring configurable titles and button labels, danger styling, keyboard focus trapping, Escape cancellation, backdrop cancellation, and previous-focus restoration.</li>`,
  `          <li><b>Fabri-Cadabra Confirmation Dialogs:</b> Replaced browser-native confirmation popups across Clock Out, Shift Schedule controls, destructive deletes and clears, overwrite/import/restore actions, and optimizer cut-status changes with one reusable app-styled modal featuring configurable titles and button labels, danger styling, keyboard focus trapping, Escape cancellation, backdrop cancellation, and previous-focus restoration.</li>\n          <li><b>Shift Schedule Confirmation:</b> Gave Enable and Disable Shift Schedule dedicated confirmation titles and action labels so schedule controls can never inherit Clock In or Clock Out wording from explanatory text.</li>`
);

const releasePath=path.join(root,'release.json');
const release=JSON.parse(fs.readFileSync(releasePath,'utf8'));
if (release.version!=='1.0.5' || release.previousVersion!=='1.0.4' || Number(release.buildNumber)!==1000008) {
  throw new Error(`Unexpected release baseline: ${JSON.stringify(release)}`);
}
release.buildNumber=1000009;
fs.writeFileSync(releasePath,JSON.stringify(release,null,2)+'\n');
console.log('Updated release.json to 1.0.5 native build 1000009');
