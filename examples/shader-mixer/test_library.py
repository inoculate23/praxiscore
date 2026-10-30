"""Regression checks for legacy GLSL adaptation and generated assets."""
import hashlib
import json
import unittest
from build_project import HERE, wrap
from shader_library import adapt_globals


class LibraryTests(unittest.TestCase):
    def test_animated_globals_move_in_order(self):
        source, init = adapt_globals('float a = sin(time);\nvec2 b = vec2(a, time);\nvoid main() { float c=2.; }')
        self.assertIn('float a;', source)
        self.assertIn('vec2 b;', source)
        self.assertIn('void main() { float c=2.; }', source)
        self.assertEqual(init, 'a = sin(time);\nb = vec2(a, time);')

    def test_inline_functions_are_preserved(self):
        source = 'float curve(float x) { float x3=x*x*x; return x3; }'
        self.assertEqual(adapt_globals(source), (source, ''))

    def test_commented_uniform_is_not_a_declaration(self):
        source = wrap('//uniform vec2 mouse;\nuniform float time;\nuniform vec2 resolution;\nvoid main(){}')
        self.assertIn('\nuniform vec2 mouse;\n', source)

    def test_generated_library_and_helper(self):
        entries = json.loads((HERE/'player/library.js').read_text().removeprefix('const SHADER_LIBRARY = ').strip().removesuffix(';'))
        self.assertTrue({'Aurora','Stars','PrismTunnel','LiquidLattice'}.issubset({e['name'] for e in entries}))
        self.assertGreaterEqual(len(entries), 4)
        self.assertTrue(all('#include' not in e['source'] for e in entries))
        self.assertNotIn('noise', [e['name'] for e in entries])

    def test_asset_versions_match_contents(self):
        page=(HERE/'player/index.html').read_text()
        for name in ['library.js','player.js','shaders.js']:
            digest=hashlib.sha256((HERE/'player'/name).read_bytes()).hexdigest()[:12]
            self.assertIn(f'{name}?v={digest}',page)


if __name__ == '__main__':
    unittest.main()
