import importlib.util
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('sync', Path(__file__).with_name('sync-public-content.py'))
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


class PublicExportTests(unittest.TestCase):
    def test_stale_news_keeps_latest_available_and_excludes_notification_fields(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Path(tmp) / 'push_logs.db'
            with closing(sqlite3.connect(db)) as con:
                con.execute('CREATE TABLE push_records (source,title,content,category,url,push_time,push_date,push_channel)')
                con.executemany('INSERT INTO push_records VALUES (?,?,?,?,?,?,?,?)', [
                    ('Official', 'Old news', 'Summary', 'AI', 'https://example.com/a', '2026-04-20 12:00:00', '2026-04-20', 'SECRET_CHANNEL'),
                    ('Official', 'Bad link', '<script>test</script>', 'AI', 'javascript:alert(1)', '2026-04-20 11:00:00', '2026-04-20', 'SECRET_CHANNEL')])
                con.commit()
            result = sync.export_news(db, days=7)
            self.assertEqual(result['api/latest_date.json']['latest_date'], '2026-04-20')
            data = result['api/ainews_2026-04-20.json']
            self.assertEqual(len(data), 2)
            self.assertEqual(data[1]['url'], '')
            self.assertNotIn('SECRET_CHANNEL', json.dumps(result))
            self.assertNotIn('push_channel', data[0])

    def test_skill_projection_drops_unknown_nested_private_fields(self):
        row = {'label': 'Claude', 'keyword': 'PRIVATE_QUERY', 'repo': {
            'full_name': 'owner/repo', 'html_url': 'https://github.com/owner/repo',
            'owner': {'email': 'private@example.com'}, 'private': False,
            'stargazers_count': 12, 'description': 'Example'}, 'token': 'SECRET'}
        out = sync.public_record(row)
        self.assertEqual(out['repo']['stargazers_count'], 12)
        for private in ['PRIVATE_QUERY', 'private@example.com', 'SECRET', '"private"']:
            self.assertNotIn(private, json.dumps(out))

    def test_missing_database_is_not_created(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Path(tmp) / 'missing.db'
            with self.assertRaises(FileNotFoundError):
                sync.export_news(db)
            self.assertFalse(db.exists())

    def test_private_repository_is_rejected(self):
        with self.assertRaises(ValueError):
            sync.public_record({'repo': {'private': True, 'full_name': 'owner/private'}})

    def test_unknown_visibility_requires_anonymous_evidence(self):
        row = {'repo': {'full_name': 'owner/repo'}}
        with self.assertRaises(ValueError):
            sync.public_record(row)
        self.assertEqual(sync.public_record(row, {'owner/repo'})['repo']['full_name'], 'owner/repo')

    def test_failed_skill_validation_does_not_replace_news_snapshot(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target = root / 'public'
            target.mkdir()
            (target / 'keep.txt').write_text('existing')
            with self.assertRaises((FileNotFoundError, ValueError)):
                sync.sync_content(root / 'missing-news', root / 'missing-skill', target)
            self.assertEqual((target / 'keep.txt').read_text(), 'existing')
            self.assertEqual(list(target.iterdir()), [target / 'keep.txt'])


if __name__ == '__main__':
    unittest.main()
