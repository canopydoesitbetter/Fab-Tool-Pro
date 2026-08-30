from pathlib import Path
import json, sys

root=Path(sys.argv[1] if len(sys.argv)>1 else '.')

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

signing_path=root/'scripts/android-signing.mjs'
signing=signing_path.read_text(encoding='utf-8')
signing=signing.replace('Fabrication Pro','Fabri-Cadabra').replace('fabricationProRelease','fabriCadabraRelease').replace('fabricationProKeystore','fabriCadabraKeystore')
signing_path.write_text(signing,encoding='utf-8')
verify_path=root/'scripts/verify-android-signing.mjs'
verify=verify_path.read_text(encoding='utf-8').replace('fabricationProRelease','fabriCadabraRelease')
verify_path.write_text(verify,encoding='utf-8')

spec_path=root/'docs/superpowers/specs/2026-08-30-canonical-source-refactor-design.md'
if spec_path.exists():
    spec=spec_path.read_text(encoding='utf-8')
    spec=spec.replace(
        'Installer artifact filenames are not compatibility-sensitive identifiers, but renaming them is not required for this structural refactor. The build workflow may retain existing artifact filenames to minimize unrelated release-pipeline churn; visible product naming in the app and documentation is the canonical naming requirement.',
        'Installer artifact filenames are not compatibility-sensitive identifiers, so they will also be normalized to `Fabri-Cadabra` for one consistent official product name across source, launcher/display labels, documentation, and release artifacts.'
    )
    spec=spec.replace(
        '14. Visible app/product naming is `Fabri-Cadabra`; release artifact filenames may remain unchanged.',
        '14. Visible app/product naming, Android/iOS launcher/display names, and installer artifact filenames use `Fabri-Cadabra`.'
    )
    spec_path.write_text(spec,encoding='utf-8')

for obsolete in [root/'www/fabri-cadabra.js',root/'source/fabrication_pro.original.html',root/'SOURCE_SHA256.txt']:
    if obsolete.exists(): obsolete.unlink()

print('Canonical project naming and legacy-source cleanup completed.')
