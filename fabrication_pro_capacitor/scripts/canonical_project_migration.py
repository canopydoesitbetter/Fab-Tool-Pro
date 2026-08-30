from pathlib import Path
import json, sys

root=Path(sys.argv[1] if len(sys.argv)>1 else '.')
repo_root=root.parent

config_path=root/'capacitor.config.json'
config=json.loads(config_path.read_text(encoding='utf-8'))
if config.get('appId')!='com.fabricationpro.app':
    raise SystemExit(f"Unexpected appId: {config.get('appId')}")
config['appName']='Fabri-Cadabra'
config_path.write_text(json.dumps(config,indent=2)+'\n',encoding='utf-8')

package_path=root/'package.json'
pkg=json.loads(package_path.read_text(encoding='utf-8'))
pkg['name']='fabri-cadabra-capacitor'
pkg['description']='Capacitor wrapper and canonical web source for the offline Fabri-Cadabra fabrication toolkit.'
package_path.write_text(json.dumps(pkg,indent=2)+'\n',encoding='utf-8')
lock_path=root/'package-lock.json'
if lock_path.exists():
    lock=json.loads(lock_path.read_text(encoding='utf-8'))
    lock['name']='fabri-cadabra-capacitor'
    if isinstance(lock.get('packages'),dict) and isinstance(lock['packages'].get(''),dict):
        lock['packages']['']['name']='fabri-cadabra-capacitor'
    lock_path.write_text(json.dumps(lock,indent=2)+'\n',encoding='utf-8')

workflow_path=repo_root/'.github/workflows/build-phone-installers.yml'
workflow=workflow_path.read_text(encoding='utf-8')
for old,new in [
    ('name: Build Phone Installers','name: Build Fabri-Cadabra Installers'),
    ('Verify preserved web app and build configuration','Verify Fabri-Cadabra source and build configuration'),
    ('Verify preserved web app','Verify Fabri-Cadabra source'),
    ('fabrication-pro-release.jks','fabri-cadabra-release.jks'),
    ('permanent Fabrication Pro certificate','permanent Fabri-Cadabra certificate'),
    ('Fabrication-Pro-Android','Fabri-Cadabra-Android'),
    ('Fabrication-Pro-iPhone-Unsigned','Fabri-Cadabra-iPhone-Unsigned'),
    ('Fabrication Pro.app','Fabri-Cadabra.app'),
]:
    workflow=workflow.replace(old,new)
android_sync="""      - name: Add and sync Android
        run: |
          npx cap add android
          npx cap sync android
"""
if 'Verify Android launcher name' not in workflow:
    if android_sync not in workflow: raise SystemExit('Android sync block not found.')
    workflow=workflow.replace(android_sync,android_sync+"""
      - name: Verify Android launcher name
        run: |
          set -euo pipefail
          grep -F '<string name="app_name">Fabri-Cadabra</string>' android/app/src/main/res/values/strings.xml
          grep -F '<string name="title_activity_main">Fabri-Cadabra</string>' android/app/src/main/res/values/strings.xml
""",1)
ios_sync="""      - name: Add and sync iOS
        run: |
          npx cap add ios
          npx cap sync ios
"""
if 'Verify iOS display name' not in workflow:
    if ios_sync not in workflow: raise SystemExit('iOS sync block not found.')
    workflow=workflow.replace(ios_sync,ios_sync+"""
      - name: Verify iOS display name
        run: |
          set -euo pipefail
          DISPLAY_NAME="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleDisplayName' ios/App/App/Info.plist)"
          test "$DISPLAY_NAME" = 'Fabri-Cadabra'
          echo "iOS display name verified: $DISPLAY_NAME"
""",1)
workflow_path.write_text(workflow,encoding='utf-8')

pages_path=repo_root/'.github/workflows/deploy-pages.yml'
pages=pages_path.read_text(encoding='utf-8').replace('Fabrication Pro','Fabri-Cadabra')
pages_path.write_text(pages,encoding='utf-8')

signing_path=root/'scripts/android-signing.mjs'
signing=signing_path.read_text(encoding='utf-8')
signing=signing.replace('Fabrication Pro','Fabri-Cadabra').replace('fabricationProRelease','fabriCadabraRelease').replace('fabricationProKeystore','fabriCadabraKeystore')
signing_path.write_text(signing,encoding='utf-8')
verify_path=root/'scripts/verify-android-signing.mjs'
verify=verify_path.read_text(encoding='utf-8').replace('fabricationProRelease','fabriCadabraRelease')
verify_path.write_text(verify,encoding='utf-8')

for obsolete in [root/'www/fabri-cadabra.js',root/'source/fabrication_pro.original.html',root/'SOURCE_SHA256.txt']:
    if obsolete.exists(): obsolete.unlink()

print('Canonical project naming and legacy-source cleanup completed.')
