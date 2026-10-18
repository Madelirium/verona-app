"""Importazione locale, manuale, delle tabelle ATV con coordinate PDF.

Richiede pdfplumber. Non effettua richieste di rete e non usa OCR.
"""
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TIME = re.compile(r'^(\d{1,2})[.:](\d{2})$')


def rows_from_words(words):
    rows = []
    for word in sorted(words, key=lambda w: (w['bottom'], w['x0'])):
        if not rows or abs(word['bottom'] - rows[-1]['bottom']) > 1.8:
            rows.append({'bottom': word['bottom'], 'words': [word]})
        else:
            rows[-1]['words'].append(word)
    for row in rows:
        row['words'].sort(key=lambda w: w['x0'])
        row['text'] = ' '.join(w['text'] for w in row['words'])
    return rows


def parse_page(words, page_number, line_number):
    # La 98 contiene un'ora sovrastampata due volte nello stesso punto.
    words = [dict(word) for word in words]
    for word in words:
        value = word['text']
        if len(value)%2 == 0 and all(value[i] == value[i+1] for i in range(0,len(value),2)) and TIME.fullmatch(value[::2]):
            word['text'] = value[::2]
    rows = rows_from_words(words)
    headers = [i for i, row in enumerate(rows) if re.match(r'^Codice\s*corsa\b', row['text'], re.I)]
    blocks = []
    for pos, index in enumerate(headers):
        row = rows[index]
        columns = [w for w in row['words'] if re.fullmatch(r'\d+[a-z]?', w['text'], re.I)]
        if not columns:
            raise ValueError(f'Pagina {page_number}: intestazione corse non riconosciuta')
        centers = [(w['x0'] + w['x1']) / 2 for w in columns]
        pitch = min((b-a for a, b in zip(centers, centers[1:])), default=28)
        if line_number == '63':
            expanded, expanded_centers = [], []
            for column, center in zip(columns, centers):
                if expanded_centers and center-expanded_centers[-1]>pitch*1.6:
                    if center-expanded_centers[-1]>pitch*2.2:
                        raise ValueError('Distanza fra codici non verificata')
                    expanded.append({'text': None})
                    expanded_centers.append(expanded_centers[-1]+pitch)
                expanded.append(column)
                expanded_centers.append(center)
            columns, centers = expanded, expanded_centers
        left = centers[0] - pitch / 2
        title_index = index - 2
        if title_index < 0 or rows[title_index]['words'][0]['text'] != line_number:
            raise ValueError(f'Pagina {page_number}: titolo/direzione non riconosciuti')
        direction = ' '.join(w['text'] for w in rows[title_index]['words'][1:])
        service = rows[index-1]['text']
        if not re.search(r'SCOLASTIC|SABATO|FESTIV|SERALE|GIORNALIER|FERIAL|LUN|VACANZ', service, re.I):
            raise ValueError(f'Pagina {page_number}: giorno di servizio non riconosciuto: {service}')
        end = headers[pos+1]-2 if pos+1 < len(headers) else len(rows)
        body = rows[index+1:end]
        # Una colonna finale della 91 festiva ha gli orari ma manca il codice
        # nell'originale. Manteniamo gli orari, senza inventare un codice corsa.
        farthest = max(((w['x0']+w['x1'])/2 for r in body for w in r['words'] if TIME.fullmatch(w['text'])), default=0)
        missing_code = farthest > centers[-1] + pitch*.43
        if missing_code:
            if line_number != '91' or len(columns) != 26 or farthest > centers[-1]+pitch*1.43:
                raise ValueError(f'Pagina {page_number}: colonna oraria senza codice non verificata')
            centers.append(centers[-1]+pitch)
            columns.append({'text': None})
        time_rows = [i for i, r in enumerate(body) if any(TIME.fullmatch(w['text']) and w['x0'] >= left for w in r['words'])]
        if not time_rows:
            raise ValueError(f'Pagina {page_number}: nessun orario')
        stops, validity, trip_notes, trailing_notes = [], [''] * len(columns), [''] * len(columns), []
        times_found = 0
        notes_started = False
        for ri, r in enumerate(body):
            label = ' '.join(w['text'] for w in r['words'] if w['x0'] < left and not TIME.fullmatch(w['text']))
            if re.search(r'Servizio (invernale|estivo)|^\d+$', r['text'], re.I):
                continue
            if re.match(r'^(?:Note\s*:|[A-Z]?\d+\))', r['text'], re.I):
                notes_started = True
            if notes_started:
                trailing_notes.append(r['text'])
                continue
            is_validity = bool(re.match(r'^Validit', label, re.I))
            is_notes = label.lower() == 'note'
            if not label:
                raise ValueError(f'Pagina {page_number}: riga senza nome: {r["text"]}')
            cells, marks = [None] * len(columns), [''] * len(columns)
            for word in r['words']:
                if word['x0'] < left:
                    continue
                center = (word['x0'] + word['x1']) / 2
                column = min(range(len(centers)), key=lambda i: abs(centers[i]-center))
                if abs(centers[column]-center) > pitch * .43:
                    raise ValueError(f'Pagina {page_number}: cella fuori colonna: {word["text"]}')
                match = TIME.fullmatch(word['text'])
                if match:
                    hours, minutes = map(int, match.groups())
                    if is_validity or is_notes or hours > 29 or minutes > 59 or cells[column] is not None:
                        raise ValueError(f'Pagina {page_number}: orario non valido o duplicato')
                    cells[column] = f'{hours:02d}:{minutes:02d}'
                    times_found += 1
                else:
                    if not re.fullmatch(r'\||3|A3', word['text']):
                        raise ValueError(f'Pagina {page_number}: simbolo non verificato: {word["text"]}')
                    marks[column] += word['text']
            if is_validity:
                validity = marks
            elif is_notes:
                trip_notes = marks
            else:
                stops.append({'name': label, 'times': cells, 'marks': marks})
        if len(stops) < 2 or not direction:
            raise ValueError(f'Pagina {page_number}: fermate insufficienti')
        # Non si riempiono buchi né barre verticali: non sono orari.
        blocks.append({'page': page_number, 'direction': direction, 'service': service,
                       'tripIds': [w['text'] for w in columns], 'validity': validity, 'tripNotes': trip_notes,
                       'stops': stops, 'notes': trailing_notes, 'timeCount': times_found})
    if not blocks:
        raise ValueError(f'Pagina {page_number}: nessuna tabella riconosciuta')
    source_time_count = sum(bool(TIME.fullmatch(word['text'])) for word in words)
    if source_time_count != sum(block['timeCount'] for block in blocks):
        raise ValueError(f'Pagina {page_number}: non tutti gli orari della fonte sono stati associati a una fermata')
    return blocks


