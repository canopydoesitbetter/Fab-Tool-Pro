import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const PRIVACY_FILE_REF_ID = 'FA6C00000000000000000001';
export const PRIVACY_BUILD_FILE_ID = 'FA6C00000000000000000002';

export function privacyManifestXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>C617.1</string>
      </array>
    </dict>
  </array>
  <key>NSPrivacyCollectedDataTypes</key>
  <array/>
  <key>NSPrivacyTracking</key>
  <false/>
  <key>NSPrivacyTrackingDomains</key>
  <array/>
</dict>
</plist>
`;
}

export function patchIosProject(projectText) {
  let project = String(projectText);
  if (project.includes('PrivacyInfo.xcprivacy')) return project;

  if (project.includes(PRIVACY_FILE_REF_ID) || project.includes(PRIVACY_BUILD_FILE_ID)) {
    throw new Error('Reserved Xcode object IDs are already in use.');
  }

  const buildMarker = '/* End PBXBuildFile section */';
  const fileMarker = '/* End PBXFileReference section */';
  if (!project.includes(buildMarker) || !project.includes(fileMarker)) {
    throw new Error('The generated Xcode project format was not recognized.');
  }

  project = project.replace(
    buildMarker,
    `\t\t${PRIVACY_BUILD_FILE_ID} /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = ${PRIVACY_FILE_REF_ID} /* PrivacyInfo.xcprivacy */; };\n${buildMarker}`
  );
  project = project.replace(
    fileMarker,
    `\t\t${PRIVACY_FILE_REF_ID} /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };\n${fileMarker}`
  );

  const appGroupPattern = /(\/\* App \*\/ = \{\s*isa = PBXGroup;\s*children = \(\s*)/;
  if (!appGroupPattern.test(project)) throw new Error('The App PBXGroup was not found.');
  project = project.replace(
    appGroupPattern,
    `$1\t\t\t\t${PRIVACY_FILE_REF_ID} /* PrivacyInfo.xcprivacy */,\n`
  );

  const resourcesPattern = /(\/\* Resources \*\/ = \{\s*isa = PBXResourcesBuildPhase;[\s\S]*?files = \(\s*)/;
  if (!resourcesPattern.test(project)) throw new Error('The App Resources build phase was not found.');
  project = project.replace(
    resourcesPattern,
    `$1\t\t\t\t${PRIVACY_BUILD_FILE_ID} /* PrivacyInfo.xcprivacy in Resources */,\n`
  );

  return project;
}

export function installIosPrivacyManifest(root) {
  // @capacitor/filesystem uses file timestamp APIs. Apple requires an app
  // privacy manifest declaring NSPrivacyAccessedAPICategoryFileTimestamp with
  // reason C617.1. The file also has to be included in the App target's
  // Resources phase; simply placing it on disk is not sufficient.
  const appDir = join(root, 'ios', 'App', 'App');
  const manifestPath = join(appDir, 'PrivacyInfo.xcprivacy');
  const projectPath = join(root, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');

  if (!existsSync(projectPath)) {
    throw new Error(`Unable to find the generated iOS Xcode project at ${projectPath}`);
  }

  mkdirSync(appDir, { recursive: true });
  writeFileSync(manifestPath, privacyManifestXml(), 'utf8');

  const existing = readFileSync(projectPath, 'utf8');
  const patched = patchIosProject(existing);
  if (patched !== existing) {
    writeFileSync(projectPath, patched, 'utf8');
  }
  return { manifestPath, projectPath, changed: patched !== existing };
}
