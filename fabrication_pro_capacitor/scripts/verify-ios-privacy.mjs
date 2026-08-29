import {
  patchIosProject,
  privacyManifestXml,
  PRIVACY_FILE_REF_ID,
  PRIVACY_BUILD_FILE_ID
} from './ios-privacy.mjs';

const fixture = `// !$*UTF8*$!
{
objects = {
/* Begin PBXBuildFile section */
\t\tAAAA00000000000000000001 /* Main.storyboard in Resources */ = {isa = PBXBuildFile; fileRef = BBBB00000000000000000001 /* Main.storyboard */; };
/* End PBXBuildFile section */
/* Begin PBXFileReference section */
\t\tBBBB00000000000000000001 /* Main.storyboard */ = {isa = PBXFileReference; path = Main.storyboard; sourceTree = "<group>"; };
/* End PBXFileReference section */
/* Begin PBXGroup section */
\t\tCCCC00000000000000000001 /* App */ = {
\t\t\tisa = PBXGroup;
\t\t\tchildren = (
\t\t\t\tBBBB00000000000000000001 /* Main.storyboard */,
\t\t\t);
\t\t\tpath = App;
\t\t\tsourceTree = "<group>";
\t\t};
/* End PBXGroup section */
/* Begin PBXResourcesBuildPhase section */
\t\tDDDD00000000000000000001 /* Resources */ = {
\t\t\tisa = PBXResourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t\tAAAA00000000000000000001 /* Main.storyboard in Resources */,
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};
/* End PBXResourcesBuildPhase section */
};
}`;

const patched = patchIosProject(fixture);
if (!patched.includes(`${PRIVACY_FILE_REF_ID} /* PrivacyInfo.xcprivacy */`)) {
  throw new Error('Privacy manifest file reference was not added.');
}
if (!patched.includes(`${PRIVACY_BUILD_FILE_ID} /* PrivacyInfo.xcprivacy in Resources */`)) {
  throw new Error('Privacy manifest resource build entry was not added.');
}
if ((patched.match(/PrivacyInfo\.xcprivacy/g) || []).length < 4) {
  throw new Error('Privacy manifest was not added to all required Xcode project locations.');
}
if (patchIosProject(patched) !== patched) {
  throw new Error('iOS privacy project patch is not idempotent.');
}
const manifest = privacyManifestXml();
if (!manifest.includes('NSPrivacyAccessedAPICategoryFileTimestamp') || !manifest.includes('C617.1')) {
  throw new Error('Privacy manifest is missing the Filesystem required-reason declaration.');
}

console.log('iOS privacy manifest declaration: OK');
console.log('iOS Xcode target resource patch: OK');
console.log('iOS privacy patch idempotence: OK');
