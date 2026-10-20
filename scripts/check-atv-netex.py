"""Offline check of the observed ATV NeTEx profile, not a general NeTEx importer.

Resolve calendars and compare exact stop times with previously verified samples.
Requires Python standard library and the Europe/Rome timezone database.
"""
import argparse
import collections
from datetime import date, datetime, timedelta, timezone
import gzip
import hashlib
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET
from zoneinfo import ZoneInfo

NS = {'n': 'http://www.netex.org.uk/netex'}
ROME = ZoneInfo('Europe/Rome')


def text(element, path):
    value = element.findtext('n:' + path.replace('/', '/n:'), namespaces=NS)
    if value is None:
        raise ValueError('Campo mancante: ' + path)
    return value.strip()


def ref(element, path):
    node = element.find('n:' + path.replace('/', '/n:'), NS)
    if node is None or not node.get('ref'):
        raise ValueError('Riferimento mancante: ' + path)
    return node.get('ref')


def code(value):
    if not value.endswith('_ATV'):
        raise ValueError('Codice operatore inatteso: ' + value)
    return value[:-4]


def period_days(start, end, bits):
    start, end = date.fromisoformat(start[:10]), date.fromisoformat(end[:10])
    size = (end - start).days + 1
    if size <= 0 or len(bits) != size or re.fullmatch('[01]+', bits) is None:
        raise ValueError('Calendario binario incompleto o non valido')
    return {str(start + timedelta(days=i)) for i, bit in enumerate(bits) if bit == '1'}


def wall_instants(service_date, clock, offset=0):
    """Return all valid UTC instants; never guess across a DST gap or fold."""
    if not re.fullmatch(r'\d{2}:\d{2}:\d{2}', clock) or not 0 <= offset <= 2:
        raise ValueError('Ora o scostamento di giorno non supportato')
    wall = datetime.fromisoformat(service_date + 'T' + clock) + timedelta(days=offset)
    values = set()
    for fold in (0, 1):
        aware = wall.replace(tzinfo=ROME, fold=fold)
        instant = aware.astimezone(timezone.utc)
        if instant.astimezone(ROME).replace(tzinfo=None) == wall:
            values.add(instant.isoformat(timespec='milliseconds').replace('+00:00', 'Z'))
    if not values:
        raise ValueError('Ora locale inesistente al cambio di ora')
    return sorted(values)


def put(table, identifier, value):
    if not identifier or identifier in table:
        raise ValueError('Identificativo mancante o duplicato: ' + str(identifier))
    table[identifier] = value


