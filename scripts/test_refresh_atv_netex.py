import importlib
import unittest
from datetime import date
refresh = importlib.import_module('refresh-atv-netex')
class ArchiveRenewalTests(unittest.TestCase):
    def fixture(self):
        manifest={'validFrom':'2026-10-18','validTo':'2026-11-17','publicationTimestamp':'2026-10-18T02:47:56+02:00','sha256':'candidate','counts':{'Line':1,'ServiceJourney':1,'TimetabledPassingTime':1}}
        assets={'11':{'trips':[{'id':'one','dates':['2026-10-24'],'calls':[['A','10:00:00',0,True,None,0,True]]}],'stops':{'A':{'lat':45.44,'lon':10.99}}}}
        installed={'validTo':'2026-11-17','sha256':'old','lines':[{'number':'11'}],'counts':{'ServiceJourney':1}}
        return manifest, assets, installed
    def test_valid_candidate_is_not_automatically_applied(self):
        m,a,i=self.fixture();r=refresh.validate_candidate(m,a,i,date(2026,10,24));self.assertTrue(r['changed']);self.assertFalse(r['applied'])
    def test_expired_or_drastically_reduced_archive_rejected(self):
        m,a,i=self.fixture();m['validTo']='2026-10-23'
        with self.assertRaises(ValueError):refresh.validate_candidate(m,a,i,date(2026,10,24))
        m,a,i=self.fixture();i['counts']['ServiceJourney']=100
        with self.assertRaises(ValueError):refresh.validate_candidate(m,a,i,date(2026,10,24))
    def test_duplicate_trips_and_missing_permissions_rejected(self):
        m,a,i=self.fixture();a['11']['trips'].append(a['11']['trips'][0])
        with self.assertRaises(ValueError):refresh.validate_candidate(m,a,i,date(2026,10,24))
        m,a,i=self.fixture();a['11']['trips'][0]['calls'][0][6]=None
        with self.assertRaises(ValueError):refresh.validate_candidate(m,a,i,date(2026,10,24))
if __name__=='__main__':unittest.main()

class ArchiveRollbackTests(unittest.TestCase):
    def test_apply_restores_previous_files_when_build_fails(self):
        import gzip
        import json
        import subprocess
        import tempfile
        from datetime import datetime, timezone
        from pathlib import Path
        from unittest.mock import patch
        m, a, installed = ArchiveRenewalTests().fixture()
        class FixedDateTime(datetime):
            @classmethod
            def now(cls, tz=None):
                value=cls(2026,10,24,10,0,tzinfo=timezone.utc)
                return value.astimezone(tz) if tz else value.replace(tzinfo=None)
        workspace=refresh.ROOT.resolve()
        with tempfile.TemporaryDirectory(dir=workspace / '.local') as folder:
            root=Path(folder).resolve()
            self.assertTrue(root.is_relative_to(workspace))
            (root / 'data/bus-official').mkdir(parents=True)
            old_manifest=json.dumps(installed).encode()
            (root / 'data/bus-official.json').write_bytes(old_manifest)
            (root / 'data/bus-official/11.json').write_bytes(b'old-line')
            archive=root / 'candidate.gz'
            archive.write_bytes(gzip.compress(b'<candidate/>'))
            with patch.object(refresh,'ROOT',root),patch.object(refresh,'datetime',FixedDateTime),patch.object(refresh.netex,'parse_catalog',return_value=None),patch.object(refresh.exporter,'export_catalog',return_value=(m,a)),patch.object(refresh.sys,'argv',['refresh','--input',str(archive),'--apply']),patch.object(refresh.subprocess,'run',side_effect=[subprocess.CalledProcessError(1,['node']),subprocess.CompletedProcess(['node'],0)]):
                with self.assertRaises(subprocess.CalledProcessError):refresh.main()
            self.assertEqual((root / 'data/bus-official.json').read_bytes(),old_manifest)
            self.assertEqual((root / 'data/bus-official/11.json').read_bytes(),b'old-line')
