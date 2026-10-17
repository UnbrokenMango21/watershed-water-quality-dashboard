// Firestore REST read adapter for an existing operator OAuth session. Contains no mutation API.
// POST listCollectionIds is a read operation; it discovers orphaned document ancestors too.
export function firestoreReadInventory({ credential, projectId }) {
  const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents`;
  async function request(path, options = {}) {
    const token = await credential.getAccessToken();
    const response = await fetch(`${base}${path}`, {
      ...options, signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(`Inventory read refused (${response.status}).`);
    return response.json();
  }
  const encodePath = (path) => path.split('/').map(encodeURIComponent).join('/');
  function decode(value) {
    if (Object.hasOwn(value, 'stringValue')) return value.stringValue;
    if (Object.hasOwn(value, 'booleanValue')) return value.booleanValue;
    if (Object.hasOwn(value, 'integerValue')) return Number(value.integerValue);
    if (Object.hasOwn(value, 'doubleValue')) return value.doubleValue;
    if (Object.hasOwn(value, 'timestampValue')) return value.timestampValue;
    if (Object.hasOwn(value, 'nullValue')) return null;
    if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields ?? {}).map(([key, item]) => [key, decode(item)]));
    if (value.arrayValue) return (value.arrayValue.values ?? []).map(decode);
    return null; // Reference/geopoint/bytes values cannot be UID strings.
  }
  async function listCollections(path = '') {
    const collections = [];
    let pageToken;
    do {
      const result = await request(`${path ? `/${encodePath(path)}` : ''}:listCollectionIds`, {
        method: 'POST', body: JSON.stringify({ pageSize: 1000, ...(pageToken ? { pageToken } : {}) }),
      });
      for (const id of result.collectionIds ?? []) collections.push(collection(path ? `${path}/${id}` : id));
      pageToken = result.nextPageToken;
    } while (pageToken);
    return collections;
  }
  function document(path, raw) {
    return {
      path, id: path.split('/').at(-1),
      async get() { return { exists: Boolean(raw.createTime), data: () => Object.fromEntries(Object.entries(raw.fields ?? {}).map(([key, value]) => [key, decode(value)])) }; },
      listCollections: () => listCollections(path),
    };
  }
  function collection(path) {
    return { async listDocuments() {
      const refs = [];
      let pageToken;
      do {
        const query = new URLSearchParams({ pageSize: '1000', showMissing: 'true', ...(pageToken ? { pageToken } : {}) });
        const result = await request(`/${encodePath(path)}?${query}`);
        for (const raw of result.documents ?? []) refs.push(document(raw.name.split('/documents/')[1], raw));
        pageToken = result.nextPageToken;
      } while (pageToken);
      return refs;
    } };
  }
  return { listCollections };
}