def parse_catalog(stream):
    counts = collections.Counter()
    tables = {name: {} for name in ('lines', 'stops', 'patterns', 'journeys', 'periods', 'day_types')}
    assignments, meta = [], {}
    clear = {'ServiceLink', 'PassengerStopAssignment', 'StopPlace', 'Quay'}
    for _, element in ET.iterparse(stream, events=('end',)):
        tag = element.tag.split('}')[-1]
        counts[tag] += 1
        identifier = element.get('id')
        if tag == 'PublicationTimestamp':
            meta['publicationTimestamp'] = element.text
        elif tag == 'TimeZone':
            if element.text != 'Europe/Rome':
                raise ValueError('Fuso del file non supportato')
            meta['timezone'] = element.text
        elif tag == 'CompositeFrame':
            meta.update(version=element.get('version'), validFrom=text(element, 'ValidBetween/FromDate')[:10], validTo=text(element, 'ValidBetween/ToDate')[:10])
        elif tag == 'Line':
            put(tables['lines'], identifier, {'number': code(text(element, 'PublicCode')), 'name': text(element, 'Name')})
        elif tag == 'ScheduledStopPoint':
            put(tables['stops'], identifier, {'code': code(text(element, 'PublicCode')), 'name': text(element, 'Name'), 'lat': float(text(element, 'Location/Latitude')), 'lon': float(text(element, 'Location/Longitude'))})
        elif tag == 'ServiceJourneyPattern':
            points = {}
            for point in element.findall('n:pointsInSequence/n:StopPointInJourneyPattern', NS):
                put(points, point.get('id'), {'stopRef': ref(point, 'ScheduledStopPointRef'), 'order': int(point.get('order')), 'boarding': text(point, 'ForBoarding'), 'alighting': text(point, 'ForAlighting')})
            if not points or any(p['boarding'] not in ('true', 'false') or p['alighting'] not in ('true', 'false') for p in points.values()):
                raise ValueError('Pattern senza punti o permessi non validi')
            put(tables['patterns'], identifier, {'lineRef': ref(element, 'RouteView/LineRef'), 'points': points})
        elif tag == 'ServiceJourney':
            times = []
            for passing in element.findall('n:passingTimes/n:TimetabledPassingTime', NS):
                departure = passing.findtext('n:DepartureTime', namespaces=NS)
                arrival = passing.findtext('n:ArrivalTime', namespaces=NS)
                if departure is None:
                    raise ValueError('Passing time senza partenza programmata')
                times.append({'pointRef': ref(passing, 'StopPointInJourneyPatternRef'), 'departure': departure, 'arrival': arrival,
                              'departureOffset': int(passing.findtext('n:DepartureDayOffset', default='0', namespaces=NS)),
                              'arrivalOffset': int(passing.findtext('n:ArrivalDayOffset', default='0', namespaces=NS))})
            put(tables['journeys'], identifier, {'id': identifier, 'name': text(element, 'Name'), 'lineRef': ref(element, 'FlexibleLineView/LineRef'), 'patternRef': ref(element, 'ServiceJourneyPatternRef'),
                'dayTypes': [node.get('ref') for node in element.findall('n:dayTypes/n:DayTypeRef', NS)],
                'from': text(element, 'ValidBetween/FromDate')[:10], 'to': text(element, 'ValidBetween/ToDate')[:10], 'times': times})
        elif tag == 'DayType':
            put(tables['day_types'], identifier, text(element, 'properties/PropertyOfDay/DaysOfWeek'))
        elif tag == 'UicOperatingPeriod':
            put(tables['periods'], identifier, period_days(text(element, 'FromDate'), text(element, 'ToDate'), text(element, 'ValidDayBits')))
        elif tag == 'DayTypeAssignment':
            # This file uses only positive operating-period assignments.
            if element.find('n:Date', NS) is not None or element.findtext('n:IsAvailable', default='true', namespaces=NS) != 'true':
                raise ValueError('Forma di assegnazione non ancora supportata')
            assignments.append((ref(element, 'DayTypeRef'), ref(element, 'OperatingPeriodRef')))
        if tag in ('Line', 'ScheduledStopPoint', 'ServiceJourneyPattern', 'ServiceJourney', 'DayType', 'UicOperatingPeriod', 'DayTypeAssignment') or tag in clear:
            element.clear()
    calendars = {}
    for day_ref, period_ref in assignments:
        if day_ref not in tables['day_types'] or period_ref not in tables['periods']:
            raise ValueError('Assegnazione calendario con riferimenti mancanti')
        calendars.setdefault(day_ref, set()).update(tables['periods'][period_ref])
    if not all(key in meta for key in ('publicationTimestamp', 'timezone', 'validFrom', 'validTo')):
        raise ValueError('Metadati della pubblicazione incompleti')
    for journey in tables['journeys'].values():
        pattern = tables['patterns'][journey['patternRef']]
        if journey['lineRef'] not in tables['lines'] or pattern['lineRef'] != journey['lineRef'] or not journey['dayTypes']:
            raise ValueError('Linea o calendario della corsa discordante')
        if any(day_ref not in calendars for day_ref in journey['dayTypes']):
            raise ValueError('Calendario della corsa non risolto')
        orders = []
        for passing in journey['times']:
            point = pattern['points'][passing['pointRef']]
            if point['stopRef'] not in tables['stops']:
                raise ValueError('Fermata non risolta')
            orders.append(point['order'])
        if not orders or orders != sorted(set(orders)) or len(orders) != len(pattern['points']):
            raise ValueError('Ordine o copertura del pattern incompleti')
    return {**tables, 'calendars': calendars, 'meta': meta, 'counts': dict(counts)}


def active(catalog, journey, day):
    if not catalog['meta']['validFrom'] <= day <= catalog['meta']['validTo']:
        raise ValueError('Giorno fuori dalla validità della pubblicazione')
    return journey['from'] <= day <= journey['to'] and any(day in catalog['calendars'][ref] for ref in journey['dayTypes'])


def stop_rows(catalog, journey, day):
    if not active(catalog, journey, day):
        return []
    pattern = catalog['patterns'][journey['patternRef']]
    output = []
    for passing in journey['times']:
        point = pattern['points'][passing['pointRef']]
        stop = catalog['stops'][point['stopRef']]
        output.append({**stop, 'order': point['order'], 'boarding': point['boarding'] == 'true', 'alighting': point['alighting'] == 'true',
            'time': passing['departure'], 'dayOffset': passing['departureOffset'], 'instants': wall_instants(day, passing['departure'], passing['departureOffset'])})
    return output


