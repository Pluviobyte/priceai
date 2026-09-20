import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
import io
import json
import tempfile

spec = importlib.util.spec_from_file_location('gateway', Path(__file__).with_name('priceai-release-gateway.py'))
gateway = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gateway)
observer_spec = importlib.util.spec_from_file_location('observer', Path(__file__).with_name('priceai-release-observer.py'))
observer = importlib.util.module_from_spec(observer_spec)
observer_spec.loader.exec_module(observer)

class ManifestValidation(unittest.TestCase):
    def test_observer_protects_running_containers_and_resource_headroom(self):
        original = {'name': 'other-project', 'running': True, 'restarts': 0, 'oom': False, 'health': 'healthy'}
        baseline = {'abc': original}
        self.assertEqual(observer.problems(baseline, baseline, 2*1024**3, 50*1024**3, 30, 2), [])
        self.assertTrue(observer.problems(baseline, {}, 2*1024**3, 50*1024**3, 30, 2))
        for field, value in [('restarts', 1), ('health', 'unhealthy'), ('oom', True)]:
            self.assertTrue(observer.problems(baseline, {'abc': {**original, field: value}}, 2*1024**3, 50*1024**3, 30, 2))
        self.assertEqual(len(observer.problems(baseline, baseline, 0, 0, 90, 15)), 4)

    def test_observer_fails_closed_on_stale_or_unhealthy_heartbeat(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'observer.json'
            with patch.object(gateway, 'OBSERVER', path), patch.object(gateway.time, 'time', return_value=100):
                gateway.observer_guard()
                for value in [{'at': 100, 'healthy': False}, {'at': 79, 'healthy': True}]:
                    path.write_text(json.dumps(value))
                    with self.assertRaises(RuntimeError):
                        gateway.observer_guard()
                path.write_text(json.dumps({'at': 95, 'healthy': True}))
                gateway.observer_guard()

    def test_discovery_monitor_executes_only_fixed_read_only_entrypoint(self):
        calls = []
        def fake_run(args, **kwargs):
            calls.append(args)
            return 'container123' if args[:2] == ['docker', 'ps'] else '{"healthy":true,"providers":[]}'
        with patch.object(gateway, 'run', side_effect=fake_run):
            self.assertTrue(gateway.discovery_status()['healthy'])
        self.assertEqual(calls[1], ['docker', 'exec', 'container123', 'node', '--import', 'tsx', 'apps/worker/src/discovery-status.ts'])

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

    def test_registry_token_formats(self):
        for token in ['ghs_' + 'a' * 40, 'header.payload-signature_' + 'b' * 40 + '=', 'v1:' + 'a' * 40 + '/+']:
            gateway.validate_registry_token(token)
        for token in ['short', 'a' * 40 + '$(id)', 'a' * 40 + '`id`', 'a' * 40 + '"', 'a' * 40 + '\n']:
            with self.assertRaises(ValueError):
                gateway.validate_registry_token(token)

    def test_public_readiness_identifies_itself_and_checks_version(self):
        def response(request, timeout):
            self.assertEqual(request.get_header('User-agent'), 'PriceAI-Release-Health/1.0')
            return io.StringIO(json.dumps({'release': 'b' * 64, 'database': 'ok', 'status': 'ok'}))
        with patch.object(gateway.urllib.request, 'urlopen', side_effect=response):
            gateway.wait_public_health('b' * 64)
        with self.assertRaises(RuntimeError):
            gateway.wait_public_health('b' * 64, timeout=0)

    def test_failed_deployment_rolls_back_to_last_good_release(self):
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory)
            self.assertEqual(gateway.rollback_manifest_path(state), state / 'previous.json')
            (state / 'pending.json').write_text('{}')
            self.assertEqual(gateway.rollback_manifest_path(state), state / 'current.json')

if __name__ == '__main__':
    unittest.main()