def main():
    import pdfplumber
    manifest = json.loads((ROOT/'data/bus-timetable-snapshots.json').read_text(encoding='utf-8'))
    result = {'generatedAt': datetime.now(timezone.utc).isoformat(), 'collectedAt': manifest['collectedAt'],
              'kind': 'scheduled', 'lines': [], 'errors': []}
    for item in manifest['items']:
        try:
            path = (ROOT/item['snapshotFile']).resolve()
            if not path.is_relative_to((ROOT/'.local/atv-timetables').resolve()):
                raise ValueError('Percorso snapshot inatteso')
            if hashlib.sha256(path.read_bytes()).hexdigest() != item['sha256']:
                raise ValueError('Impronta PDF non valida')
            blocks, footers = [], []
            with pdfplumber.open(path) as pdf:
                for i, page in enumerate(pdf.pages):
                    page = page.dedupe_chars(tolerance=.3)
                    words = page.extract_words(x_tolerance=1, y_tolerance=1)
                    blocks.extend(parse_page(words, i+1, item['number']))
                    footer_text = ' '.join(word['text'] for word in words)
                    footers.extend(f'Servizio {season.lower()} dal {date}' for season,date in re.findall(r'Servizio\s*(invernale|estivo)\s*dal\s*(\d{2}/\d{2}/\d{4}|\d{1,2}\s+[a-zà]+\s+\d{4})', footer_text, re.I))
            result['lines'].append({'lineId': item['lineId'], 'sha256': item['sha256'],
                                    'sourceUrl': item['sourceUrl'], 'downloadedAt': item['downloadedAt'],
                                    'validityLabels': sorted(set(footers)), 'blocks': blocks})
            print(item['lineId'], len(blocks), 'tabelle')
        except Exception as error:
            result['errors'].append({'lineId': item['lineId'], 'error': str(error)})
            print(item['lineId'], 'NON PUBBLICATO:', str(error))
    output = ROOT/'data/bus-timetables.json'
    temporary = output.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':'))+'\n', encoding='utf-8')
    temporary.replace(output)
    print(json.dumps({'lines': len(result['lines']), 'errors': len(result['errors'])}))


if __name__ == '__main__':
    main()
