from pathlib import Path
import runpy,unittest
M=runpy.run_path(str(Path(__file__).resolve().parents[1]/'scripts/decode-capella-bootstrap-fixture.py'))
class DecoderTests(unittest.TestCase):
 def test_literal(self):self.assertEqual(M['snappy'](bytes([3,8])+b'abc'),b'abc')
 def test_overlapping_copy(self):self.assertEqual(M['snappy'](bytes([7,8])+b'xab'+bytes([1,2])),b'xababab')
 def test_rejects_bad_inputs(self):
  for b in [b'',bytes([128]*6),bytes([1,0]),bytes([4,1,0]),bytes([1,4])+b'ab',bytes([128,128,8])]:
   with self.assertRaises(ValueError):M['snappy'](b)
 def test_official_fixture(self):
  result=M['decode']();self.assertEqual(result['decompressedSize'],2560)
  self.assertEqual(result['selectedBeaconRoot'],'0x1d9ac9a848502087ba2ca00df67285361ca9c7fef8365e683e6b9dfe8387a264')
if __name__=='__main__':unittest.main()
