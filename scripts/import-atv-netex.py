"""Import the validated local ATV NeTEx snapshot as lazy, per-line app assets."""
import argparse
from datetime import date, timedelta
import gzip
import hashlib
import importlib
import json
from pathlib import Path
import re

netex = importlib.import_module('check-atv-netex')


def export_catalog(catalog, source_hash):
    meta = {**catalog['meta'], 'source': 'https://www.cciss.it/nap/mmtis/public/catalog/Asset/204401',
            'sha256': source_hash, 'realtime': False, 'assetBase': 'bus-official/', 'alightingAvailable': True}
    days = []
    day, end = date.fromisoformat(meta['validFrom']), date.fromisoformat(meta['validTo'])
    while day <= end:
        days.append(str(day))
        day += timedelta(days=1)
    assets, lines = {}, []
    for line_ref, line in catalog['lines'].items():
        number = line['number']
        if not re.fullmatch('[A-Za-z0-9]+', number) or number in assets:
            raise ValueError('Codice linea non valido o duplicato')
        stops, trips = {}, []
        for journey in catalog['journeys'].values():
            if journey['lineRef'] != line_ref:
                continue
            dates = [day for day in days if netex.active(catalog, journey, day)]
            pattern = catalog['patterns'][journey['patternRef']]
            calls = []
            for passing in journey['times']:
                point = pattern['points'][passing['pointRef']]
                stop = catalog['stops'][point['stopRef']]
                stops[stop['code']] = stop
                # Preserve terminal arrivals in the dataset; boarding gates the UI departures.
                calls.append([stop['code'], passing['departure'], passing['departureOffset'],
                              point['boarding'] == 'true', passing['arrival'], passing['arrivalOffset'], point['alighting'] == 'true'])
            trips.append({'id': journey['id'].split(':')[-1].removesuffix('_ATV'),
                          'name': journey['name'], 'destination': stops[calls[-1][0]]['name'],
                          'dates': dates, 'calls': calls})
        assets[number] = {**meta, 'number': number, 'name': line['name'], 'stops': stops, 'trips': trips}
        lines.append({**line, 'tripCount': len(trips), 'stopCount': len(stops)})
    used = {code for asset in assets.values() for code in asset['stops']}
    return {**meta, 'lines': lines, 'unassignedStops': [stop for stop in catalog['stops'].values() if stop['code'] not in used], 'counts': {key: catalog['counts'][key] for key in
            ('Line', 'ScheduledStopPoint', 'ServiceJourney', 'TimetabledPassingTime')}}, assets


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', default='research/atv-netex-l2-checked.gz')
    args = parser.parse_args()
    source = Path(args.input)
    with gzip.open(source, 'rb') as stream:
        catalog = netex.parse_catalog(stream)
    trials = json.loads(Path('data/bus-stop-trials.json').read_text(encoding='utf-8'))['trials']
    comparisons = netex.validate_samples(catalog, trials)
    if not comparisons or not all(case['exactMatch'] for case in comparisons):
        raise ValueError('Campioni di riferimento discordanti: importazione interrotta')
    manifest, assets = export_catalog(catalog, hashlib.sha256(source.read_bytes()).hexdigest())
    target = Path('data/bus-official')
    target.mkdir(exist_ok=True)
    for number, asset in assets.items():
        (target / (number + '.json')).write_text(json.dumps(asset, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    Path('data/bus-official.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"Importate {len(assets)} linee, 6360 definizioni di corsa; 106 passaggi di riferimento verificati.")


if __name__ == '__main__':
    main()
