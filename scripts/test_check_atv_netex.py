import importlib.util
import io
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('netex_check', Path(__file__).with_name('check-atv-netex.py'))
netex = importlib.util.module_from_spec(spec)
spec.loader.exec_module(netex)


def fixture():
    return '''<PublicationDelivery xmlns="http://www.netex.org.uk/netex">
    <PublicationTimestamp>2026-10-18T02:00:00+02:00</PublicationTimestamp><CompositeFrame id="F" version="1">
    <ValidBetween><FromDate>2026-10-18T00:00:00+02:00</FromDate><ToDate>2026-10-20T23:59:59+02:00</ToDate></ValidBetween>
    <TimeZone>Europe/Rome</TimeZone>
    <ServiceJourney id="IT:ITH3:ServiceJourney:700_1_ATV"><Name>A-B</Name>
    <ValidBetween><FromDate>2026-10-18</FromDate><ToDate>2026-10-20</ToDate></ValidBetween>
    <FlexibleLineView><LineRef ref="L"/></FlexibleLineView><ServiceJourneyPatternRef ref="P"/>
    <dayTypes><DayTypeRef ref="D"/></dayTypes><passingTimes>
    <TimetabledPassingTime><StopPointInJourneyPatternRef ref="P1"/><DepartureTime>05:30:00</DepartureTime></TimetabledPassingTime>
    <TimetabledPassingTime><StopPointInJourneyPatternRef ref="P2"/><ArrivalTime>05:40:00</ArrivalTime><DepartureTime>05:40:00</DepartureTime></TimetabledPassingTime>
    </passingTimes></ServiceJourney>
    <Line id="L"><PublicCode>24_ATV</PublicCode><Name>Linea 24</Name></Line>
    <ScheduledStopPoint id="S1"><PublicCode>1974_ATV</PublicCode><Name>Santini</Name><Location><Latitude>45.4</Latitude><Longitude>11</Longitude></Location></ScheduledStopPoint>
    <ScheduledStopPoint id="S2"><PublicCode>1809_ATV</PublicCode><Name>Terminale</Name><Location><Latitude>45.5</Latitude><Longitude>11</Longitude></Location></ScheduledStopPoint>
    <ServiceJourneyPattern id="P"><RouteView><LineRef ref="L"/></RouteView><pointsInSequence>
    <StopPointInJourneyPattern id="P1" order="1"><ScheduledStopPointRef ref="S1"/><ForBoarding>true</ForBoarding><ForAlighting>false</ForAlighting></StopPointInJourneyPattern>
    <StopPointInJourneyPattern id="P2" order="2"><ScheduledStopPointRef ref="S2"/><ForBoarding>false</ForBoarding><ForAlighting>true</ForAlighting></StopPointInJourneyPattern>
    </pointsInSequence></ServiceJourneyPattern>
    <DayType id="D"><properties><PropertyOfDay><DaysOfWeek>Monday</DaysOfWeek></PropertyOfDay></properties></DayType>
    <UicOperatingPeriod id="O"><FromDate>2026-10-18</FromDate><ToDate>2026-10-20</ToDate><ValidDayBits>010</ValidDayBits></UicOperatingPeriod>
    <DayTypeAssignment><DayTypeRef ref="D"/><OperatingPeriodRef ref="O"/></DayTypeAssignment>
    </CompositeFrame></PublicationDelivery>'''


class NetexTests(unittest.TestCase):
    def test_calendar_bits_use_every_day_inclusive_and_reject_truncation(self):
        self.assertEqual(netex.period_days('2026-10-18', '2026-10-20', '010'), {'2026-10-19'})
        with self.assertRaises(ValueError):
            netex.period_days('2026-10-18', '2026-10-20', '01')

    def test_timezone_changes_without_using_the_header_fixed_offset(self):
        self.assertEqual(netex.wall_instants('2026-10-19', '06:38:16'), ['2026-10-19T04:38:16.000Z'])
        self.assertEqual(netex.wall_instants('2026-10-25', '06:38:16'), ['2026-10-25T05:38:16.000Z'])

    def test_fold_is_not_guessed_and_spring_gap_is_rejected(self):
        self.assertEqual(len(netex.wall_instants('2026-10-25', '02:30:00')), 2)
        with self.assertRaises(ValueError):
            netex.wall_instants('2026-03-29', '02:30:00')

    def test_post_midnight_offset_is_explicit(self):
        self.assertEqual(netex.wall_instants('2026-10-19', '00:10:00', 1), ['2026-10-19T22:10:00.000Z'])

    def test_forward_references_calendar_and_boarding_permissions(self):
        catalog = netex.parse_catalog(io.StringIO(fixture()))
        journey = next(iter(catalog['journeys'].values()))
        self.assertEqual(len(netex.stop_rows(catalog, journey, '2026-10-19')), 2)
        self.assertEqual(netex.stop_rows(catalog, journey, '2026-10-18'), [])
        self.assertFalse(netex.stop_rows(catalog, journey, '2026-10-19')[-1]['boarding'])
        with self.assertRaises(ValueError):
            netex.active(catalog, journey, '2026-11-01')

    def test_orphan_reference_duplicate_id_and_unknown_calendar_fail(self):
        for invalid in (fixture().replace('ref="P1"', 'ref="missing"'), fixture().replace('id="S2"', 'id="S1"'),
                        fixture().replace('<DayTypeAssignment>', '<DayTypeAssignment><IsAvailable>false</IsAvailable>')):
            with self.assertRaises((ValueError, KeyError)):
                netex.parse_catalog(io.StringIO(invalid))

    def test_sample_comparison_reports_both_extra_and_missing_calls(self):
        catalog = netex.parse_catalog(io.StringIO(fixture()))
        trial = {'stopCode': '1974', 'date': '2026-10-19', 'departures': [{'tripId': 'ATV#1:700_1', 'instant': '2026-10-19T03:30:00.000Z', 'line': '24'}]}
        self.assertTrue(netex.validate_samples(catalog, [trial])[0]['exactMatch'])
        trial['departures'][0]['instant'] = '2026-10-19T03:31:00.000Z'
        case = netex.validate_samples(catalog, [trial])[0]
        self.assertEqual((len(case['missing']), len(case['additional'])), (1, 1))

    def test_empty_reference_cannot_certify_absence(self):
        with self.assertRaises(ValueError):
            netex.validate_samples({}, [{'departures': []}])


if __name__ == '__main__':
    unittest.main()