def validate_samples(catalog, trials):
    cases = []
    for trial in trials:
        if not trial['departures']:
            raise ValueError('Un campione vuoto non verifica assenza di servizio')
        expected = {(row['tripId'], row['instant']) for row in trial['departures']}
        if len(expected) != len(trial['departures']):
            raise ValueError('Campione con passaggi duplicati')
        found = set()
        ambiguous = []
        lines = {row['line'] for row in trial['departures']}
        for journey in catalog['journeys'].values():
            if catalog['lines'][journey['lineRef']]['number'] not in lines:
                continue
            for row in stop_rows(catalog, journey, trial['date']):
                if row['code'] == trial['stopCode'] and row['boarding']:
                    trip_id = 'ATV#1:' + journey['id'].split(':')[-1].removesuffix('_ATV')
                    if len(row['instants']) != 1:
                        ambiguous.append({'tripId': trip_id, 'instants': row['instants']})
                    else:
                        found.add((trip_id, row['instants'][0]))
        cases.append({'stopCode': trial['stopCode'], 'date': trial['date'], 'lines': sorted(lines), 'expectedCount': len(expected), 'netexCount': len(found),
            'matched': len(expected & found), 'missing': sorted(expected - found), 'additional': sorted(found - expected), 'ambiguous': ambiguous,
            'exactMatch': expected == found and not ambiguous})
    return cases


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', default='research/atv-netex-l2-checked.gz')
    parser.add_argument('--samples', default='data/bus-stop-trials.json')
    parser.add_argument('--output', default='data/atv-netex-validation.json')
    parser.add_argument('--plan', default='data/bus-line-24-plan.json')
    args = parser.parse_args()
    path = Path(args.input)
    with gzip.open(path, 'rb') as stream:
        catalog = parse_catalog(stream)
    trials = json.loads(Path(args.samples).read_text(encoding='utf-8'))['trials']
    cases = validate_samples(catalog, trials)
    week = []
    for i in range(7):
        day = str(date(2026, 10, 19) + timedelta(days=i))
        selected = [journey for journey in catalog['journeys'].values() if catalog['lines'][journey['lineRef']]['number'] == '24' and active(catalog, journey, day)]
        rows = [row for journey in selected for row in stop_rows(catalog, journey, day)]
        week.append({'date': day, 'line': '24', 'activeJourneys': len(selected), 'distinctStops': len({row['code'] for row in rows}), 'stopObservations': len(rows), 'ambiguousTimes': sum(len(row['instants']) != 1 for row in rows)})
    plan = json.loads(Path(args.plan).read_text(encoding='utf-8'))
    observed = {trip['tripId'] for trip in plan['knownTrips'] if trip['serviceDate'] == '2026-10-19' and trip['line'] == '24'}
    active_19 = {'ATV#1:' + journey['id'].split(':')[-1].removesuffix('_ATV'): journey for journey in catalog['journeys'].values()
                 if catalog['lines'][journey['lineRef']]['number'] == '24' and active(catalog, journey, '2026-10-19')}
    additions = []
    for identifier in sorted(set(active_19) - observed):
        journey = active_19[identifier]
        rows = stop_rows(catalog, journey, '2026-10-19')
        additions.append({'tripId': identifier, 'name': journey['name'], 'firstTime': rows[0]['time'], 'lastTime': rows[-1]['time'],
                          'stopCount': len(rows), 'stopCodes': [row['code'] for row in rows], 'boardingStops': sum(row['boarding'] for row in rows)})
    coverage = {'date': '2026-10-19', 'line': '24', 'previouslyObserved': len(observed), 'netexActive': len(active_19),
                'previousTripsNotInNetex': sorted(observed - set(active_19)), 'additionalTrips': additions}
    report = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'source': 'https://www.cciss.it/nap/mmtis/public/catalog/Asset/204401',
        'sourceFileSha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'publication': catalog['meta'], 'counts': catalog['counts'],
        'referenceValidation': 'All journey line, pattern, passing-stop and calendar references resolved', 'sampleComparisons': cases,
        'allSamplesMatch': bool(cases) and all(case['exactMatch'] for case in cases), 'line24Week': week, 'line24CoverageComparison': coverage, 'frontendIntegrated': False,
        'limitations': ['Restricted to the observed ATV profile, not a complete NeTEx schema validator', 'Not a realtime feed', 'All-network operational completeness not independently certified']}
    Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({key: report[key] for key in ('publication', 'allSamplesMatch', 'sampleComparisons', 'line24Week', 'line24CoverageComparison')}, ensure_ascii=False, indent=2))
    if not report['allSamplesMatch']:
        raise SystemExit(2)


if __name__ == '__main__':
    main()
