"""Stage a fresh official NeTEx archive. Apply explicitly, with build/test rollback."""
import argparse
from datetime import date, datetime, timezone, timedelta
import gzip
import hashlib
import importlib
import io
import json
import math
import re
from pathlib import Path
import subprocess
import sys
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
URL = 'https://www.cciss.it/nap/mmtis/public/api/v1/download/blob/Asset/204401/checkedResource'
netex = importlib.import_module('check-atv-netex')
exporter = importlib.import_module('import-atv-netex')


def validate_candidate(manifest, assets, installed, today):
    first, last = date.fromisoformat(manifest['validFrom']), date.fromisoformat(manifest['validTo'])
    if first > last or last < today or first > today + timedelta(days=14):
        raise ValueError('Archivio scaduto o intervallo inatteso')
    published = datetime.fromisoformat(manifest['publicationTimestamp'])
    if published.date() > today + timedelta(days=1):
        raise ValueError('Pubblicazione nel futuro')
    if len(assets) < max(1, len(installed.get('lines', [])) * .7):
        raise ValueError('Calo delle linee superiore al 30%: revisione manuale necessaria')
    trips = [trip for asset in assets.values() for trip in asset['trips']]
    if len(trips) < installed.get('counts', {}).get('ServiceJourney', 0) * .7:
        raise ValueError('Calo delle corse superiore al 30%: revisione manuale necessaria')
    ids = [trip['id'] for trip in trips]
    if len(ids) != len(set(ids)) or not any(trip['dates'] for trip in trips):
        raise ValueError('Corse duplicate o nessun calendario attivo')
    counts = manifest.get('counts', {})
    actual_counts = {'Line': len(assets), 'ServiceJourney': len(trips), 'TimetabledPassingTime': sum(len(trip['calls']) for trip in trips)}
    if any(counts.get(name) != value for name, value in actual_counts.items()):
        raise ValueError('Conteggi esportati discordanti dalla pubblicazione')
    for number, asset in assets.items():
        for stop in asset['stops'].values():
            if any(not isinstance(stop.get(field), (int, float)) or not math.isfinite(stop[field]) or abs(stop[field]) > limit for field, limit in [('lat', 90), ('lon', 180)]):
                raise ValueError('Coordinate fermata non valide')
        for trip in asset['trips']:
            if any(day < manifest['validFrom'] or day > manifest['validTo'] for day in trip['dates']):
                raise ValueError('Calendario fuori validità')
            for call in trip['calls']:
                if len(call) != 7 or call[0] not in asset['stops'] or not isinstance(call[3], bool) or not isinstance(call[6], bool):
                    raise ValueError('Permessi o riferimenti fermata non validi')
                if not isinstance(call[1], str) or not re.fullmatch(r'([01]\d|2[0-3]):[0-5]\d:[0-5]\d', call[1]) or call[4] is not None and not re.fullmatch(r'([01]\d|2[0-3]):[0-5]\d:[0-5]\d', call[4]) or any(not isinstance(call[i], int) or call[i] < 0 or call[i] > 2 for i in [2, 5]):
                    raise ValueError('Ora o scostamento di giorno non valido')
    return {'checkedAt': datetime.now(timezone.utc).isoformat(), 'source': URL,
            'installedSha256': installed.get('sha256'), 'candidateSha256': manifest['sha256'],
            'changed': installed.get('sha256') != manifest['sha256'],
            'validFrom': str(first), 'validTo': str(last), 'lineCount': len(assets), 'tripCount': len(trips),
            'installedDaysLeft': (date.fromisoformat(installed['validTo']) - today).days,
            'status': 'validated_candidate', 'applied': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', help='Existing gzip file, for offline validation')
    parser.add_argument('--apply', action='store_true', help='Replace sources only after validation; rollback on failed checks')
    args = parser.parse_args()
    if args.input:
        raw = Path(args.input).read_bytes()
    else:
        request = urllib.request.Request(URL, headers={'User-Agent': 'VeronaInTasca-archive-check/1.0 (+https://veronaintasca.it/)'})
        with urllib.request.urlopen(request, timeout=45) as response:
            raw = response.read(16_000_001)
    if len(raw) > 16_000_000:
        raise ValueError('Archivio compresso troppo grande')
    with gzip.GzipFile(fileobj=io.BytesIO(raw)) as stream:
        xml = stream.read(256_000_001)
    if len(xml) > 256_000_000:
        raise ValueError('Archivio XML troppo grande')
    catalog = netex.parse_catalog(io.BytesIO(xml))
    manifest, assets = exporter.export_catalog(catalog, hashlib.sha256(raw).hexdigest())
    installed_path = ROOT / 'data/bus-official.json'
    installed = json.loads(installed_path.read_text(encoding='utf-8'))
    today = datetime.now(netex.ROME).date()
    report = validate_candidate(manifest, assets, installed, today)
    stage = ROOT / '.local/atv-renewal'
    stage.mkdir(parents=True, exist_ok=True)
    (stage / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    (stage / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    if args.apply:
        if manifest['validFrom'] > str(today):
            raise ValueError('Archivio futuro: conservarlo come candidato, senza sostituire quello valido oggi')
        # Only named, validated line files in the data directory are touched. Keep old bytes for rollback.
        paths = {ROOT / 'data/bus-official' / (number + '.json'): json.dumps(asset, ensure_ascii=False, separators=(',', ':')).encode('utf-8') for number, asset in assets.items()}
        paths[installed_path] = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
        previous = {path: path.read_bytes() if path.exists() else None for path in paths}
        backup = stage / 'backup'
        backup.mkdir(exist_ok=True)
        for path, value in previous.items():
            if value is not None:
                (backup / (path.name if path != installed_path else 'manifest.json')).write_bytes(value)
        try:
            for path, value in paths.items():
                if not path.resolve().is_relative_to((ROOT / 'data').resolve()):
                    raise ValueError('Percorso di destinazione inatteso')
                path.write_bytes(value)
            subprocess.run(['node', 'scripts/build-calendar.mjs'], cwd=ROOT, check=True)
            subprocess.run(['node', '--test'], cwd=ROOT, check=True)
        except BaseException:
            for path, value in previous.items():
                if value is None:
                    path.unlink(missing_ok=True)
                else:
                    path.write_bytes(value)
            subprocess.run(['node', 'scripts/build-calendar.mjs'], cwd=ROOT, check=False)
            raise
        report['applied'] = True
        (stage / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if not args.apply and report['installedDaysLeft'] <= 7:
        print('ATTENZIONE: archivio installato in scadenza; applicare e verificare il candidato prima della scadenza.', file=sys.stderr)
        raise SystemExit(2)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        stage = ROOT / '.local/atv-renewal'
        stage.mkdir(parents=True, exist_ok=True)
        (stage / 'report.json').write_text(json.dumps({'status': 'error', 'applied': False, 'checkedAt': datetime.now(timezone.utc).isoformat(), 'error': str(error)}, ensure_ascii=False, indent=2), encoding='utf-8')
        (stage / 'manifest.json').write_text('{"status":"validation_failed"}', encoding='utf-8')
        raise
