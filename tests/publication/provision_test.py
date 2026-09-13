"""Run without ArcGIS installed: python3 -m unittest discover -s tests/publication -p '*_test.py'."""
import copy
import importlib.util
import pathlib
from types import SimpleNamespace as Obj
import unittest
from unittest.mock import Mock

path = pathlib.Path(__file__).resolve().parents[2] / 'scripts/provision_arcgis_publication.py'
spec = importlib.util.spec_from_file_location('provision', path)
provision = importlib.util.module_from_spec(spec)
spec.loader.exec_module(provision)


class PublicSharingTest(unittest.TestCase):
    def test_actual_schema_is_checked_before_any_share(self):
        schema = provision.load_schema()
        for dataset in schema['layers']:
            fields = [{'name': 'OBJECTID', 'type': 'esriFieldTypeOID'}] + [
                {'name': f['name'], 'type': f['type']} for f in dataset['fields'] if f.get('public')]
            good = {'capabilities': 'Query', 'fields': fields}
            mutations = []
            for name in [*schema['privacy']['neverPublic'], 'unexpected_new_field']:
                mutations.append({**good, 'fields': fields + [{'name': name, 'type': 'esriFieldTypeString'}]})
            mutations += [{**good, 'fields': fields[:-1]}, {**good, 'fields': fields + fields[:1]},
                          {**good, 'capabilities': 'Query,Update'}, {**good, 'hasAttachments': True},
                          {**good, 'relationships': [{'id': 0}]}]
            wrong_type = copy.deepcopy(good)
            wrong_type['fields'][-1]['type'] = 'esriFieldTypeBlob'
            mutations.append(wrong_type)
            for props in mutations:
                gis = Obj(content=Obj(share_items=Mock()))
                collection = Obj(properties={'isView': True, 'capabilities': 'Query'}, layers=[Obj(properties=props)], tables=[])
                with self.assertRaises(RuntimeError):
                    provision.share_verified_view(gis, Obj(access='private', id='test'), collection, dataset, schema['privacy']['neverPublic'])
                gis.content.share_items.assert_not_called()
            gis = Obj(content=Obj(share_items=Mock(return_value={'results': [{'notSharedWith': []}]}), get=Mock(return_value=Obj(access='public'))))
            collection = Obj(properties={'isView': True, 'capabilities': 'Query'}, layers=[Obj(properties=good)], tables=[])
            provision.share_verified_view(gis, Obj(access='private', id='test'), collection, dataset, schema['privacy']['neverPublic'])
            gis.content.share_items.assert_called_once()
            for service, access, layers in [({'isView': False, 'capabilities': 'Query'}, 'private', collection.layers),
                                            ({'isView': True, 'capabilities': 'Query,Create'}, 'private', collection.layers),
                                            (collection.properties, 'public', collection.layers),
                                            (collection.properties, 'private', collection.layers * 2)]:
                gis.content.share_items.reset_mock()
                with self.assertRaises(RuntimeError):
                    provision.share_verified_view(gis, Obj(access=access), Obj(properties=service, layers=layers, tables=[]), dataset, schema['privacy']['neverPublic'])
                gis.content.share_items.assert_not_called()

    def test_one_unexpected_schema_keeps_entire_batch_private(self):
        schema = provision.load_schema()
        dataset = schema['layers'][0]
        fields = [{'name': 'OBJECTID', 'type': 'esriFieldTypeOID'}] + [
            {'name': f['name'], 'type': f['type']} for f in dataset['fields'] if f.get('public')]
        valid = Obj(properties={'isView': True, 'capabilities': 'Query'}, layers=[Obj(properties={'capabilities': 'Query', 'fields': fields})], tables=[])
        invalid = copy.deepcopy(valid)
        invalid.layers[0].properties['fields'].append({'name': 'reviewer_id', 'type': 'esriFieldTypeString'})
        gis = Obj(content=Obj(share_items=Mock()))
        with self.assertRaises(RuntimeError):
            provision.share_verified_views(gis, [(Obj(access='private'), valid, dataset), (Obj(access='private'), invalid, dataset)], schema['privacy']['neverPublic'])
        gis.content.share_items.assert_not_called()


if __name__ == '__main__':
    unittest.main()
