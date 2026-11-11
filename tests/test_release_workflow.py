"""Release contract: tags only, no optional-file build failures."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / '.github' / 'workflows'
RELEASE = (WORKFLOWS / 'release.yml').read_text(encoding='utf-8')


class ReleaseWorkflowTests(unittest.TestCase):
    def test_only_one_workflow_and_tag_push_only(self):
        self.assertEqual([p.name for p in WORKFLOWS.glob('*.yml')], ['release.yml'])
        trigger = RELEASE.split('permissions:', 1)[0]
        self.assertRegex(trigger, r'(?m)^on:\s*$')
        self.assertRegex(trigger, r'(?m)^\s+push:\s*$')
        self.assertRegex(trigger, r"(?m)^\s+- ['\"]?v\*['\"]?\s*$")
        self.assertNotRegex(trigger, r'(?m)^\s+(branches|pull_request|workflow_dispatch|schedule):')

    def test_build_requires_only_executable(self):
        self.assertIn("Test-Path -LiteralPath $path -PathType Leaf", RELEASE)
        self.assertNotIn("'THIRD_PARTY.md'", RELEASE)
        self.assertNotIn("'README.md'", RELEASE)
        self.assertNotIn("'LICENSE'", RELEASE)

    def test_optional_documentation_is_discovered(self):
        self.assertIn('Get-ChildItem', RELEASE)
        self.assertIn('Where-Object', RELEASE)
        self.assertIn('Compress-Archive', RELEASE)
        self.assertIn('LiteralPath', RELEASE)

    def test_release_notes_do_not_require_a_file(self):
        self.assertIn('--generate-notes', RELEASE)
        self.assertNotIn('--notes-file RELEASE_NOTES.md', RELEASE)

    def test_direct_exe_zip_and_checksums_are_published(self):
        for item in ['Subscope.exe', 'Subscope-windows-x64.zip', 'SHA256SUMS.txt']:
            self.assertIn(item, RELEASE)
        self.assertIn('gh release upload', RELEASE)
        self.assertIn('gh release create', RELEASE)
        self.assertIn('Get-FileHash', RELEASE)


if __name__ == '__main__':
    unittest.main()
