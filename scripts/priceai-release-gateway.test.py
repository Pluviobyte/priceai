import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('gateway', Path(__file__).with_name('priceai-release-gateway.py'))
gateway = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gateway)

class ManifestValidation(unittest.TestCase):
    def manifest(self):
        return {'sha': 'a' * 40, 'release': 'b' * 64,
                'web': 'ghcr.io/pluviobyte/priceai-web@sha256:' + 'c' * 64,
                'worker': 'ghcr.io/pluviobyte/priceai-worker@sha256:' + 'd' * 64}

    def test_valid(self):
        gateway.validate(self.manifest())

    def test_reject_tags_other_repositories_and_injection(self):
        for image in ['ghcr.io/pluviobyte/priceai-web:latest', 'alpine:latest',
                      'ghcr.io/other/priceai-web@sha256:' + 'c' * 64,
                      'ghcr.io/pluviobyte/priceai-web@sha256:' + 'c' * 64 + ';id']:
            with self.subTest(image=image), self.assertRaises(ValueError):
                gateway.validate({**self.manifest(), 'web': image})

    def test_reject_bad_identifiers(self):
        for field in ['sha', 'release']:
            with self.assertRaises(ValueError):
                gateway.validate({**self.manifest(), field: "';DROP TABLE application;--"})

if __name__ == '__main__':
    unittest.main()
