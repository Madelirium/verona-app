import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('extractor',Path(__file__).with_name('extract-bus-timetables.py'))
extractor=importlib.util.module_from_spec(spec)
spec.loader.exec_module(extractor)

def word(text,x,y,width=16):
    return {'text':text,'x0':x-width/2,'x1':x+width/2,'bottom':y}

def page():
    return [word('11',10,10),word('A - B',140,10,50),word('LUN-VEN SCOLASTICO',150,20,90),word('Codice corsa',35,30,60),word('1',100,30),word('5',130,30),word('7',160,30),word('Validità',25,40,45),word('Partenza',25,50,45),word('05.30',100,50),word('|',130,50),word('07.22',160,50),word('Arrivo',25,60,45),word('05.42',100,60),word('06.45',130,60),word('07.34',160,60)]

class ExtractorTests(unittest.TestCase):
    def test_empty_cells_and_bars_do_not_shift_trips(self):
        block=extractor.parse_page(page(),1,'11')[0]
        self.assertEqual(block['stops'][0]['times'],['05:30',None,'07:22'])
        self.assertEqual(block['stops'][0]['marks'],['','|',''])
        self.assertEqual(block['stops'][1]['times'],['05:42','06:45','07:34'])
    def test_trip_notes_stay_attached_to_their_column(self):
        words=page()+[word('Note',25,45,45),word('3',130,45),word('3) Venerdì percorso alternativo',140,80,250)]
        block=extractor.parse_page(words,1,'11')[0]
        self.assertEqual(block['tripNotes'],['','3',''])
        self.assertEqual(block['notes'],['3) Venerdì percorso alternativo'])
    def test_bad_minutes_or_unknown_symbols_stop_publication(self):
        words=page();words[10]['text']='05.99'
        with self.assertRaisesRegex(ValueError,'orario non valido'):
            extractor.parse_page(words,1,'11')
        words=page();words[10]['text']='???'
        with self.assertRaisesRegex(ValueError,'simbolo non verificato'):
            extractor.parse_page(words,1,'11')
    def test_overprinted_time_is_read_once(self):
        words=page();words[9]['text']='0055..3300'
        block=extractor.parse_page(words,1,'11')[0]
        self.assertEqual(block['stops'][0]['times'][0],'05:30')
        self.assertEqual(block['timeCount'],5)
    def test_time_before_the_first_column_cannot_be_silently_lost(self):
        with self.assertRaisesRegex(ValueError,'non tutti gli orari'):
            extractor.parse_page(page()+[word('04.22',65,50)],1,'11')

if __name__=='__main__':
    unittest.main()
