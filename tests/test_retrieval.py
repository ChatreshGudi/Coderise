import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from retrieval_common import editorial_text, editorial_status
from import_editorials import match_rows, prepare
from build_retrieval_embeddings import normalized, token_windows
import numpy as np


class RetrievalTests(unittest.TestCase):
    def test_html_cleanup_preserves_math_and_code_but_removes_scripts(self):
        value=editorial_text('<p>Use $$$x < y$$$.</p><script>bad()</script><pre>a &lt; b</pre>')
        self.assertIn('$$$x < y$$$',value)
        self.assertIn('a < b',value)
        self.assertNotIn('bad()',value)
        self.assertEqual(editorial_text('Use $x < y$ and **binary search**.'),'Use $x < y$ and **binary search**.')

    def test_alias_matching_prefers_recorded_statement_source(self):
        rows=[{'id':'1/A','aliases':['2/B'],'editorial':'A'*100},
              {'id':'2/B','aliases':[],'editorial':'B'*100}]
        catalogue={(1,'A'):10,(2,'B'):20}
        matched=match_rows(rows,catalogue,[(20,'1/A','pinned')],'pinned')
        self.assertEqual(matched[20]['id'],'1/A')
        self.assertEqual(match_rows(rows,catalogue,[],'pinned')[20]['id'],'2/B')

    def test_shared_contest_tutorials_are_held_out_but_aliases_are_allowed(self):
        text='A useful solution explanation. '*10
        shared=prepare({1:{'id':'1/A','editorial':text},2:{'id':'1/B','editorial':text}})
        self.assertTrue(all(v['status']=='needs_review' for v in shared.values()))
        aliases=prepare({1:{'id':'1/A','editorial':text},2:{'id':'1/A','editorial':text}})
        self.assertTrue(all(v['status']=='ready' for v in aliases.values()))
        self.assertEqual(editorial_status('short')[0],'needs_review')

    def test_chunking_covers_every_token_including_the_tail(self):
        ids=list(range(1001))
        chunks=token_windows(ids,224,192)
        self.assertEqual(set(v for chunk in chunks for v in chunk),set(ids))
        self.assertEqual(chunks[-1][-1],1000)
        self.assertTrue(all(len(chunk)<=224 for chunk in chunks))
        with self.assertRaises(ValueError): token_windows([],224,192)

    def test_pooling_rejects_zero_and_nonfinite_outputs(self):
        np.testing.assert_allclose(np.linalg.norm(normalized([[3,4]]),axis=1),[1])
        for invalid in [[[0,0]],[[np.nan,1]],[[np.inf,1]]]:
            with self.assertRaises(ValueError): normalized(invalid)

if __name__ == '__main__': unittest.main()
